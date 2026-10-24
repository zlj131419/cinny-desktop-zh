/**
 * 移动端视口高度同步（仅 iOS 启用，桌面/安卓不介入）：
 * iOS PWA 冷启动会把 visualViewport 高度报矮（真机实测报 894，屏幕真实 956，
 * 差的 62px 正是顶部安全区高度），且之后不派发任何事件纠正，只有转屏才重报
 * 真值——页面若照单全收，底部就永远空出一条 62px 的黑带、底栏上浮。
 * 故：键盘未弹起时，在全屏（standalone）且整屏宽的前提下，直接以屏幕真实
 * 高度（screen 长短边按方向取）为准摆正，不信 vv 的矮值；键盘弹起时 vv 才是
 * 真值（矮到全高 85% 以下判定），照用 vv，输入框贴键盘。
 * 安卓 WebView 原生随键盘 resize 窗口，不介入（强钉高度反而压住输入框）。
 * ——2026-10-24 修正：上面这句只对现代浏览器成立。老华为 WebView 不支持
 * dvh（回退到 100% 布局视口高度，键盘弹起高度不变）且 Tauri App 壳全面屏
 * 下窗口根本不收缩，安卓侧必须另起一行（见 initAndroidViewport）。
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
    // 键盘弹起时外壳 transform 跟随页面实际滚动量（--siyu-ty）。注意基准
    // 必须是 window.scrollY 而非 vv.offsetTop：真机实测（iPhone 18.7）键盘
    // 打开时 scrollY=373 而 offsetTop=311，差的 62px 正是被吞掉的量——用
    // offsetTop 时外壳顶 rect=-62、底部空出 62px 黑带；scrollY 与 rect
    // 完全自洽（311-373=-62）。键盘关闭时强制归零，绝不残留
    rootEl.style.setProperty(
      '--siyu-ty',
      `${keyboardActive ? Math.round(window.scrollY) : 0}px`
    );
    // 键盘弹起时不抢滚动：系统要把输入框滚进可见区，强行 scrollTo(0,0) 会把
    // 输入框拽到顶、发送按钮滚没（真机实测）
    if (!keyboardActive && window.scrollY !== 0) window.scrollTo(0, 0);
  };

  vv.addEventListener('resize', sync);
  vv.addEventListener('scroll', sync);
  // iOS 平移可见区的过程就是 window 在滚动，跟住最终落点
  window.addEventListener('scroll', sync, { passive: true });
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

/**
 * 安卓视口高度同步（2026-10-24：华为浏览器与 Tauri App 壳双双实锤失效后补的）。
 * 页面根是 height: 100dvh + overflow: hidden：
 * - 老华为 WebView 不支持 dvh，回退到 100%（布局视口高度，键盘弹起时不变），
 *   输入框被键盘盖住、窗口只平移、内容沉在键盘底下；
 * - Tauri App 壳全面屏模式下窗口根本不收缩，dvh 同样不变（壳的问题另有
 *   原生侧 enableKeyboardResize 兜底，本函数在壳里无害、只当 no-op）。
 * 故安卓侧不再信 CSS 高度：直接以当前可视高度（innerHeight 与 vv.height
 * 取小，兼顾新老 Chromium 对 innerHeight 的不同口径）钉住 #root 高度；
 * 键盘收起时可视高度回到满高，#root 自动恢复，不用单独写恢复分支。
 * 只在安卓 + 触屏时启用；iOS 走原有逻辑，不动。
 */
export function initAndroidViewport(): void {
  if (typeof window === 'undefined' || !window.visualViewport) return;
  if (!window.matchMedia('(pointer: coarse)').matches) return;
  if (!/Android/i.test(navigator.userAgent)) return;
  const vv = window.visualViewport;
  const root = document.getElementById('root');
  if (!root) return;
  const sync = () => {
    const visible = Math.min(window.innerHeight, vv.height);
    if (visible > 0) root.style.height = `${visible}px`;
  };
  vv.addEventListener('resize', sync);
  vv.addEventListener('scroll', sync);
  window.addEventListener('resize', sync);
  window.addEventListener('orientationchange', () => {
    window.setTimeout(sync, 60);
    window.setTimeout(sync, 350);
  });
  document.addEventListener('focusin', () => window.setTimeout(sync, 50));
  document.addEventListener('focusout', () => {
    window.setTimeout(sync, 50);
    window.setTimeout(sync, 350);
  });
  sync();
}
