/**
 * 安卓 App 新版本提醒。
 * 安卓侧载的 APK 不能像桌面端那样自动升级（桌面端走 Tauri updater），
 * 这里登录后查一次官方 latest.json 与本地版本对比，有新版就在底部弹一条
 * 提醒，点「去更新」跳下载页下载新 APK 覆盖安装（同签名，数据不丢）。
 * 只在安卓 Tauri 里跑；每次登录都查；同一版本点过「以后再说」不再弹。
 */
import { SIYU_VERSION } from '../../version';

// 检查地址优先走自家服务器镜像：GitHub 的 release 下载不带跨域头，WebView
// 的 fetch 读不到响应（实测跳转链无 Access-Control-Allow-Origin），且国内
// 直连 GitHub 不稳；桌面端 updater 走 Rust 请求不受跨域限，所以桌面一直正常。
// 服务器上的 /public/latest.json 在每次发版时同步。
const LATEST_JSON_URLS = [
  'https://chat.xxqw.net/public/latest.json',
  'https://github.com/zlj131419/siyu/releases/latest/download/latest.json',
];
const DOWNLOAD_PAGE = 'https://chat.xxqw.net/public/download.html';

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
    // 走系统浏览器打开下载页：__TAURI__.shell/opener 全局在 Tauri v2 不存在，
    // 正道是 core.invoke('plugin:opener|open_url')（与侧边栏下载按钮同款修法），
    // 全失败才退回 window.open。
    const t = (window as unknown as Record<string, any>).__TAURI__;
    void (async () => {
      try {
        await t?.core?.invoke('plugin:opener|open_url', { url: DOWNLOAD_PAGE });
        return;
      } catch {
        /* 继续兜底 */
      }
      try {
        if (t?.opener?.openUrl) {
          await t.opener.openUrl(DOWNLOAD_PAGE);
          return;
        }
      } catch {
        /* 继续兜底 */
      }
      window.open(DOWNLOAD_PAGE, '_blank');
    })();
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
  // 不做时间节流：每次登录都查（只是一个小 json 请求）。旧版 6 小时节流会在
  // 查时线上还是旧版、之后新版发布了也不再弹——2026-10-21 用户实测踩中。
  try {
    localStorage.setItem('siyu-update-check-ts', String(Date.now()));
  } catch {
    /* ignore */
  }
  const tryFetch = async (): Promise<{ version?: unknown } | null> => {
    for (const url of LATEST_JSON_URLS) {
      try {
        const res = await fetch(url);
        if (res.ok) return (await res.json()) as { version?: unknown };
      } catch {
        /* 换下一个地址 */
      }
    }
    return null;
  };
  void tryFetch()
    .then((data) => {
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
