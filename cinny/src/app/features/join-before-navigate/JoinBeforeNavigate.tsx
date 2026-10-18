import React from 'react';
import { useAtomValue } from 'jotai';
import { Navigate } from 'react-router-dom';
import { isRoomAlias, isRoomId } from '../../utils/matrix';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { mDirectAtom } from '../../state/mDirectList';
import { getDirectRoomPath, getHomeRoomPath, getSpacePath } from '../../pages/pathUtils';

type JoinBeforeNavigateProps = { roomIdOrAlias: string; eventId?: string; viaServers?: string[] };

/**
 * 加入前导航：用户点接受邀请后，直接进房间，不闪报错页。
 * - 非法 ID：回首页
 * - 已加入：按房间类型直接跳转（无 UI，不闪）
 * - 未加入/其他：回首页（邀请接受流程由邀请列表处理，不在这里自动 join）
 */
export function JoinBeforeNavigate({ roomIdOrAlias }: JoinBeforeNavigateProps) {
  const mx = useMatrixClient();
  const mDirects = useAtomValue(mDirectAtom);

  // 非法房间 ID/别名：回首页
  if (!isRoomId(roomIdOrAlias) && !isRoomAlias(roomIdOrAlias)) {
    return <Navigate to="/" replace />;
  }

  // 已加入的房间：直接按类型跳转，不渲染任何 UI
  if (isRoomId(roomIdOrAlias)) {
    const room = mx.getRoom(roomIdOrAlias);
    if (room && room.getMyMembership() === 'join') {
      let targetPath: string;
      if (room.isSpaceRoom()) {
        targetPath = getSpacePath(room.roomId);
      } else {
        const isDM = Object.values(mDirects).flat().includes(room.roomId);
        targetPath = isDM ? getDirectRoomPath(room.roomId) : getHomeRoomPath(room.roomId);
      }
      return <Navigate to={targetPath} replace />;
    }
  }

  // 未加入或房间不存在：回首页，不展示报错页
  // （邀请的接受/拒绝由邀请列表 UI 处理，这里不自动 join）
  return <Navigate to="/" replace />;
}
