import {
  as,
  Badge,
  Box,
  color,
  ContainerColor,
  MainColor,
  Text,
  Tooltip,
  TooltipProvider,
  toRem,
} from 'folds';
import React, { ReactNode, useId } from 'react';
import * as css from './styles.css';
import { Presence, usePresenceLabel, useUserPresence } from '../../hooks/useUserPresence';

const PresenceToColor: Record<Presence, MainColor> = {
  [Presence.Online]: 'Success',
  [Presence.Unavailable]: 'Warning',
  [Presence.Offline]: 'Secondary',
};

type PresenceBadgeProps = {
  presence: Presence;
  status?: string;
  size?: '200' | '300' | '400' | '500';
};
export function PresenceBadge({ presence, status, size }: PresenceBadgeProps) {
  const label = usePresenceLabel();
  const badgeLabelId = useId();

  return (
    <TooltipProvider
      position="Right"
      align="Center"
      offset={4}
      delay={200}
      tooltip={
        <Tooltip id={badgeLabelId}>
          <Box style={{ maxWidth: toRem(250) }} alignItems="Baseline" gap="100">
            <Text size="L400">{label[presence]}</Text>
            {status && <Text size="T200">•</Text>}
            {status && <Text size="T200">{status}</Text>}
          </Box>
        </Tooltip>
      }
    >
      {(triggerRef) => (
        <Badge
          aria-labelledby={badgeLabelId}
          ref={triggerRef}
          size={size}
          variant={PresenceToColor[presence]}
          fill={presence === Presence.Offline ? 'Soft' : 'Solid'}
          radii="Pill"
        />
      )}
    </TooltipProvider>
  );
}

type PresenceAvatarProps = {
  userId?: string;
  children: ReactNode;
};
/**
 * 给“人”的头像右下角加在线状态点（参照 Element）：在线绿、忙碌黄、离线灰。
 * userId 为空时原样渲染，不加包装。状态走 Matrix presence，实时订阅更新。
 */
export function PresenceAvatar({ userId, children }: PresenceAvatarProps) {
  const presence = useUserPresence(userId ?? '');
  if (!userId) return <>{children}</>;
  return (
    <AvatarPresence
      badge={
        presence ? (
          <PresenceBadge presence={presence.presence} status={presence.status} size="200" />
        ) : undefined
      }
    >
      {children}
    </AvatarPresence>
  );
}

type AvatarPresenceProps = {
  badge: ReactNode;
  variant?: ContainerColor;
};
export const AvatarPresence = as<'div', AvatarPresenceProps>(
  ({ as: AsAvatarPresence, badge, variant = 'Surface', children, ...props }, ref) => (
    <Box as={AsAvatarPresence} className={css.AvatarPresence} {...props} ref={ref}>
      {badge && (
        <div
          className={css.AvatarPresenceBadge}
          style={{ backgroundColor: color[variant].Container }}
        >
          {badge}
        </div>
      )}
      {children}
    </Box>
  )
);
