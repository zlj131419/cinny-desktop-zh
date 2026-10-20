import React from 'react';
import classNames from 'classnames';
import {
  Avatar,
  Box,
  Header,
  Icon,
  IconButton,
  Icons,
  MenuItem,
  Scroll,
  Text,
  as,
  config,
} from 'folds';
import { Room } from 'matrix-js-sdk';
import { useRoomEventReaders } from '../../hooks/useRoomEventReaders';
import { getMemberDisplayName } from '../../utils/room';
import { getMxIdLocalPart } from '../../utils/matrix';
import * as css from './EventReaders.css';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { UserAvatar } from '../user-avatar';
import { useMediaAuthentication } from '../../hooks/useMediaAuthentication';
import { useOpenUserRoomProfile } from '../../state/hooks/userRoomProfile';
import { useSpaceOptionally } from '../../hooks/useSpace';
import { getMouseEventCords } from '../../utils/dom';
import { useTranslation } from 'react-i18next';

export type EventReadersProps = {
  room: Room;
  eventId: string;
  requestClose: () => void;
};
export const EventReaders = as<'div', EventReadersProps>(
  ({ className, room, eventId, requestClose, ...props }, ref) => {
    const mx = useMatrixClient();
    const useAuthentication = useMediaAuthentication();
    const latestEventReaders = useRoomEventReaders(room, eventId);
    const openProfile = useOpenUserRoomProfile();
    const space = useSpaceOptionally();
    const { t } = useTranslation();

    const getName = (userId: string) =>
      getMemberDisplayName(room, userId) ?? getMxIdLocalPart(userId) ?? userId;

    // 获取并格式化已读时间（年月日 + 时分）
    const getReadTime = (userId: string): string | undefined => {
      try {
        if (typeof userId !== 'string') return undefined;
        const receipt = room.getLastUnthreadedReceiptFor(userId);
        const ts = receipt?.ts;
        if (typeof ts !== 'number' || !ts) return undefined;
        const d = new Date(ts);
        const pad = (n: number) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
      } catch {
        return undefined;
      }
    };

    return (
      <Box
        className={classNames(css.EventReaders, className)}
        direction="Column"
        {...props}
        ref={ref}
      >
        <Header className={css.Header} variant="Surface" size="600">
          <Box grow="Yes">
            <Text size="H3">{t('components:event-readers.seen_by')}</Text>
          </Box>
          <IconButton size="300" onClick={requestClose}>
            <Icon src={Icons.Cross} />
          </IconButton>
        </Header>
        <Box grow="Yes">
          <Scroll visibility="Hover" hideTrack size="300">
            <Box className={css.Content} direction="Column">
              {latestEventReaders.map((readerId) => {
                const name = getName(readerId);
                const avatarMxcUrl = room.getMember(readerId)?.getMxcAvatarUrl();
                const avatarUrl = avatarMxcUrl
                  ? mx.mxcUrlToHttp(
                      avatarMxcUrl,
                      100,
                      100,
                      'crop',
                      undefined,
                      false,
                      useAuthentication
                    )
                  : undefined;

                return (
                  <MenuItem
                    key={readerId}
                    style={{ padding: `0 ${config.space.S200}` }}
                    radii="400"
                    onClick={(event) => {
                      openProfile(
                        room.roomId,
                        space?.roomId,
                        readerId,
                        getMouseEventCords(event.nativeEvent),
                        'Bottom'
                      );
                    }}
                    before={
                      <Avatar size="200">
                        <UserAvatar
                          userId={readerId}
                          src={avatarUrl ?? undefined}
                          alt={name}
                          renderFallback={() => (
                            <Text size="T200">
                              <b>{String(typeof name === "string" ? name : "?").charAt(0).toUpperCase()}</b>
                            </Text>
                          )}
                        />
                      </Avatar>
                    }
                  >
                    <Box direction="Column" style={{ flexGrow: 1, minWidth: 0 }}>
                      <Text size="T400" truncate>
                        {name}
                      </Text>
                      {getReadTime(readerId) && (
                        <Text size="T200" priority="400" truncate>
                          {getReadTime(readerId)}
                        </Text>
                      )}
                    </Box>
                  </MenuItem>
                );
              })}
            </Box>
          </Scroll>
        </Box>
      </Box>
    );
  }
);
