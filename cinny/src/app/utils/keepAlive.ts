/**
 * 安卓 App 后台保活：登录后启动前台服务（tauri-plugin-siyu-keepalive），
 * 让进程切后台/锁屏后不被系统和厂商省电杀掉，sync 长连接保持工作、新消息能通知。
 * 桌面端和浏览器里没有这个插件，调用会静默跳过。
 */

function keepAliveAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  const tauri = (window as unknown as Record<string, unknown>).__TAURI__ as
    | { core?: { invoke?: unknown } }
    | undefined;
  if (!tauri?.core?.invoke) return false;
  // 只有安卓 App 需要保活
  return /Android/i.test(navigator.userAgent);
}

async function invokeKeepAlive(command: 'start' | 'stop'): Promise<void> {
  if (!keepAliveAvailable()) return;
  try {
    const tauri = (window as unknown as Record<string, any>).__TAURI__;
    await tauri.core.invoke(`plugin:siyu-keepalive|${command}`);
  } catch {
    // 插件不可用（旧版本 App）时静默，不影响正常使用
  }
}

/**
 * 顶部状态栏让位：老安卓 WebView 的 env(safe-area-inset-top) 报的是刘海高度
 * （无刘海时为 0），拿不到真实状态栏高度，纯 CSS 补偿失效（进房间/导航后
 * 顶栏钻到状态栏下面）。改由 keepAlive 插件从原生侧量「WebView 顶部被状态栏
 * 挡住的真实高度」写入 --siyu-top-inset，index.css 的 #root 用 max(env, var)
 * 取大。旧版本 App 没有 top_inset 命令，调用失败静默跳过（保持 env 行为）。
 */
export async function applyTopInset(): Promise<void> {
  if (!keepAliveAvailable()) return;
  try {
    const tauri = (window as unknown as Record<string, any>).__TAURI__;
    const h = await tauri.core.invoke('plugin:siyu-keepalive|top_inset');
    if (typeof h === 'number' && h > 0) {
      document.documentElement.style.setProperty('--siyu-top-inset', `${h}px`);
    } else {
      document.documentElement.style.removeProperty('--siyu-top-inset');
    }
  } catch {
    /* 旧版本 App 无此命令，静默 */
  }
}

let topInsetListening = false;
/** 登录后调一次，并监听窗口尺寸变化（键盘开关、导航返回都会触发 WebView 重排）重测。 */
export function initTopInset(): void {
  void applyTopInset();
  if (topInsetListening || typeof window === 'undefined') return;
  topInsetListening = true;
  let timer: number | undefined;
  window.addEventListener('resize', () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => void applyTopInset(), 250);
  });
}

export function startKeepAlive(): Promise<void> {
  return invokeKeepAlive('start');
}

export function stopKeepAlive(): Promise<void> {
  return invokeKeepAlive('stop');
}
