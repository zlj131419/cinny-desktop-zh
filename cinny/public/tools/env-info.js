// 环境信息（远程工具）v2：静态实测 + 键盘打开状态下的外壳贴合实测。
// 键盘类问题（输入框起飞/黑带/底栏消失）必须在键盘打开的瞬间量外壳与
// visualViewport 的贴合差，静态数据看不出来，故本版带一个可聚焦输入框，
// 点它弹键盘后自动量一遍。
window.__siyuTools = window.__siyuTools || {};
window.__siyuTools['env-info'] = async function (ctx) {
  var report = ctx.report;
  var vv = window.visualViewport;
  var cs = getComputedStyle(document.documentElement);

  function rect(sel) {
    var el = document.querySelector(sel);
    if (!el) return '无';
    var r = el.getBoundingClientRect();
    return (
      'top=' + Math.round(r.top) + ' bottom=' + Math.round(r.bottom) +
      ' h=' + Math.round(r.height)
    );
  }
  function measure(tag) {
    var rootEl = document.querySelector('#root');
    var rootCs = rootEl ? getComputedStyle(rootEl) : null;
    var portrait = window.matchMedia('(orientation: portrait)').matches;
    var full = portrait
      ? Math.max(screen.width, screen.height)
      : Math.min(screen.width, screen.height);
    var kbJudged = vv ? vv.height < full * 0.85 : false;
    report('—— ' + tag + ' ——');
    report('inner：' + window.innerWidth + 'x' + window.innerHeight +
      ' scrollY=' + Math.round(window.scrollY || 0));
    report('vv：' + (vv
      ? Math.round(vv.width) + 'x' + Math.round(vv.height) +
        ' offsetTop=' + Math.round(vv.offsetTop)
      : '无') + ' 判定键盘：' + (kbJudged ? '开' : '关'));
    report('--siyu-vh：' + (cs.getPropertyValue('--siyu-vh') || '未设置') +
      ' --siyu-vt：' + (cs.getPropertyValue('--siyu-vt') || '未设置'));
    report('#root：' + rect('#root') +
      ' position=' + (rootCs ? rootCs.position : '?'));
    report('底栏#siyu-tabbar：' + rect('#siyu-tabbar'));
    if (vv && rootEl) {
      var r = rootEl.getBoundingClientRect();
      report('外壳贴合差：壳底-可见区底=' +
        Math.round(r.bottom - (vv.offsetTop + vv.height)) +
        '（应为0；正=壳溢出屏外，负=壳底上方有空带）');
    }
  }

  report('UA：' + navigator.userAgent);
  report('App 版本（前端）：' + (ctx.appVersion || '未知'));
  report('运行环境：' + ('__TAURI__' in window ? 'App（Tauri）' : '浏览器/PWA'));
  report('屏幕：' + screen.width + 'x' + screen.height);
  var probe = document.createElement('div');
  probe.style.cssText =
    'position:fixed;top:0;left:0;padding-top:env(safe-area-inset-top);' +
    'padding-bottom:env(safe-area-inset-bottom);visibility:hidden;';
  document.body.appendChild(probe);
  var pcs = getComputedStyle(probe);
  report('env(safe-area-inset)：top=' + pcs.paddingTop + ' bottom=' + pcs.paddingBottom);
  probe.remove();
  report('--siyu-top-inset：' + (cs.getPropertyValue('--siyu-top-inset') || '未设置'));
  report('显示模式 standalone：' +
    (window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true));
  measure('静态（当前状态）');

  // 键盘探针面板：点面板里的输入框把键盘弹起来，900ms 后自动量键盘态
  var panel = document.createElement('div');
  panel.style.cssText =
    'position:fixed;top:6px;left:6px;right:6px;z-index:2147483647;' +
    'background:#1c1c22;color:#eee;border:1px solid #555;border-radius:10px;' +
    'padding:10px;font-size:13px;max-height:55vh;overflow:auto;';
  panel.innerHTML =
    '<div style="margin-bottom:6px">键盘探针：点下面输入框弹起键盘，' +
    '停 1 秒别动，结果会自动追加到开发者工具页的报告里；量完点关闭。</div>';
  var input = document.createElement('input');
  input.type = 'text';
  input.placeholder = '点我弹键盘';
  input.style.cssText =
    'width:70%;padding:8px;font-size:16px;border-radius:6px;border:1px solid #777;';
  var closeBtn = document.createElement('button');
  closeBtn.textContent = '关闭探针';
  closeBtn.style.cssText =
    'margin-left:8px;padding:8px 10px;font-size:14px;border-radius:6px;';
  closeBtn.onclick = function () { panel.remove(); };
  panel.appendChild(input);
  panel.appendChild(closeBtn);
  document.body.appendChild(panel);
  var measured = false;
  input.addEventListener('focus', function () {
    measured = false;
    setTimeout(function () {
      if (!measured) {
        measured = true;
        measure('键盘打开后');
      }
    }, 900);
  });
  report('键盘探针已就绪：看屏幕顶部面板，点输入框弹键盘即可');
};
