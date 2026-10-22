// 环境信息（远程工具）：屏幕/视口/安全区/底栏位置实测，用于贴底、键盘类问题定位。
window.__siyuTools = window.__siyuTools || {};
window.__siyuTools['env-info'] = async function (ctx) {
  var report = ctx.report;
  var vv = window.visualViewport;
  var cs = getComputedStyle(document.documentElement);
  function rect(sel) {
    var el = document.querySelector(sel);
    if (!el) return '无';
    var r = el.getBoundingClientRect();
    return 'top=' + Math.round(r.top) + ' bottom=' + Math.round(r.bottom) + ' h=' + Math.round(r.height);
  }
  report('UA：' + navigator.userAgent);
  report('App 版本（前端）：' + (ctx.appVersion || '未知'));
  report('运行环境：' + ('__TAURI__' in window ? 'App（Tauri）' : '浏览器/PWA'));
  report('屏幕：' + screen.width + 'x' + screen.height);
  report('窗口 inner：' + window.innerWidth + 'x' + window.innerHeight);
  report('visualViewport：' + (vv ? Math.round(vv.width) + 'x' + Math.round(vv.height) + ' offsetTop=' + Math.round(vv.offsetTop) : '无'));
  report('#root：' + rect('#root'));
  report('底栏：' + rect('[class*="MobileTabBar"]') + ' / ' + rect('nav'));
  report('安全区 env：top=' + cs.getPropertyValue('--siyu-test-top'));
  // 直接量 env 值：借一个临时元素
  var probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;top:0;left:0;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom);visibility:hidden;';
  document.body.appendChild(probe);
  var pcs = getComputedStyle(probe);
  report('env(safe-area-inset)：top=' + pcs.paddingTop + ' bottom=' + pcs.paddingBottom);
  probe.remove();
  report('--siyu-vh：' + (cs.getPropertyValue('--siyu-vh') || '未设置'));
  report('--siyu-top-inset：' + (cs.getPropertyValue('--siyu-top-inset') || '未设置'));
  report('显示模式 standalone：' + (window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true));
};
