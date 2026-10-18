import React from 'react';
import { Box, Icon, IconButton, Icons, Scroll, Text, toRem } from 'folds';
import { useAtomValue } from 'jotai';
import { Navigate } from 'react-router-dom';
import { RoomCard } from '../../components/room-card';
import { RoomTopicViewer } from '../../components/room-topic-viewer';
import { Page, PageHeader } from '../../components/page';
import { RoomSummaryLoader } from '../../components/RoomSummaryLoader';
import { isRoomAlias, isRoomId } from '../../utils/matrix';
import { useRoomNavigate } from '../../hooks/useRoomNavigate';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { allRoomsAtom } from '../../state/room-list/roomList';
import { mDirectAtom } from '../../state/mDirectList';
import { getDirectRoomPath, getHomeRoomPath, getSpacePath } from '../../pages/pathUtils';
import { ScreenSize, useScreenSizeContext } from '../../hooks/useScreenSize';
import { BackRouteHandler } from '../../components/BackRouteHandler';

type JoinBeforeNavigateProps = { roomIdOrAlias: string; eventId?: string; viaServers?: string[] };
export function JoinBeforeNavigate({
  roomIdOrAlias,
  eventId,
  viaServers,
}: JoinBeforeNavigateProps) {
  const mx = useMatrixClient();
  const allRooms = useAtomValue(allRoomsAtom);
  const { navigateRoom, navigateSpace } = useRoomNavigate();
  const screenSize = useScreenSizeContext();

  const handleView = (roomId: string) => {
    if (mx.getRoom(roomId)?.isSpaceRoom()) {
      navigateSpace(roomId);
      return;
    }
    navigateRoom(roomId, eventId);
  };

  // roomIdOrAlias 根本不是合法的房间 ID（!xxx:server）或别名（#xxx:server）
  // （比如被恢复出来的 "public"），直接回首页，不进预览/加房流程。
  // 否则 summary 与 join 都会失败，用户会被钉死在这张错误卡片上，
  // 刷新或重新登录又会把这个死路由恢复出来。
  if (!isRoomId(roomIdOrAlias) && !isRoomAlias(roomIdOrAlias)) {
    return <Navigate to="/" replace />;
  }

  // 已加入的房间（比如刚接受邀请）：直接进房间，不显示预览/报错卡
  // 解决接受邀请后因 room list atom 未同步而误进预览页的问题
  // 按房间类型路由：space→空间路径，DM→私聊路径，其他→首页路径
  const mDirects = useAtomValue(mDirectAtom);
  const joinedRoom = isRoomId(roomIdOrAlias) ? mx.getRoom(roomIdOrAlias) : undefined;
  if (joinedRoom && joinedRoom.getMyMembership() === 'join') {
    let targetPath: string;
    if (joinedRoom.isSpaceRoom()) {
      targetPath = getSpacePath(joinedRoom.roomId);
    } else {
      const isDM = Object.values(mDirects).flat().includes(joinedRoom.roomId);
      targetPath = isDM
        ? getDirectRoomPath(joinedRoom.roomId)
        : getHomeRoomPath(joinedRoom.roomId);
    }
    return <Navigate to={targetPath} replace />;
  }

  return (
    <Page>
      <PageHeader balance>
        <Box grow="Yes" gap="200">
          <Box shrink="No">
            {screenSize === ScreenSize.Mobile && (
              <BackRouteHandler>
                {(onBack) => (
                  <IconButton onClick={onBack}>
                    <Icon src={Icons.ArrowLeft} />
                  </IconButton>
                )}
              </BackRouteHandler>
            )}
          </Box>
          <Box grow="Yes" justifyContent="Center" alignItems="Center" gap="200">
            <Text size="H3" truncate>
              {roomIdOrAlias}
            </Text>
          </Box>
        </Box>
      </PageHeader>
      <Box grow="Yes">
        <Scroll hideTrack visibility="Hover" size="0">
          <Box style={{ height: '100%' }} grow="Yes" alignItems="Center" justifyContent="Center">
            <RoomSummaryLoader roomIdOrAlias={roomIdOrAlias}>
              {(summary) => {
                // 房间信息加载失败，直接回首页，不展示错误页
                if (!summary) {
                  return <Navigate to="/" replace />;
                }
                return (
                <RoomCard
                  style={{ maxWidth: toRem(364), width: '100%' }}
                  roomIdOrAlias={roomIdOrAlias}
                  allRooms={allRooms}
                  avatarUrl={summary?.avatar_url}
                  name={summary?.name}
                  topic={summary?.topic}
                  memberCount={summary?.num_joined_members}
                  roomType={summary?.room_type}
                  viaServers={viaServers}
                  renderTopicViewer={(name, topic, requestClose) => (
                    <RoomTopicViewer name={name} topic={topic} requestClose={requestClose} />
                  )}
                  onView={handleView}
                />
                );
              }}
            </RoomSummaryLoader>
          </Box>
        </Scroll>
      </Box>
    </Page>
  );
}
