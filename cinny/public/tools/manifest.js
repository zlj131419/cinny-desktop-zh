// 私语自建诊断工具清单（远程版）：开发者工具页运行时拉取本文件渲染工具列表。
// 新增工具 = 在 public/tools/ 加一个脚本文件 + 在这里加一行，随网页部署即生效，
// 已装机的 App 打开开发者工具就能用，不用重新打包发版。
window.__siyuToolsManifest = [
  {
    id: 'mic-test',
    name: '麦克风检测（远程）',
    desc: '逐层检测录音链：接口是否存在、App 权限命令、getUserMedia 实际结果',
    file: 'mic-test.js',
    version: 1,
  },
  {
    id: 'env-info',
    name: '环境信息（远程）',
    desc: '屏幕/视口/安全区/底栏位置实测 + 运行环境与版本',
    file: 'env-info.js',
    version: 2,
  },
  {
    id: 'voice-probe',
    name: '语音播放诊断',
    desc: '复刻语音条播放器行为，定位"点播放转两圈后无声"的真因（需在出问题的设备上跑）',
    file: 'voice-probe.js',
    version: 1,
  },
];
