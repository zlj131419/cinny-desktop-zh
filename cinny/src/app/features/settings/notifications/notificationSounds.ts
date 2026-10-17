import DefaultSound from '../../../../../public/sound/notification.ogg';
import CrispSound from '../../../../../public/sound/notify-crisp.wav';
import SoftSound from '../../../../../public/sound/notify-soft.wav';
import UrgentSound from '../../../../../public/sound/notify-urgent.wav';
import BubbleSound from '../../../../../public/sound/notify-bubble.wav';

export interface NotificationSoundOption {
  id: string;
  name: string;
  src: string;
}

export const NOTIFICATION_SOUNDS: NotificationSoundOption[] = [
  { id: 'default', name: '默认', src: DefaultSound },
  { id: 'crisp', name: '清脆', src: CrispSound },
  { id: 'soft', name: '柔和', src: SoftSound },
  { id: 'urgent', name: '急促', src: UrgentSound },
  { id: 'bubble', name: '气泡', src: BubbleSound },
];

export const getNotificationSoundSrc = (id: string): string => {
  const found = NOTIFICATION_SOUNDS.find((s) => s.id === id);
  return found ? found.src : DefaultSound;
};
