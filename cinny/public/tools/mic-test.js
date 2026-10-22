// 麦克风检测（远程工具）：在当前页面环境里实测录音链，App 里跑就是 App 的真实结果。
window.__siyuTools = window.__siyuTools || {};
window.__siyuTools['mic-test'] = async function (ctx) {
  var report = ctx.report;
  report('UA：' + navigator.userAgent);
  report('页面协议：' + location.protocol);
  report('MediaRecorder 接口：' + typeof MediaRecorder);
  report(
    'getUserMedia 接口：' +
      (navigator.mediaDevices ? typeof navigator.mediaDevices.getUserMedia : 'mediaDevices 不存在')
  );
  var inTauri = '__TAURI__' in window;
  report('运行环境：' + (inTauri ? 'App（Tauri）' : '浏览器/PWA'));
  if (inTauri && window.__TAURI__.core && window.__TAURI__.core.invoke) {
    try {
      var granted = await window.__TAURI__.core.invoke('plugin:siyu-keepalive|request_microphone');
      report('App 录音权限命令返回：' + JSON.stringify(granted));
    } catch (e) {
      report('App 录音权限命令异常：' + ((e && e.message) || e));
    }
  }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    report('结论：当前环境没有 getUserMedia，录音不可用（旧 WebView 或非 https）');
    return;
  }
  try {
    var stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    var tracks = stream.getAudioTracks();
    report(
      'getUserMedia：成功，音频轨道 ' +
        tracks.length +
        ' 条' +
        (tracks[0] && tracks[0].label ? '（' + tracks[0].label + '）' : '')
    );
    tracks.forEach(function (tr) {
      tr.stop();
    });
    if (typeof MediaRecorder === 'undefined') {
      report('结论：麦克风能打开，但没有 MediaRecorder，网页录音条不可用');
    } else {
      report('结论：录音链全部通过 ✓');
    }
  } catch (e) {
    report('getUserMedia：失败 ' + ((e && e.name) || '') + ' ' + ((e && e.message) || e));
    if (e && e.name === 'NotAllowedError')
      report('结论：权限被拒——查系统设置的应用麦克风权限；App 还需清单含 RECORD_AUDIO + MODIFY_AUDIO_SETTINGS');
    if (e && e.name === 'NotFoundError') report('结论：没有找到麦克风设备');
    if (e && e.name === 'NotReadableError') report('结论：麦克风被占用或被系统拦截');
  }
};
