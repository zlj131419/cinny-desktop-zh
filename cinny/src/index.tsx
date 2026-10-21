/* eslint-disable import/first */
import './polyfills';
import { initTauriNotificationShim } from './tauriNotificationShim';
import { initExternalLinks } from './app/utils/externalLinks';

initTauriNotificationShim();
initExternalLinks();

import React from 'react';
import { createRoot } from 'react-dom/client';
import { enableMapSet } from 'immer';
import '@fontsource/inter/variable.css';
import 'folds/dist/style.css';
import { configClass, varsClass } from 'folds';

enableMapSet();

import './index.css';

import { trimTrailingSlash } from './app/utils/common';
import App from './app/pages/App';

// import i18n (needs to be bundled ;))
import './app/i18n';
import { pushSessionToSW } from './sw-session';
import { getFallbackSession } from './app/state/sessions';

document.body.classList.add(configClass, varsClass);

// 版本戳自愈：App 升级不清 WebView 数据，早期坏版本的 SW/缓存残留会把首次 /sync 卡死
// （表现为恒「正在连接」、邀请/新消息/删除全收不到）。启动时比对上次的前端版本，
// 变了就注销旧 SW、清 CacheStorage，一次性自愈，不用用户手动清数据。
import { SIYU_VERSION } from './version';

const healStaleWebViewData = async (): Promise<void> => {
  try {
    const STAMP_KEY = 'siyu-frontend-version';
    if (localStorage.getItem(STAMP_KEY) === SIYU_VERSION) return;
    localStorage.setItem(STAMP_KEY, SIYU_VERSION);
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister().catch(() => false)));
    }
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k).catch(() => false)));
    }
    // 旧 SW 还控制着本页时，清完重载一次让新资源接管（sessionStorage 防重载循环）
    if (
      navigator.serviceWorker?.controller &&
      !sessionStorage.getItem('siyu-heal-reloaded')
    ) {
      sessionStorage.setItem('siyu-heal-reloaded', '1');
      window.location.reload();
    }
  } catch {
    /* 自愈失败不阻塞启动 */
  }
};

// Register Service Worker
if ('serviceWorker' in navigator) {
  const swUrl =
    import.meta.env.MODE === 'production'
      ? `${trimTrailingSlash(import.meta.env.BASE_URL)}/sw.js`
      : `/dev-sw.js?dev-sw`;

  const sendSessionToSW = () => {
    const session = getFallbackSession();
    pushSessionToSW(session?.baseUrl, session?.accessToken);
  };

  const registerSW = () => {
    navigator.serviceWorker.register(swUrl).then(sendSessionToSW);
    navigator.serviceWorker.ready.then(sendSessionToSW);
  };
  healStaleWebViewData().then(registerSW, registerSW);

  navigator.serviceWorker.addEventListener('message', (ev) => {
    const { type } = ev.data ?? {};

    if (type === 'requestSession') {
      sendSessionToSW();
    }
  });
}

const mountApp = () => {
  const rootContainer = document.getElementById('root');

  if (rootContainer === null) {
    console.error('Root container element not found!');
    return;
  }

  const root = createRoot(rootContainer);
  root.render(<App />);
  // 隐藏启动闪屏
  if (typeof (window as any).__hideSiyuSplash === 'function') {
    // 等首屏渲染一帧后再隐藏，避免闪白
    requestAnimationFrame(() => {
      setTimeout(() => (window as any).__hideSiyuSplash(), 100);
    });
  }
};

mountApp();
