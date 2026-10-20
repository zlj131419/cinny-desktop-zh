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

export function startKeepAlive(): Promise<void> {
  return invokeKeepAlive('start');
}

export function stopKeepAlive(): Promise<void> {
  return invokeKeepAlive('stop');
}
