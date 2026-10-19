import { useAtomValue } from 'jotai';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import { allRoomsAtom } from '../../../state/room-list/roomList';

export const useAllRooms = () => {
  const mx = useMatrixClient();
  const allRoomIds = useAtomValue(allRoomsAtom);
  // 返回所有房间，按活动时间排序在组件里做
  return allRoomIds;
};
