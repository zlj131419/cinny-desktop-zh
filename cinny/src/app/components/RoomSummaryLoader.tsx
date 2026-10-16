import { ReactNode, useCallback, useState } from 'react';
import { MatrixClient, Room } from 'matrix-js-sdk';
import { useQuery } from '@tanstack/react-query';
import { IHierarchyRoom } from 'matrix-js-sdk/lib/@types/spaces';
import { useMatrixClient } from '../hooks/useMatrixClient';
import { LocalRoomSummary, useLocalRoomSummary } from '../hooks/useLocalRoomSummary';
import { AsyncState, AsyncStatus } from '../hooks/useAsyncCallback';

export type IRoomSummary = Awaited<ReturnType<MatrixClient['getRoomSummary']>>;

type RoomSummaryLoaderProps = {
  roomIdOrAlias: string;
  children: (roomSummary?: IRoomSummary) => ReactNode;
};

export function RoomSummaryLoader({ roomIdOrAlias, children }: RoomSummaryLoaderProps) {
  const mx = useMatrixClient();

  const fetchSummary = useCallback(async () => {
    try {
      const summary = await mx.getRoomSummary(roomIdOrAlias);
      // 如果 summary 没有名字，尝试用 state API 兜底
      if (!summary?.name) {
        try {
          const nameContent = await mx.getStateEvent(roomIdOrAlias, 'm.room.name', '');
          const topicContent = await mx.getStateEvent(roomIdOrAlias, 'm.room.topic', '').catch(() => undefined);
          return {
            ...summary,
            name: (nameContent as any)?.name || summary?.name,
            topic: (topicContent as any)?.topic || summary?.topic,
          };
        } catch {
          // state API 也失败就返回原始 summary
        }
      }
      return summary;
    } catch {
      // getRoomSummary 失败时，尝试直接读 state
      try {
        const nameContent = await mx.getStateEvent(roomIdOrAlias, 'm.room.name', '');
        const topicContent = await mx.getStateEvent(roomIdOrAlias, 'm.room.topic', '').catch(() => undefined);
        return {
          room_id: roomIdOrAlias,
          name: (nameContent as any)?.name,
          topic: (topicContent as any)?.topic,
        } as IRoomSummary;
      } catch {
        return undefined;
      }
    }
  }, [mx, roomIdOrAlias]);

  const { data, isLoading } = useQuery({
    queryKey: [roomIdOrAlias, `summary`],
    queryFn: fetchSummary,
  });

  // 数据没加载完之前不渲染，避免先闪房间 ID
  if (isLoading) return null;

  return children(data);
}

export function LocalRoomSummaryLoader({
  room,
  children,
}: {
  room: Room;
  children: (roomSummary: LocalRoomSummary) => ReactNode;
}) {
  const summary = useLocalRoomSummary(room);

  return children(summary);
}

export function HierarchyRoomSummaryLoader({
  roomId,
  children,
}: {
  roomId: string;
  children: (state: AsyncState<IHierarchyRoom, Error>) => ReactNode;
}) {
  const mx = useMatrixClient();

  const fetchSummary = useCallback(() => mx.getRoomHierarchy(roomId, 1, 1), [mx, roomId]);
  const [errorMemo, setError] = useState<Error>();

  const { data, error } = useQuery({
    queryKey: [roomId, `hierarchy`],
    queryFn: fetchSummary,
    retryOnMount: false,
    refetchOnWindowFocus: false,
    retry: (failureCount, err) => {
      setError(err);
      if (failureCount > 3) return false;
      return true;
    },
  });

  let state: AsyncState<IHierarchyRoom, Error> = {
    status: AsyncStatus.Loading,
  };
  if (error) {
    state = {
      status: AsyncStatus.Error,
      error,
    };
  }
  if (errorMemo) {
    state = {
      status: AsyncStatus.Error,
      error: errorMemo,
    };
  }

  const summary = data?.rooms[0] ?? undefined;
  if (summary) {
    state = {
      status: AsyncStatus.Success,
      data: summary,
    };
  }

  return children(state);
}
