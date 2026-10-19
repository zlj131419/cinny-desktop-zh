import { useAtomValue } from 'jotai';
import { allRoomsAtom } from '../../../state/room-list/roomList';

export const useAllRooms = (): string[] => {
  const allRoomIds = useAtomValue(allRoomsAtom);
  // 确保返回的是字符串数组
  if (!Array.isArray(allRoomIds)) return [];
  return allRoomIds.filter((id) => typeof id === 'string' && id.length > 0);
};
