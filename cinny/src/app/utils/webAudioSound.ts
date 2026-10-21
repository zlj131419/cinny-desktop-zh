// 提示音播放器（Web Audio API）。
//
// 为什么不用 <audio> 元素：iOS 会把任何用 <audio>/new Audio() 播过声音的网页
// 登记成「正在播放媒体」，提示音只有不到一秒、播完就没了，但灵动岛和控制
// 中心会残留一张 0:00、点播放无反应的假播放卡；这个假媒体会话还可能干扰
// 系统对推送通知发声的判断。Web Audio（AudioContext 解码播放）不向系统
// 登记媒体会话，播完干净消失，从根上避开这个问题。

let audioCtx: AudioContext | null = null;
const bufferCache = new Map<string, Promise<AudioBuffer>>();

const getAudioContext = (): AudioContext | null => {
  if (typeof window === 'undefined') return null;
  const AC =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!audioCtx) audioCtx = new AC();
  return audioCtx;
};

const loadBuffer = (ctx: AudioContext, src: string): Promise<AudioBuffer> => {
  let pending = bufferCache.get(src);
  if (!pending) {
    pending = fetch(src)
      .then((res) => res.arrayBuffer())
      .then((data) => ctx.decodeAudioData(data));
    bufferCache.set(src, pending);
    // 解码失败不缓存，允许下次重试
    pending.catch(() => bufferCache.delete(src));
  }
  return pending;
};

/** 播放一次提示音；失败静默（提示音是增强项，不能打断主流程）。 */
export const playWebAudioSound = async (src: string): Promise<void> => {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    if (ctx.state === 'suspended') await ctx.resume();
    const buffer = await loadBuffer(ctx, src);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start();
  } catch {
    // 忽略：自动播放策略拦截或解码失败时不报错
  }
};

let unlockInited = false;

/**
 * 首次用户手势时创建并 resume AudioContext，替代旧的
 * 「静音预播一遍 <audio> 解锁」hack（自动播放策略要求手势内激活音频上下文）。
 */
export const initWebAudioUnlock = () => {
  if (unlockInited || typeof window === 'undefined') return;
  unlockInited = true;
  const unlock = () => {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      void ctx.resume().catch(() => undefined);
    }
    if (ctx.state === 'running') {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    }
  };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
};
