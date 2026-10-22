/* eslint-disable jsx-a11y/media-has-caption */
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Box, Icon, IconButton, Icons, Spinner, Text, color, toRem } from 'folds';
import { EncryptedAttachmentInfo } from 'browser-encrypt-attachment';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import { AsyncStatus, useAsyncCallback } from '../../../hooks/useAsyncCallback';
import { IAudioInfo } from '../../../../types/matrix/common';
import {
  PlayTimeCallback,
  useMediaLoading,
  useMediaPlay,
  useMediaPlayTimeCallback,
  useMediaSeek,
} from '../../../hooks/media';
import { useThrottle } from '../../../hooks/useThrottle';
import { secondsToMinutesAndSeconds } from '../../../utils/common';
import {
  decryptFile,
  downloadEncryptedMedia,
  downloadMedia,
  mxcUrlToHttp,
} from '../../../utils/matrix';
import { useMediaAuthentication } from '../../../hooks/useMediaAuthentication';

/**
 * 语音消息播放条（Element/微信风格）：圆形播放按钮 + 波形条 + 时长。
 * 波形优先用消息自带的 MSC1767 waveform；没有时按媒体地址生成稳定的伪波形。
 * 点击波形可跳转进度。仅用于带语音标记的消息，普通音频文件仍走 AudioContent。
 */

const BAR_COUNT = 36;

const toBars = (waveform: number[] | undefined, seedStr: string): number[] => {
  if (waveform && waveform.length > 0) {
    const bars: number[] = [];
    for (let i = 0; i < BAR_COUNT; i += 1) {
      const start = Math.floor((i * waveform.length) / BAR_COUNT);
      const end = Math.max(start + 1, Math.floor(((i + 1) * waveform.length) / BAR_COUNT));
      let max = 0;
      for (let j = start; j < end && j < waveform.length; j += 1) {
        max = Math.max(max, waveform[j]);
      }
      bars.push(Math.max(0.14, Math.min(1, max / 1024)));
    }
    return bars;
  }
  let seed = 7;
  for (let i = 0; i < seedStr.length; i += 1) {
    seed = (seed * 31 + seedStr.charCodeAt(i)) >>> 0;
  }
  const bars: number[] = [];
  for (let i = 0; i < BAR_COUNT; i += 1) {
    seed = (seed * 1103515245 + 12345) >>> 0;
    const r = (seed % 1000) / 1000;
    bars.push(0.18 + r * 0.72 * (0.55 + 0.45 * Math.abs(Math.sin(i / 3.1))));
  }
  return bars;
};

export type VoiceMessageContentProps = {
  mimeType: string;
  url: string;
  info: IAudioInfo;
  encInfo?: EncryptedAttachmentInfo;
  waveform?: number[];
};

export function VoiceMessageContent({
  mimeType,
  url,
  info,
  encInfo,
  waveform,
}: VoiceMessageContentProps) {
  const mx = useMatrixClient();
  const useAuthentication = useMediaAuthentication();

  const [srcState, loadSrc] = useAsyncCallback(
    useCallback(async () => {
      const mediaUrl = mxcUrlToHttp(mx, url, useAuthentication);
      if (!mediaUrl) throw new Error('Invalid media URL');
      const fileContent = encInfo
        ? await downloadEncryptedMedia(mediaUrl, (encBuf) => decryptFile(encBuf, mimeType, encInfo))
        : await downloadMedia(mediaUrl);
      return URL.createObjectURL(fileContent);
    }, [mx, url, useAuthentication, mimeType, encInfo])
  );

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const infoDuration = info.duration ?? 0;
  const [duration, setDuration] = useState((infoDuration >= 0 ? infoDuration : 0) / 1000);

  const getAudioRef = useCallback(() => audioRef.current, []);
  const { loading } = useMediaLoading(getAudioRef);
  const { playing, setPlaying } = useMediaPlay(getAudioRef);
  const { seek } = useMediaSeek(getAudioRef);
  const handlePlayTimeCallback: PlayTimeCallback = useCallback((d, ct) => {
    setDuration(d);
    setCurrentTime(ct);
  }, []);
  useMediaPlayTimeCallback(
    getAudioRef,
    useThrottle(handlePlayTimeCallback, { wait: 250, immediate: true })
  );

  const bars = useMemo(() => toBars(waveform, url), [waveform, url]);
  const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0;
  // 微信式：时长越长条越宽
  const barWidth = 132 + Math.min(duration || 0, 60) * 2.4;

  const handlePlay = () => {
    if (srcState.status === AsyncStatus.Success) {
      setPlaying(!playing);
    } else if (srcState.status !== AsyncStatus.Loading) {
      loadSrc();
    }
  };

  const handleWaveformClick = (evt: React.MouseEvent<HTMLDivElement>) => {
    if (srcState.status !== AsyncStatus.Success || duration <= 0) return;
    const rect = evt.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (evt.clientX - rect.left) / rect.width));
    seek(ratio * duration);
  };

  const busy = srcState.status === AsyncStatus.Loading || loading;

  return (
    <Box
      alignItems="Center"
      gap="200"
      style={{
        width: toRem(barWidth),
        maxWidth: '100%',
        padding: `${toRem(4)} ${toRem(8)} ${toRem(4)} ${toRem(4)}`,
      }}
    >
      <IconButton
        onClick={handlePlay}
        variant="Primary"
        size="300"
        radii="Pill"
        disabled={busy}
        aria-label={playing ? 'pause' : 'play'}
      >
        {busy ? (
          <Spinner size="100" variant="Primary" />
        ) : (
          <Icon src={playing ? Icons.Pause : Icons.Play} size="100" filled={playing} />
        )}
      </IconButton>
      <Box
        grow="Yes"
        alignItems="Center"
        gap="100"
        onClick={handleWaveformClick}
        style={{
          height: toRem(28),
          minWidth: 0,
          overflow: 'hidden',
          cursor: srcState.status === AsyncStatus.Success ? 'pointer' : 'default',
        }}
        aria-hidden
      >
        {bars.map((v, i) => {
          const played = i / BAR_COUNT <= progress && (playing || currentTime > 0);
          return (
            <div
              // eslint-disable-next-line react/no-array-index-key
              key={i}
              style={{
                flex: '1 1 0',
                minWidth: toRem(2),
                maxWidth: toRem(3),
                height: toRem(4 + v * 20),
                borderRadius: toRem(2),
                backgroundColor: played ? color.Primary.Container : 'rgba(127,127,127,0.55)',
              }}
            />
          );
        })}
      </Box>
      <Text size="T200" style={{ flexShrink: 0 }}>
        {currentTime > 0.5
          ? `${secondsToMinutesAndSeconds(currentTime)} / ${secondsToMinutesAndSeconds(duration)}`
          : secondsToMinutesAndSeconds(duration)}
      </Text>
      <audio controls={false} autoPlay ref={audioRef} style={{ display: 'none' }}>
        {srcState.status === AsyncStatus.Success && <source src={srcState.data} type={mimeType} />}
      </audio>
    </Box>
  );
}
