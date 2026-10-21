/**
 * App 内下载链接拦截。
 * 下载页对 App 是外来页面、没权限调系统浏览器（Tauri 能力作用域），
 * 在里面点下载会被 WebView 自己接管。这里在 App 本体（特权层）拦截
 * 指向下载页 / release 安装包的链接点击，改走系统浏览器打开。
 * 只在 Tauri 环境生效，普通浏览器不受影响。
 */
export function initExternalLinks(): void {
  if (typeof window === 'undefined') return;
  const tauri = (window as any).__TAURI__;
  if (!tauri?.core?.invoke) return;

  const isDownloadUrl = (href: string): boolean =>
    href.includes('/public/download.html') || href.includes('/releases/download/');

  document.addEventListener('click', (e) => {
    const a = (e.target as HTMLElement | null)?.closest?.('a');
    if (!a || !a.href || !isDownloadUrl(a.href)) return;
    let opened = false;
    try {
      if (tauri.shell?.open) {
        tauri.shell.open(a.href);
        opened = true;
      } else if (tauri.opener?.openUrl) {
        tauri.opener.openUrl(a.href);
        opened = true;
      }
    } catch {
      /* 忽略，走默认行为 */
    }
    if (opened) e.preventDefault();
  });
}
