import React from 'react';
import { Room } from 'matrix-js-sdk';
import { Avatar, Chip, Icon, Icons, Text } from 'folds';
import { useAtomValue } from 'jotai';
import { useRoomName } from '../../hooks/useRoomMeta';
import { RoomAvatar } from '../../components/room-avatar';
import { roomToParentsAtom } from '../../state/room/roomToParents';
import { getAllParents, getRoomAvatarUrl, guessPerfectParent } from '../../utils/room';
import { nameInitials } from '../../utils/common';
import { useMediaAuthentication } from '../../hooks/useMediaAuthentication';
import { useOrphanSpaces } from '../../state/hooks/roomList';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { allRoomsAtom } from '../../state/room-list/roomList';
import { mDirectAtom } from '../../state/mDirectList';
import { useAllJoinedRoomsSet, useGetRoom } from '../../hooks/useGetRoom';
import { useRoomNavigate } from '../../hooks/useRoomNavigate';

type CallRoomNameProps = {
  room: Room;
};
export function CallRoomName({ room }: CallRoomNameProps) {
  const mx = useMatrixClient();
  const useAuthentication = useMediaAuthentication();
  const name = useRoomName(room);
  const roomToParents = useAtomValue(roomToParentsAtom);
  const orphanSpaces = useOrphanSpaces(mx, allRoomsAtom, roomToParents);
  const mDirects = useAtomValue(mDirectAtom);
  const dm = mDirects.has(room.roomId);

  const allRoomsSet = useAllJoinedRoomsSet();
  const getRoom = useGetRoom(allRoomsSet);

  const allParents = getAllParents(roomToParents, room.roomId);
  const orphanParents = allParents && orphanSpaces.filter((o) => allParents.has(o));
  const perfectOrphanParent = orphanParents && guessPerfectParent(mx, room.roomId, orphanParents);

  const { navigateRoom } = useRoomNavigate();

  return (
    <Chip
      variant="Background"
      radii="Pill"
      before={
        dm ? (
          <Icon size="200" src={Icons.VolumeHigh} filled />
        ) : (
          <Avatar size="200" radii="400">
            <RoomAvatar
              roomId={room.roomId}
              src={getRoomAvatarUrl(mx, room, 96, useAuthentication)}
              alt={name}
              renderFallback={() => (
                <Text as="span" size="H6">
                  {nameInitials(name)}
                </Text>
              )}
            />
          </Avatar>
        )
      }
      onClick={() => navigateRoom(room.roomId)}
    >
      <Text size="L400" truncate>
        {name}
        {!dm && perfectOrphanParent && (
          <Text as="span" size="T200" priority="300">
            {' •'} <b>{getRoom(perfectOrphanParent)?.name ?? perfectOrphanParent}</b>
          </Text>
        )}
      </Text>
    </Chip>
  );
}
