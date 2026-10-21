/**
 * 安卓 App 新版本提醒。
 * 安卓侧载的 APK 不能像桌面端那样自动升级（桌面端走 Tauri updater），
 * 这里登录后查一次官方 latest.json 与本地版本对比，有新版就在底部弹一条
 * 提醒，点「去更新」跳下载页下载新 APK 覆盖安装（同签名，数据不丢）。
 * 只在安卓 Tauri 里跑；6 小时内不重复查；同一版本点过「以后再说」不再弹。
 */
import { SIYU_VERSION } from '../../version';

const LATEST_JSON_URL =
  'https://github.com/zlj131419/siyu/releases/latest/download/latest.json';
const DOWNLOAD_PAGE = 'https://chat.xxqw.net/public/download.html';
const CHECK_INTERVAL_MS = 6 * 3600 * 1000;

function isNewer(remote: string, local: string): boolean {
  const r = remote.split('.').map((n) => parseInt(n, 10) || 0);
  const l = local.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(r.length, l.length); i += 1) {
    if ((r[i] ?? 0) !== (l[i] ?? 0)) return (r[i] ?? 0) > (l[i] ?? 0);
  }
  return false;
}

function showUpdateBanner(version: string): void {
  if (document.getElementById('siyu-update-banner')) return;
  const bar = document.createElement('div');
  bar.id = 'siyu-update-banner';
  bar.style.cssText =
    'position:fixed;left:12px;right:12px;bottom:16px;z-index:9999;background:#3f83f6;color:#fff;border-radius:12px;padding:12px 14px;display:flex;align-items:center;gap:10px;box-shadow:0 6px 24px rgba(0,0,0,.35);font-size:14px;';
  const text = document.createElement('span');
  text.textContent = `私语有新版本 v${version}，点「去更新」下载新版安装（覆盖安装，聊天记录不丢）`;
  text.style.cssText = 'flex:1;line-height:1.45;';
  const go = document.createElement('button');
  go.textContent = '去更新';
  go.style.cssText =
    'background:#fff;color:#2563eb;border:none;border-radius:8px;padding:8px 12px;font-weight:600;font-size:14px;flex-shrink:0;';
  go.onclick = () => {
    // 在 App 里用 window.open 会被 WebView 接管（下载页在 App 内没权限下载），
    // 优先走 Tauri 的系统浏览器打开，拿不到桥时才退回 window.open
    const t = (window as unknown as Record<string, any>).__TAURI__;
    try {
      if (t?.shell?.open) {
        void t.shell.open(DOWNLOAD_PAGE);
        return;
      }
      if (t?.opener?.openUrl) {
        void t.opener.openUrl(DOWNLOAD_PAGE);
        return;
      }
    } catch {
      /* 忽略，走下面的兜底 */
    }
    window.open(DOWNLOAD_PAGE, '_blank');
  };
  const dismiss = document.createElement('button');
  dismiss.textContent = '以后再说';
  dismiss.style.cssText =
    'background:transparent;color:#dbeafe;border:1px solid rgba(255,255,255,.5);border-radius:8px;padding:8px 10px;font-size:14px;flex-shrink:0;';
  dismiss.onclick = () => {
    try {
      localStorage.setItem('siyu-update-dismissed', version);
    } catch {
      /* ignore */
    }
    bar.remove();
  };
  bar.append(text, go, dismiss);
  document.body.appendChild(bar);
}

export function checkAndroidUpdate(): void {
  if (typeof window === 'undefined') return;
  const tauri = (window as unknown as Record<string, unknown>).__TAURI__ as
    | { core?: { invoke?: unknown } }
    | undefined;
  if (!tauri?.core?.invoke) return;
  if (!/Android/i.test(navigator.userAgent)) return;
  try {
    const last = Number(localStorage.getItem('siyu-update-check-ts') ?? 0);
    if (Date.now() - last < CHECK_INTERVAL_MS) return;
    localStorage.setItem('siyu-update-check-ts', String(Date.now()));
  } catch {
    /* ignore */
  }
  fetch(LATEST_JSON_URL)
    .then((res) => (res.ok ? res.json() : null))
    .then((data: { version?: unknown } | null) => {
      const remote = typeof data?.version === 'string' ? data.version : '';
      if (!remote || !isNewer(remote, SIYU_VERSION)) return;
      try {
        if (localStorage.getItem('siyu-update-dismissed') === remote) return;
      } catch {
        /* ignore */
      }
      showUpdateBanner(remote);
    })
    .catch(() => {
      /* 查不到不打扰 */
    });
}
