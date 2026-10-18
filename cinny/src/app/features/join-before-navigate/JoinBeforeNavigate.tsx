import React, { useEffect, useState } from 'react';
import { useAtomValue } from 'jotai';
import { Navigate } from 'react-router-dom';
import { isRoomAlias, isRoomId } from '../../utils/matrix';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { mDirectAtom } from '../../state/mDirectList';
import { getDirectRoomPath, getHomeRoomPath, getSpacePath } from '../../pages/pathUtils';

type JoinBeforeNavigateProps = { roomIdOrAlias: string; eventId?: string; viaServers?: string[] };
export function JoinBeforeNavigate({
  roomIdOrAlias,
  eventId,
}: JoinBeforeNavigateProps) {
  const mx = useMatrixClient();
  const mDirects = useAtomValue(mDirectAtom);
  const [target, setTarget] = useState<string | null>(null);

  // 非法房间 ID/别名：直接回首页
  if (!isRoomId(roomIdOrAlias) && !isRoomAlias(roomIdOrAlias)) {
    return <Navigate to="/" replace />;
  }

  useEffect(() => {
    const goToRoom = (roomId: string) => {
      const room = mx.getRoom(roomId);
      if (!room) {
        setTarget('/');
        return;
      }
      let path: string;
      if (room.isSpaceRoom()) {
        path = getSpacePath(roomId);
      } else {
        const isDM = Object.values(mDirects).flat().includes(roomId);
        path = isDM ? getDirectRoomPath(roomId) : getHomeRoomPath(roomId);
      }
      setTarget(path);
    };

    if (!isRoomId(roomIdOrAlias)) {
      setTarget('/');
      return;
    }

    const roomId = roomIdOrAlias;
    const room = mx.getRoom(roomId);
    const membership = room?.getMyMembership();

    // 已加入：直接进房间
    if (membership === 'join') {
      goToRoom(roomId);
      return;
    }

    // 受邀：自动接受邀请后进房间
    if (membership === 'invite') {
      mx.joinRoom(roomId)
        .then(() => goToRoom(roomId))
        .catch(() => setTarget('/'));
      return;
    }

    // 其他情况：回首页，不展示任何报错页
    // 等待房间同步，最多等 3 秒
    const timer = setTimeout(() => setTarget('/'), 3000);
    const checkInterval = setInterval(() => {
      const r = mx.getRoom(roomId);
      if (r && r.getMyMembership() === 'join') {
        clearTimeout(timer);
        clearInterval(checkInterval);
        goToRoom(roomId);
      }
    }, 500);

    return () => {
      clearTimeout(timer);
      clearInterval(checkInterval);
    };
  }, [mx, roomIdOrAlias, mDirects]);

  if (target) {
    return <Navigate to={target} replace />;
  }

  // 加载中：不渲染任何 UI，避免报错页闪现
  return null;
}
