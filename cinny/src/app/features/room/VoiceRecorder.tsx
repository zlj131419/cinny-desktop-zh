import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Icon, IconButton, Icons, Text, color, toRem } from 'folds';
import { useTranslation } from 'react-i18next';

/**
 * 语音录音条（参照 Element 的语音消息交互）：
 * 点麦克风后替换输入框——录音中显示红点、计时与实时波形；
 * 停止后进入预览：可试听、删除或发送。波形按 MSC1767 采样（0..1024），
 * 随消息一起发出，接收端渲染成 Element 同款语音条。
 * 录音产物是一个普通 File，发送走现有的附件上传管线（加密房自动加密）。
 */

const MAX_DURATION_S = 600; // 最长 10 分钟，自动停止进预览
const MAX_SAMPLES = 100;

const MIME_CANDIDATES: Array<{ mime: string; ext: string }> = [
  { mime: 'audio/ogg;codecs=opus', ext: 'ogg' },
  { mime: 'audio/webm;codecs=opus', ext: 'webm' },
  { mime: 'audio/webm', ext: 'webm' },
  { mime: 'audio/mp4', ext: 'm4a' },
];

const pickMime = (): { mime?: string; ext: string } => {
  for (const c of MIME_CANDIDATES) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(c.mime)) {
      return c;
    }
  }
  return { ext: 'webm' };
};

// ===== 格式统一：录音一律转码为 WAV(16kHz 单声道 PCM) 再发送 =====
// 各浏览器 MediaRecorder 产物不同（Chrome=webm/opus、Safari=mp4/aac），跨平台播不了；
// WAV 所有平台与 WebView 都能解码。转码失败时回退发送原始录音，不丢消息。

const TARGET_SAMPLE_RATE = 16000;

const encodeWav = (buffer: AudioBuffer): Blob => {
  const channel = buffer.getChannelData(0);
  const bytes = 44 + channel.length * 2;
  const ab = new ArrayBuffer(bytes);
  const view = new DataView(ab);
  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i += 1) view.setUint8(off + i, s.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, bytes - 8, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, channel.length * 2, true);
  let off = 44;
  for (let i = 0; i < channel.length; i += 1, off += 2) {
    const s = Math.max(-1, Math.min(1, channel[i]));
    view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([ab], { type: 'audio/wav' });
};

const waveformFromBuffer = (buffer: AudioBuffer): number[] => {
  const channel = buffer.getChannelData(0);
  const out: number[] = [];
  const bucket = Math.max(1, Math.floor(channel.length / MAX_SAMPLES));
  for (let i = 0; i < channel.length; i += bucket) {
    let peak = 0;
    for (let j = i; j < Math.min(i + bucket, channel.length); j += 1) {
      peak = Math.max(peak, Math.abs(channel[j]));
    }
    out.push(Math.round(Math.min(1, peak * 1.4) * 1024));
    if (out.length >= MAX_SAMPLES) break;
  }
  return out;
};

const transcodeToWav = async (
  blob: Blob
): Promise<{ blob: Blob; durationMs: number; waveform: number[] }> => {
  const AC: typeof AudioContext | undefined =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) throw new Error('no AudioContext');
  const decodeCtx = new AC();
  try {
    const decoded = await decodeCtx.decodeAudioData(await blob.arrayBuffer());
    let finalBuffer = decoded;
    if (decoded.sampleRate !== TARGET_SAMPLE_RATE && typeof OfflineAudioContext !== 'undefined') {
      const len = Math.ceil((decoded.duration * TARGET_SAMPLE_RATE) / 1);
      const offline = new OfflineAudioContext(1, len, TARGET_SAMPLE_RATE);
      const src = offline.createBufferSource();
      src.buffer = decoded;
      src.connect(offline.destination);
      src.start();
      finalBuffer = await offline.startRendering();
    }
    return {
      blob: encodeWav(finalBuffer),
      durationMs: Math.round(finalBuffer.duration * 1000),
      waveform: waveformFromBuffer(finalBuffer),
    };
  } finally {
    void decodeCtx.close().catch(() => undefined);
  }
};

const formatTime = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
};

function Waveform({ samples, height = 28 }: { samples: number[]; height?: number }) {
  return (
    <Box
      grow="Yes"
      alignItems="Center"
      gap="100"
      style={{ height: toRem(height), overflow: 'hidden' }}
      aria-hidden
    >
      {samples.length === 0 && (
        <div
          style={{
            width: toRem(3),
            height: toRem(4),
            borderRadius: toRem(2),
            backgroundColor: 'rgba(127,127,127,0.55)',
          }}
        />
      )}
      {samples.map((v, i) => (
        <div
          // eslint-disable-next-line react/no-array-index-key
          key={i}
          style={{
            flexShrink: 0,
            width: toRem(3),
            height: toRem(4 + v * (height - 6)),
            borderRadius: toRem(2),
            backgroundColor: 'rgba(127,127,127,0.85)',
          }}
        />
      ))}
    </Box>
  );
}

type VoiceRecorderBarProps = {
  onCancel: () => void;
  onSend: (file: File, durationMs: number, waveform: number[]) => void;
};

export function VoiceRecorderBar({ onCancel, onSend }: VoiceRecorderBarProps) {
  const { t } = useTranslation();
  const [phase, setPhase] = useState<'starting' | 'recording' | 'processing' | 'preview' | 'error'>(
    'starting'
  );
  const [elapsed, setElapsed] = useState(0);
  const [samples, setSamples] = useState<number[]>([]);
  const [playing, setPlaying] = useState(false);

  const streamRef = useRef<MediaStream>();
  const recorderRef = useRef<MediaRecorder>();
  const chunksRef = useRef<Blob[]>([]);
  const audioCtxRef = useRef<AudioContext>();
  const timersRef = useRef<number[]>([]);
  const startedAtRef = useRef(0);
  const samplesRef = useRef<number[]>([]);
  const fileRef = useRef<File>();
  const processedWaveformRef = useRef<number[]>();
  const previewUrlRef = useRef<string>();
  const audioRef = useRef<HTMLAudioElement>(null);
  const sentRef = useRef(false);

  const cleanupCapture = useCallback(() => {
    timersRef.current.forEach((id) => window.clearInterval(id));
    timersRef.current = [];
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = undefined;
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      void audioCtxRef.current.close().catch(() => undefined);
    }
    audioCtxRef.current = undefined;
  }, []);

  // 组件卸载时兜底释放麦克风（发送后文件已交出去，不受影响）
  useEffect(
    () => () => {
      cleanupCapture();
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    },
    [cleanupCapture]
  );

  const pushSample = useCallback((v: number) => {
    let arr = samplesRef.current;
    if (arr.length >= MAX_SAMPLES) {
      // 超过采样上限就降采样一半（Element 同款做法），保持整体形状
      arr = arr.filter((_, i) => i % 2 === 0);
    }
    arr = [...arr, v];
    samplesRef.current = arr;
    setSamples(arr);
  }, []);

  const stopToPreview = useCallback(() => {
    const rec = recorderRef.current;
    if (rec && rec.state !== 'inactive') {
      rec.stop(); // onstop 里生成文件并切预览
    }
    timersRef.current.forEach((id) => window.clearInterval(id));
    timersRef.current = [];
  }, []);

  useEffect(() => {
    let disposed = false;
    const start = async () => {
      try {
        if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
          throw new Error('unsupported');
        }
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (disposed) {
          stream.getTracks().forEach((tr) => tr.stop());
          return;
        }
        streamRef.current = stream;
        const { mime, ext } = pickMime();
        const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
        recorderRef.current = rec;
        chunksRef.current = [];
        rec.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };
        rec.onstop = () => {
          const type = rec.mimeType || mime || 'audio/webm';
          const rawBlob = new Blob(chunksRef.current, { type });
          stream.getTracks().forEach((tr) => tr.stop());
          if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
            void audioCtxRef.current.close().catch(() => undefined);
          }
          setPhase('processing');
          void (async () => {
            try {
              // 统一转码 WAV，并以解码数据为准重算时长与波形
              const out = await transcodeToWav(rawBlob);
              fileRef.current = new File([out.blob], `voice-${Date.now()}.wav`, {
                type: 'audio/wav',
              });
              processedWaveformRef.current = out.waveform;
              previewUrlRef.current = URL.createObjectURL(out.blob);
              setElapsed(out.durationMs / 1000);
            } catch {
              // 转码失败回退原始录音，保证消息不丢
              fileRef.current = new File([rawBlob], `voice-${Date.now()}.${ext}`, { type });
              previewUrlRef.current = URL.createObjectURL(rawBlob);
            }
            setPhase('preview');
          })();
        };
        startedAtRef.current = Date.now();
        rec.start(250);
        setPhase('recording');

        // 实时波形采样
        const AC: typeof AudioContext | undefined =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (AC) {
          const ctx = new AC();
          audioCtxRef.current = ctx;
          const source = ctx.createMediaStreamSource(stream);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 64;
          source.connect(analyser);
          const data = new Uint8Array(analyser.fftSize);
          const sampleTimer = window.setInterval(() => {
            analyser.getByteTimeDomainData(data);
            let peak = 0;
            data.forEach((v) => {
              peak = Math.max(peak, Math.abs(v - 128) / 128);
            });
            pushSample(Math.min(1, peak * 1.5));
          }, 100);
          timersRef.current.push(sampleTimer);
        }
        const clockTimer = window.setInterval(() => {
          const s = (Date.now() - startedAtRef.current) / 1000;
          setElapsed(s);
          if (s >= MAX_DURATION_S) stopToPreview();
        }, 250);
        timersRef.current.push(clockTimer);
      } catch {
        if (!disposed) setPhase('error');
      }
    };
    void start();
    return () => {
      disposed = true;
    };
  }, [pushSample, stopToPreview]);

  const handleDelete = () => {
    cleanupCapture();
    onCancel();
  };

  const handleSend = () => {
    const file = fileRef.current;
    if (!file) return;
    sentRef.current = true;
    const durationMs = Math.round(elapsed * 1000);
    const waveform =
      processedWaveformRef.current ?? samplesRef.current.map((v) => Math.round(v * 1024));
    cleanupCapture();
    onSend(file, durationMs, waveform);
  };

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      void audio.play();
      setPlaying(true);
    } else {
      audio.pause();
      setPlaying(false);
    }
  };

  return (
    <Box
      alignItems="Center"
      gap="300"
      style={{
        backgroundColor: color.Surface.Container,
        borderRadius: toRem(8),
        padding: `${toRem(6)} ${toRem(10)}`,
        minHeight: toRem(52),
      }}
    >
      <IconButton
        onClick={handleDelete}
        variant="SurfaceVariant"
        size="300"
        radii="300"
        aria-label={t('features:room.voice_delete')}
      >
        <Icon src={Icons.Delete} />
      </IconButton>

      {phase === 'error' ? (
        <Text size="T300" style={{ flex: 1 }}>
          {t('features:room.voice_mic_error')}
        </Text>
      ) : phase === 'preview' ? (
        <>
          <IconButton
            onClick={togglePlay}
            variant="Primary"
            size="300"
            radii="Pill"
            aria-label={playing ? 'pause' : 'play'}
          >
            <Icon src={playing ? Icons.Pause : Icons.Play} size="100" />
          </IconButton>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <audio
            ref={audioRef}
            src={previewUrlRef.current}
            onEnded={() => setPlaying(false)}
            style={{ display: 'none' }}
          />
          <Waveform samples={samples} />
          <Text size="T300">{formatTime(elapsed)}</Text>
          <IconButton
            onClick={handleSend}
            variant="Primary"
            size="300"
            radii="300"
            aria-label={t('features:room.voice_send')}
          >
            <Icon src={Icons.Send} />
          </IconButton>
        </>
      ) : (
        <>
          <span
            style={{
              width: toRem(10),
              height: toRem(10),
              borderRadius: '50%',
              backgroundColor: '#e5484d',
              flexShrink: 0,
              animation: 'siyu-rec-pulse 1.2s ease-in-out infinite',
            }}
          />
          <style>{'@keyframes siyu-rec-pulse { 0%,100% { opacity: 1 } 50% { opacity: 0.25 } }'}</style>
          <Text size="T300" style={{ flexShrink: 0 }}>
            {phase === 'processing'
              ? t('features:room.voice_processing')
              : `${t('features:room.voice_recording')} ${formatTime(elapsed)}`}
          </Text>
          <Waveform samples={samples} />
          <IconButton
            onClick={stopToPreview}
            variant="SurfaceVariant"
            size="300"
            radii="300"
            aria-label={t('features:room.voice_stop')}
            disabled={phase !== 'recording'}
          >
            <span
              style={{
                width: toRem(11),
                height: toRem(11),
                backgroundColor: '#e5484d',
                borderRadius: toRem(2),
                display: 'block',
              }}
            />
          </IconButton>
        </>
      )}
    </Box>
  );
}
