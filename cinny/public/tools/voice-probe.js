// 语音播放诊断（远程工具）：在当前页面环境里复刻语音条播放器的行为，
// 定位"点播放转两圈后无声"的真因。App 里跑就是 App WebView 的真实结果。
// 原理：用与 App 录音完全相同的 WAV 编码生成测试音频，排除文件问题；
// 再用三种播放方式对照（复刻现播放器 / 可见元素+显式播放 / 隐藏元素+显式播放），
// 抓 audio.error 与事件，判定是 autoPlay 被拦截、display:none 不兼容还是解码失败。
window.__siyuTools = window.__siyuTools || {};
window.__siyuTools['voice-probe'] = async function (ctx) {
  var report = ctx.report;
  var wait = function (ms) {
    return new Promise(function (r) {
      setTimeout(r, ms);
    });
  };

  report('UA：' + navigator.userAgent);

  // ---- 1. 生成与 App 录音完全相同的 WAV（逐行复制 VoiceRecorder.encodeWav） ----
  function encodeWav(sampleRate, channel) {
    var bytes = 44 + channel.length * 2;
    var ab = new ArrayBuffer(bytes);
    var view = new DataView(ab);
    var writeStr = function (off, s) {
      for (var i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
    };
    writeStr(0, 'RIFF');
    view.setUint32(4, bytes - 8, true);
    writeStr(8, 'WAVE');
    writeStr(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, 1, true); // mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeStr(36, 'data');
    view.setUint32(40, channel.length * 2, true);
    var off = 44;
    for (var i = 0; i < channel.length; i++, off += 2) {
      var s = Math.max(-1, Math.min(1, channel[i]));
      view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return new Blob([ab], { type: 'audio/wav' });
  }
  var SR = 16000;
  var ch = new Float32Array(SR); // 1 秒 440Hz
  for (var i = 0; i < ch.length; i++) ch[i] = Math.sin((i / SR) * 2 * Math.PI * 440) * 0.5;
  var wavBlob = encodeWav(SR, ch);
  var blobUrl = URL.createObjectURL(wavBlob);
  report('测试音频已生成：' + wavBlob.size + ' 字节，16kHz 单声道 16bit WAV（与 App 录音同编码）');

  var EVENTS = [
    'loadstart',
    'loadeddata',
    'canplay',
    'error',
    'stalled',
    'suspend',
    'play',
    'playing',
    'pause',
    'ended',
  ];
  function watch(el, tag, seen) {
    EVENTS.forEach(function (ev) {
      el.addEventListener(ev, function () {
        var extra = '';
        if (ev === 'error' && el.error) extra = ' code=' + el.error.code;
        seen.push(tag + ':' + ev + extra);
      });
    });
  }
  function errText(el) {
    if (!el.error) return '无';
    var names = { 1: 'ABORTED(中止)', 2: 'NETWORK(网络)', 3: 'DECODE(解码失败)', 4: 'SRC_NOT_SUPPORTED(不支持)' };
    return 'code=' + el.error.code + (names[el.error.code] || '');
  }
  async function tryPlay(el) {
    try {
      var p = el.play();
      if (p && typeof p.then === 'function') {
        await p;
        return 'play() 成功';
      }
      return 'play() 已调用（老接口无 promise）';
    } catch (e) {
      return 'play() 被拒：' + (e && e.name) + ' ' + ((e && e.message) || '');
    }
  }

  // ---- 测试 B（先跑，趁点击手势还新鲜）：可见元素 + 直接 src + 显式 play() ----
  var seenB = [];
  var b = document.createElement('audio');
  b.style.cssText =
    'position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;pointer-events:none;';
  b.src = blobUrl;
  watch(b, 'B', seenB);
  document.body.appendChild(b);
  var bPlayResult = await tryPlay(b);
  await wait(2500);
  report('测试 B（可见元素+显式播放）：' + bPlayResult);
  report('  事件：' + (seenB.length ? seenB.join(' | ') : '（无）'));
  report('  状态：paused=' + b.paused + '，error=' + errText(b));
  var bOk = !b.paused;
  try { b.pause(); } catch (e) {}

  // ---- 测试 C：display:none + 显式 play()（隔离 display:none 变量） ----
  var seenC = [];
  var c = document.createElement('audio');
  c.style.display = 'none';
  c.src = blobUrl;
  watch(c, 'C', seenC);
  document.body.appendChild(c);
  var cPlayResult = await tryPlay(c);
  await wait(2500);
  report('测试 C（display:none+显式播放）：' + cPlayResult);
  report('  事件：' + (seenC.length ? seenC.join(' | ') : '（无）'));
  report('  状态：paused=' + c.paused + '，error=' + errText(c));
  var cOk = !c.paused;
  try { c.pause(); } catch (e) {}

  // ---- 测试 A：完全复刻现播放器（display:none + autoPlay + 异步注入 <source>） ----
  var seenA = [];
  var a = document.createElement('audio');
  a.setAttribute('autoplay', '');
  a.style.display = 'none';
  watch(a, 'A', seenA);
  document.body.appendChild(a);
  await wait(400); // 模拟下载耗时后 React 注入 <source>
  var srcEl = document.createElement('source');
  srcEl.src = blobUrl;
  srcEl.type = 'audio/wav';
  a.appendChild(srcEl);
  report('测试 A（复刻现播放器：display:none+autoPlay+异步 source）已注入，等待 6 秒…');
  await wait(6000);
  report('  事件：' + (seenA.length ? seenA.join(' | ') : '（无）'));
  report('  状态：paused=' + a.paused + '，readyState=' + a.readyState + '，error=' + errText(a));
  var aOk = !a.paused;

  // ---- 结论 ----
  report('—— 结论 ——');
  report(
    'A（现播放器复刻）' + (aOk ? '能播' : '不能播') +
      ' / B（可见+显式播放）' + (bOk ? '能播' : '不能播') +
      ' / C（隐藏+显式播放）' + (cOk ? '能播' : '不能播')
  );
  if (aOk) {
    report('判定：复刻播放器能播——真机问题可能在下载链（fetch/解密/blob），请在聊天页点语音条后看本页有无报错并贴回');
  } else if (!bOk && !cOk && errText(b) !== '无') {
    report('判定：三种方式都解码失败（' + errText(b) + '）——此 WebView 播不了该 WAV，属文件/解码器问题');
  } else if (bOk && !cOk) {
    report('判定：display:none 是病根——修复=音频元素改"可见但透明"（1px/opacity:0），不再用 display:none');
  } else if (!aOk && cOk) {
    report('判定：autoPlay 被拦截但显式播放可行——修复=去掉 autoPlay，source 就绪后由代码调 play()（点一次下载、就绪自动播）');
  } else if (!aOk && !bOk && !cOk) {
    report('判定：三种全灭但无 error——播放被系统级拦截（如 WebView 禁止后台音频），把三组事件全文贴回分析');
  } else {
    report('判定：混合结果，把上面三组事件全文贴回分析');
  }

  [a, b, c].forEach(function (el) {
    try { el.remove(); } catch (e) {}
  });
  URL.revokeObjectURL(blobUrl);
  report('诊断结束（点"复制"把结果发回）');
};
