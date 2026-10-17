/**
 * Tauri 桌面端通知垫片
 * 在 Tauri 环境下，将 Web Notification API 转发到原生系统通知
 * （Tauri webview 的 Notification.permission 默认被拒绝，走原生通道才有弹窗）
 */
export function initTauriNotificationShim() {
  if (typeof window === 'undefined') return;
  const tauri = (window as any).__TAURI__;
  if (!tauri?.core?.invoke) return;

  const invoke = tauri.core.invoke as (
    cmd: string,
    args?: Record<string, unknown>
  ) => Promise<unknown>;

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
      requestNativePermission().then(() => {
        invoke('plugin:notification|notify', {
          notification: {
            title,
            body: options?.body ?? '',
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
}
