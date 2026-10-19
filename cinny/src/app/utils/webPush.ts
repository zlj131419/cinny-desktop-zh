/**
 * Web Push 推送订阅工具（PWA 后台通知）
 * 流程：订阅浏览器推送服务 -> 拿到 endpoint -> 注册到 Matrix 服务器
 * Matrix 服务器收到消息 -> 推送网关(Sygnal) -> 浏览器推送服务 -> service worker 显示通知
 */

// VAPID 公钥（公开的，客户端用）
const VAPID_PUBLIC_KEY = 'BHz8zR5ftN1djsPQCM4DQjbt5MZ-oZ7jIRywwQ19whTPROc69VXs1kjKTTl9GkcoZ_uPwBY54_l0b-ztgp0WCf0';

// 推送网关地址（Sygnal，部署后填实际地址）
export const PUSH_GATEWAY_URL = 'https://chat.xxqw.net/_matrix/push/v1/notify';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function isWebPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export async function getPushSubscription(): Promise<PushSubscription | null> {
  if (!isWebPushSupported()) return null;
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

export async function subscribeWebPush(): Promise<PushSubscription> {
  if (!isWebPushSupported()) {
    throw new Error('当前浏览器不支持 Web Push');
  }

  // 请求通知权限
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('通知权限被拒绝');
  }

  const registration = await navigator.serviceWorker.ready;

  // 已有订阅直接返回
  const existing = await registration.pushManager.getSubscription();
  if (existing) return existing;

  // 新订阅
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as unknown as ArrayBuffer,
  });

  return subscription;
}

export async function unsubscribeWebPush(): Promise<boolean> {
  const subscription = await getPushSubscription();
  if (subscription) {
    return subscription.unsubscribe();
  }
  return true;
}

/**
 * 把推送订阅注册到 Matrix 服务器
 * @param mx Matrix 客户端
 * @param subscription 浏览器推送订阅
 */
export async function registerMatrixPusher(mx: any, subscription: PushSubscription): Promise<void> {
  const subscriptionJson = subscription.toJSON();
  // pushkey 用 endpoint，data 里带上订阅的 keys（Sygnal 需要）
  await mx.setPusher({
    kind: 'http',
    app_id: 'chat.xxqw.net.siyu',
    pushkey: subscription.endpoint,
    app_display_name: '私语 Siyu',
    device_display_name: '网页推送',
    lang: 'zh',
    data: {
      url: PUSH_GATEWAY_URL,
      format: 'event_id_only',
    },
    append: true,
  });
}

/**
 * 从 Matrix 服务器注销推送
 */
export async function unregisterMatrixPusher(mx: any, subscription: PushSubscription): Promise<void> {
  await mx.setPusher({
    kind: null,
    app_id: 'chat.xxqw.net.siyu',
    pushkey: subscription.endpoint,
  } as any);
}
