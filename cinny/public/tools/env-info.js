// 环境信息（远程工具）v3：静态实测 + 键盘打开瞬间实测（后台蹲守版）。
// v2 的探针面板带输入框，键盘一弹页面重排就把面板冲掉、量不到。故 v3 改为：
// 运行一次 = 武装一个后台监听（focusin + visualViewport resize），等用户去
// 房间里点开真实输入框时，在键盘打开状态下量一遍并存 localStorage；
// 用户回到开发者工具再运行一次本工具，即读出存档报告。
window.__siyuTools = window.__siyuTools || {};
window.__siyuTools['env-info'] = async function (ctx) {
var report = ctx.report;
var vv = window.visualViewport;
var cs = getComputedStyle(document.documentElement);
var LS_KEY = 'siyu-kb-probe-v3';

function rect(sel) {
var el = document.querySelector(sel);
if (!el) return '无';
var r = el.getBoundingClientRect();
return (
'top=' + Math.round(r.top) + ' bottom=' + Math.round(r.bottom) +
' h=' + Math.round(r.height)
);
}
function measureLines(tag) {
var lines = [];
var rootEl = document.querySelector('#root');
var rootCs = rootEl? getComputedStyle(rootEl): null;
var portrait = window.matchMedia('(orientation: portrait)').matches;
var full = portrait
? Math.max(screen.width, screen.height)
: Math.min(screen.width, screen.height);
var kbJudged = vv? vv.height < full * 0.85: false;
lines.push('—— ' + tag + ' ——');
lines.push('inner：' + window.innerWidth + 'x' + window.innerHeight +
' scrollY=' + Math.round(window.scrollY || 0));
lines.push('vv：' + (vv
? Math.round(vv.width) + 'x' + Math.round(vv.height) +
' offsetTop=' + Math.round(vv.offsetTop)
: '无') + ' 判定键盘：' + (kbJudged? '开': '关'));
lines.push('--siyu-vh：' + (cs.getPropertyValue('--siyu-vh') || '未设置') +
' --siyu-ty：' + (cs.getPropertyValue('--siyu-ty') || '未设置'));
lines.push('#root：' + rect('#root') +
' position=' + (rootCs? rootCs.position: '?') +
' transform=' + (rootCs? rootCs.transform: '?'));
lines.push('底栏#siyu-tabbar：' + rect('#siyu-tabbar'));
var ae = document.activeElement;
if (ae && ae!== document.body) {
var ar = ae.getBoundingClientRect();
lines.push('当前焦点元素：<' + ae.tagName.toLowerCase() + '> rect top=' +
Math.round(ar.top) + ' bottom=' + Math.round(ar.bottom));
}
if (vv && rootEl) {
var r = rootEl.getBoundingClientRect();
lines.push('外壳贴合差：壳底-可见区底=' +
Math.round(r.bottom - (vv.offsetTop + vv.height)) +
'（应为0；正=壳溢出屏外，负=壳底上方有空带）');
}
return lines;
}
function emit(lines) {
for (var i = 0; i < lines.length; i++) report(lines[i]);
}

report('UA：' + navigator.userAgent);
report('App 版本（前端）：' + (ctx.appVersion || '未知'));
report('运行环境：' + ('__TAURI__' in window? 'App（Tauri）': '浏览器/PWA'));
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
emit(measureLines('静态（当前状态）'));

// 读上次蹲守存档
try {
var saved = window.localStorage.getItem(LS_KEY);
if (saved) {
report('');
emit(JSON.parse(saved));
} else {
report('暂无键盘打开实测存档（先按下方步骤操作一次）');
}
} catch (e) {
report('读取存档失败：' + e);
}

// 武装蹲守（全局只装一次）
if (!window.__siyuKbProbeArmed) {
window.__siyuKbProbeArmed = true;
var pending = null;
var capture = function () {
if (!vv) return;
var portrait = window.matchMedia('(orientation: portrait)').matches;
var full = portrait
? Math.max(screen.width, screen.height)
: Math.min(screen.width, screen.height);
if (vv.height < full * 0.85) {
if (pending) clearTimeout(pending);
pending = setTimeout(function () {
try {
var lines = measureLines('键盘打开后（蹲守实测）');
window.localStorage.setItem(LS_KEY, JSON.stringify(lines));
} catch (e) { /* 存档失败不打扰使用 */}
}, 700);
}
};
vv.addEventListener('resize', capture);
document.addEventListener('focusin', capture);
}
report('键盘蹲守已武装：现在去任意房间点开输入框打字，再收起键盘，' +
'回到这里重新运行一次「环境信息」，即可看到键盘打开时的实测');
};
