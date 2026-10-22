/**
 * 移动端视口高度同步（仅触屏设备启用，桌面端不介入）：
 * 1) iOS PWA 冷启动时 100dvh 可能和真实可见高度对不上，底部导航要转一次屏才贴底；
 * 2) 键盘弹起时 dvh 不跟着缩，输入框与键盘之间会空出一大截。
 * visualViewport.height 始终是当前真实可见高度，转屏/键盘开关都会触发它的 resize，
 * 把它同步到 --siyu-vh 让 html 高度以它为准，两个问题一并解决。
 */
export function initAppViewport(): void {
  if (typeof window === 'undefined' || !window.visualViewport) return;
  if (!window.matchMedia('(pointer: coarse)').matches) return;
  // 只给 iOS 用：它的 dvh 冷启动对不齐、键盘弹起不缩，必须靠 visualViewport 纠正。
  // 安卓（浏览器和 App 的 WebView）原生就会随键盘resize窗口，强行钉高度反而会把
  // 输入框压在键盘下面，故不介入。
  const ua = navigator.userAgent;
  const isIOS =
    /iPhone|iPad|iPod/i.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (!isIOS) return;
  const vv = window.visualViewport;
  const rootEl = document.documentElement;
  rootEl.classList.add('siyu-vv');
  const sync = () => {
    rootEl.style.setProperty('--siyu-vh', `${Math.round(vv.height)}px`);
    if (window.scrollY !== 0) window.scrollTo(0, 0);
  };
  vv.addEventListener('resize', sync);
  window.addEventListener('orientationchange', () => window.setTimeout(sync, 60));
  sync();
}
