/// <reference lib="WebWorker" />

export type {};
declare const self: ServiceWorkerGlobalScope;

type SessionInfo = {
  accessToken: string;
  baseUrl: string;
};

/**
 * Store session per client (tab)
 */
const sessions = new Map<string, SessionInfo>();

const clientToResolve = new Map<string, (value: SessionInfo | undefined) => void>();
const clientToSessionPromise = new Map<string, Promise<SessionInfo | undefined>>();

async function cleanupDeadClients() {
  const activeClients = await self.clients.matchAll();
  const activeIds = new Set(activeClients.map((c) => c.id));

  Array.from(sessions.keys()).forEach((id) => {
    if (!activeIds.has(id)) {
      sessions.delete(id);
      clientToResolve.delete(id);
      clientToSessionPromise.delete(id);
    }
  });
}

function setSession(clientId: string, accessToken: any, baseUrl: any) {
  if (typeof accessToken === 'string' && typeof baseUrl === 'string') {
    sessions.set(clientId, { accessToken, baseUrl });
  } else {
    // Logout or invalid session
    sessions.delete(clientId);
  }

  const resolveSession = clientToResolve.get(clientId);
  if (resolveSession) {
    resolveSession(sessions.get(clientId));
    clientToResolve.delete(clientId);
    clientToSessionPromise.delete(clientId);
  }
}

function requestSession(client: Client): Promise<SessionInfo | undefined> {
  const promise =
    clientToSessionPromise.get(client.id) ??
    new Promise((resolve) => {
      clientToResolve.set(client.id, resolve);
      client.postMessage({ type: 'requestSession' });
    });

  if (!clientToSessionPromise.has(client.id)) {
    clientToSessionPromise.set(client.id, promise);
  }

  return promise;
}

async function requestSessionWithTimeout(
  clientId: string,
  timeoutMs = 3000
): Promise<SessionInfo | undefined> {
  const client = await self.clients.get(clientId);
  if (!client) return undefined;

  const sessionPromise = requestSession(client);

  const timeout = new Promise<undefined>((resolve) => {
    setTimeout(() => resolve(undefined), timeoutMs);
  });

  return Promise.race([sessionPromise, timeout]);
}

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event: ExtendableEvent) => {
  event.waitUntil(
    (async () => {
      await self.clients.claim();
      await cleanupDeadClients();
    })()
  );
});

/**
 * Receive session updates from clients
 */
self.addEventListener('message', (event: ExtendableMessageEvent) => {
  const client = event.source as Client | null;
  if (!client) return;

  const { type, accessToken, baseUrl } = event.data || {};

  if (type === 'setSession') {
    setSession(client.id, accessToken, baseUrl);
    cleanupDeadClients();
  }
});

const MEDIA_PATHS = ['/_matrix/client/v1/media/download', '/_matrix/client/v1/media/thumbnail'];

function mediaPath(url: string): boolean {
  try {
    const { pathname } = new URL(url);
    return MEDIA_PATHS.some((p) => pathname.startsWith(p));
  } catch {
    return false;
  }
}

function validMediaRequest(url: string, baseUrl: string): boolean {
  return MEDIA_PATHS.some((p) => {
    const validUrl = new URL(p, baseUrl);
    return url.startsWith(validUrl.href);
  });
}

function fetchConfig(token: string): RequestInit {
  return {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: 'default',
  };
}

self.addEventListener('fetch', (event: FetchEvent) => {
  const { url, method } = event.request;

  if (method !== 'GET' || !mediaPath(url)) return;

  const { clientId } = event;
  if (!clientId) return;

  const session = sessions.get(clientId);
  if (session) {
    if (validMediaRequest(url, session.baseUrl)) {
      event.respondWith(fetch(url, fetchConfig(session.accessToken)));
    }
    return;
  }

  event.respondWith(
    requestSessionWithTimeout(clientId).then((s) => {
      if (s && validMediaRequest(url, s.baseUrl)) {
        return fetch(url, fetchConfig(s.accessToken));
      }
      return fetch(event.request);
    })
  );
});

/**
 * Web Push 通知处理（PWA 后台推送）
 * 推送网关 -> 浏览器推送服务 -> service worker -> 显示通知
 */
self.addEventListener('push', (event: PushEvent) => {
  event.waitUntil(
    (async () => {
      let title = '私语 Siyu';
      let body = '你有一条新消息';
      let roomId: string | undefined;

      try {
        const data = event.data?.json();
        // Matrix 推送网关格式
        const notif = data?.notification;
        if (notif) {
          roomId = notif.room_id;
          const sender = notif.sender_display_name || notif.sender || '有人';
          if (notif.type === 'm.room.message' && notif.content) {
            const content = notif.content;
            body = content.body || content.msgtype || body;
            // 只显示文本前 100 字
            if (body.length > 100) body = body.slice(0, 100) + '…';
          } else if (notif.type === 'm.room.encrypted') {
            body = '加密消息';
          } else {
            body = notif.type || body;
          }
          title = `${sender}`;
        } else if (data?.title) {
          // 通用格式兜底
          title = data.title;
          body = data.body || body;
          roomId = data.roomId;
        }
      } catch {
        // 解析失败用默认文案
      }

      const options: NotificationOptions = {
        body,
        icon: '/public/siyu-icon-200.png',
        badge: '/public/siyu-icon-200.png',
        tag: roomId || 'siyu-message',
        renotify: true,
        data: { roomId },
      };

      await self.registration.showNotification(title, options);
    })()
  );
});

/**
 * 点击通知打开对应房间
 */
self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();
  const roomId = event.notification.data?.roomId;

  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });

      // 已有窗口则聚焦
      for (const client of clients) {
        if ('focus' in client) {
          await client.focus();
          if (roomId) {
            client.postMessage({ type: 'openRoom', roomId });
          }
          return;
        }
      }

      // 没有窗口则打开新窗口
      const url = roomId ? `/#/room/${encodeURIComponent(roomId)}` : '/';
      await self.clients.openWindow(url);
    })()
  );
});
