import { useEffect, useState } from 'react';
import { Room } from 'matrix-js-sdk';
import { useAdminService } from '../features/admin/useAdminService';

/**
 * 用服务端接口判断当前用户是否为房间创建者。
 * 服务端有数据库兜底（_db_room_creator），比客户端的 useRoomCreators 可靠。
 * 返回 { isCreator, loading }，loading 期间 isCreator 为 false（保守禁用）。
 */
export function useIsRoomCreator(room: Room): { isCreator: boolean; loading: boolean } {
  const { enabled, isRoomCreator } = useAdminService();
  const [result, setResult] = useState<boolean | null>(null);

  useEffect(() => {
    if (!enabled) {
      setResult(false);
      return;
    }
    let cancelled = false;
    setResult(null);
    isRoomCreator(room.roomId)
      .then((v) => {
        if (!cancelled) setResult(v);
      })
      .catch(() => {
        if (!cancelled) setResult(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, isRoomCreator, room.roomId]);

  return { isCreator: result === true, loading: result === null };
}
