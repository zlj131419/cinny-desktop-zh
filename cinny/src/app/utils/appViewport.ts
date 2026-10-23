/**
 * 移动端视口高度同步（仅 iOS 启用，桌面/安卓不介入）：
 * iOS PWA 冷启动会把 visualViewport 高度报矮（真机实测报 894，屏幕真实 956，
 * 差的 62px 正是顶部安全区高度），且之后不派发任何事件纠正，只有转屏才重报
 * 真值——页面若照单全收，底部就永远空出一条 62px 的黑带、底栏上浮。
 * 故：键盘未弹起时，在全屏（standalone）且整屏宽的前提下，直接以屏幕真实
 * 高度（screen 长短边按方向取）为准摆正，不信 vv 的矮值；键盘弹起时 vv 才是
 * 真值（矮到全高 85% 以下判定），照用 vv，输入框贴键盘。
 * 安卓 WebView 原生随键盘 resize 窗口，不介入（强钉高度反而压住输入框）。
 */
/**
 * 键盘是否弹起（以可视视口为准）：vv 高度矮于屏幕全高 85% 即认为键盘占位。
 * 判断键盘状态全局只用这一处——历史上输入框组件另用 innerHeight 差值判断，
 * 在 iOS 上 innerHeight 会随键盘一起缩、差值约 0，两处判断打架，安全区
 * 垫高收不起来、变成输入框下方的黑带。
 */
export function isKeyboardVisuallyOpen(): boolean {
  if (typeof window === 'undefined' || !window.visualViewport) return false;
  const portrait = window.matchMedia('(orientation: portrait)').matches;
  const full = portrait
    ? Math.max(screen.width, screen.height)
    : Math.min(screen.width, screen.height);
  return window.visualViewport.height < full * 0.85;
}

export function initAppViewport(): void {
  if (typeof window === 'undefined' || !window.visualViewport) return;
  if (!window.matchMedia('(pointer: coarse)').matches) return;
  const ua = navigator.userAgent;
  const isIOS =
    /iPhone|iPad|iPod/i.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (!isIOS) return;
  const vv = window.visualViewport;
  const rootEl = document.documentElement;
  rootEl.classList.add('siyu-vv');

  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true;

  const sync = () => {
    const vvH = Math.round(vv.height);
    const portrait = window.matchMedia('(orientation: portrait)').matches;
    const sLong = Math.max(screen.width, screen.height);
    const sShort = Math.min(screen.width, screen.height);
    const fullH = portrait ? sLong : sShort;
    const fullW = portrait ? sShort : sLong;
    // vv 矮于全高 85% 才认为键盘占位（键盘开时约 60%，关时约 93%~100%）
    const keyboardActive = isKeyboardVisuallyOpen();
    let target = vvH;
    if (!keyboardActive && isStandalone && Math.round(vv.width) === fullW) {
      target = fullH;
    }
    rootEl.style.setProperty('--siyu-vh', `${target}px`);
    // 键盘弹起时 iOS 平移可视视口（offsetTop 变大），外壳 transform 同量
    // 跟随（--siyu-ty）；键盘关闭时强制归零，绝不残留
    rootEl.style.setProperty(
      '--siyu-ty',
      `${keyboardActive ? Math.round(vv.offsetTop) : 0}px`
    );
    // 键盘弹起时不抢滚动：系统要把输入框滚进可见区，强行 scrollTo(0,0) 会把
    // 输入框拽到顶、发送按钮滚没（真机实测）
    if (!keyboardActive && window.scrollY !== 0) window.scrollTo(0, 0);
  };

  vv.addEventListener('resize', sync);
  vv.addEventListener('scroll', sync);
  window.addEventListener('orientationchange', () => {
    window.setTimeout(sync, 60);
    window.setTimeout(sync, 350);
  });
  window.addEventListener('pageshow', sync);
  window.addEventListener('focus', sync);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) sync();
  });
  document.addEventListener('focusin', () => window.setTimeout(sync, 50));
  document.addEventListener('focusout', () => {
    window.setTimeout(sync, 50);
    window.setTimeout(sync, 350);
  });
  const onFirstTouch = () => {
    sync();
    window.removeEventListener('touchstart', onFirstTouch);
  };
  window.addEventListener('touchstart', onFirstTouch);
  sync();
  window.setTimeout(sync, 300);
  window.setTimeout(sync, 1000);
}
