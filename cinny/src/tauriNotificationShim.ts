/**
 * Tauri 桌面端通知垫片
 * 在 Tauri 环境下，将 Web Notification API 转发到原生系统通知
 * （Tauri webview 的 Notification.permission 默认被拒绝，走原生通道才有弹窗）
 */
export function initTauriNotificationShim(attempt = 0) {
  if (typeof window === 'undefined') return;
  const tauri = (window as any).__TAURI__;
  if (!tauri?.core?.invoke) {
    // 安卓 WebView 里 __TAURI__ 桥注入时机晚于桌面，一次性判断会漏装垫片
    // （通知设置页因此在安卓 App 里报错）。照 ThemeManager 模式重试：500ms × 10
    if (attempt < 10) {
      setTimeout(() => initTauriNotificationShim(attempt + 1), 500);
    }
    return;
  }

  const invoke = tauri.core.invoke as (
    cmd: string,
    args?: Record<string, unknown>
  ) => Promise<unknown>;

  // 安卓通知渠道：插件默认渠道的重要程度在创建时锁死（表现为只有声音、没有横幅），
  // 建一个高优先级（Importance.High=4）的专用渠道，消息通知都走它，横幅才能弹出。
  // 桌面端没有建渠道命令，调用失败静默忽略、通知照常发（桌面忽略 channelId）。
  // 渠道 ID 用全新的 siyu_msg_high：旧 siyu_messages 在用户机器上首次创建时
  // 重要程度已被锁死（安卓规则，覆盖安装改不动）。新渠道主要由安卓原生层
  // （保活服务启动时）以 IMPORTANCE_HIGH 创建；这里保留同 ID 的 JS 建渠道兜底，
  // 谁先建都一样。
  const MESSAGE_CHANNEL_ID = 'siyu_msg_high';
  // 注意：create_channel 的参数必须平铺传（插件官方 JS 就是 {...channel}），
  // 包一层 {channel: {...}} 会被 Rust 端拒掉、渠道建不出来，之后带 channelId 的
  // 通知会被安卓直接丢弃（无声无横幅）。2026-10-21 实锤此坑。
  let channelOk = false;
  let channelAttempt: Promise<void> | null = null;
  const ensureMessageChannel = (): Promise<void> => {
    if (channelOk) return Promise.resolve();
    if (!channelAttempt) {
      channelAttempt = invoke('plugin:notification|create_channel', {
        id: MESSAGE_CHANNEL_ID,
        name: '消息提醒',
        description: '新消息通知（横幅弹出）',
        importance: 4,
        visibility: 1,
        vibration: true,
      })
        .then(() => {
          channelOk = true;
        })
        .catch(() => {
          // 建失败不静默放弃：下次发通知时重试；本次通知退回默认渠道（至少有声）
          channelAttempt = null;
        });
    }
    return channelAttempt;
  };
  void ensureMessageChannel();

  // 请求原生通知权限（Windows 上一般直接可用）
  const requestNativePermission = async (): Promise<boolean> => {
    try {
      const result = await invoke('plugin:notification|request_permission');
      return result === 'granted';
    } catch {
      return true;
    }
  };

  class TauriNotification {
    static permission: NotificationPermission = 'granted';

    static async requestPermission(): Promise<NotificationPermission> {
      const ok = await requestNativePermission();
      TauriNotification.permission = ok ? 'granted' : 'denied';
      return TauriNotification.permission;
    }

    title: string;
    onclick: ((e: Event) => void) | null = null;

    constructor(title: string, options?: NotificationOptions) {
      this.title = title;
      // 触发时请求一次权限（幂等），然后发原生通知
      ensureMessageChannel()
        .then(() => requestNativePermission())
        .then(() => {
          invoke('plugin:notification|notify', {
            notification: {
              title,
              body: options?.body ?? '',
              // 渠道没建成时不带 channelId：带一个不存在的渠道 ID 会被安卓丢弃
              ...(channelOk ? { channelId: MESSAGE_CHANNEL_ID } : {}),
              // 桌面端：给原生通知挂系统提示音。声音原本只有网页层 Audio 播放，
              // 窗口切后台后 WKWebView 会挂起页面音频 → 只剩横幅没声音；把声音
              // 挂到通知本身，与横幅同出一条系统通知，不依赖 WebView 状态。
              // 取值按 notify-rust / mac-notification-sys 源码核实：macOS 必须传
              // "NSUserNotificationDefaultSoundName" 才是系统默认提醒音（传
              // "default" 会被当作自定义音名、找不到音源而静默）；Windows 传
              // winrt 预置名 "Default"。安卓声音由渠道负责，不传。
              ...(/Android/i.test(navigator.userAgent)
                ? {}
                : {
                    sound: /Macintosh|Mac OS X/i.test(navigator.userAgent)
                      ? 'NSUserNotificationDefaultSoundName'
                      : 'Default',
                  }),
            },
          }).catch(() => {});
        });
    }

    close() {}
    addEventListener() {}
    removeEventListener() {}
    dispatchEvent() {
      return false;
    }
  }

  // 替换全局 Notification
  (window as any).Notification = TauriNotification;

  // 劫持 navigator.permissions.query，让设置页的权限状态显示为 granted
  // （Tauri webview 的 permissions API 默认返回 denied）
  try {
    const origQuery = navigator.permissions.query.bind(navigator.permissions);
    (navigator.permissions as any).query = (desc: PermissionDescriptor) => {
      if (desc?.name === 'notifications') {
        return Promise.resolve({ state: 'granted' } as PermissionStatus);
      }
      return origQuery(desc);
    };
  } catch {
    // 忽略
  }
}
