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
    // 先拦下默认导航，再异步走系统浏览器；两个通道都失败才放行默认行为。
    // （旧写法没 await：shell 异步被拒时点击已被吞、页面也不动，等于死按钮。）
    e.preventDefault();
    void (async () => {
      try {
        if (tauri.shell?.open) {
          await tauri.shell.open(a.href);
          return;
        }
        if (tauri.opener?.openUrl) {
          await tauri.opener.openUrl(a.href);
          return;
        }
      } catch {
        /* 落到下面放行默认导航 */
      }
      window.location.href = a.href;
    })();
  });
}
