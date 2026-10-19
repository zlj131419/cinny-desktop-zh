import { Room, RoomEvent, RoomEventHandlerMap } from 'matrix-js-sdk';
import { useEffect, useState } from 'react';

export type EventReader = {
  userId: string;
  ts: number;
};

const getEventReaders = (room: Room, evtId?: string): EventReader[] => {
  if (!evtId) return [];

  // if eventId is locally generated
  // we don't have read receipt for it yet
  if (!evtId.startsWith('$')) return [];

  const liveEvents = room.getLiveTimeline().getEvents();
  const readers = new Map<string, number>();

  for (let i = liveEvents.length - 1; i >= 0; i -= 1) {
    const event = liveEvents[i];
    const userIds = room.getUsersReadUpTo(event);
    
    // 获取该事件的回执时间戳
    const receipts = room.getReceiptsForEvent(event);
    const tsMap = new Map<string, number>();
    for (const receipt of receipts) {
      if (receipt.type === 'm.read' || receipt.type === 'm.read.private') {
        tsMap.set(receipt.userId, receipt.ts);
      }
    }
    
    for (const userId of userIds) {
      if (!readers.has(userId)) {
        readers.set(userId, tsMap.get(userId) ?? event.getTs());
      }
    }
    
    if (event.getId() === evtId) break;
  }

  return [...readers.entries()].map(([userId, ts]) => ({ userId, ts }));
};

export const useRoomEventReaders = (room: Room, eventId?: string): EventReader[] => {
  const [readers, setReaders] = useState<EventReader[]>(() => getEventReaders(room, eventId));

  useEffect(() => {
    setReaders(getEventReaders(room, eventId));

    const handleReceipt: RoomEventHandlerMap[RoomEvent.Receipt] = (event, r) => {
      if (r.roomId !== room.roomId) return;
      setReaders(getEventReaders(room, eventId));
    };

    const handleLocalEcho: RoomEventHandlerMap[RoomEvent.LocalEchoUpdated] = (
      event,
      r,
      oldEventId
    ) => {
      // update members on local event id replaced
      // with server generated id
      if (r.roomId !== room.roomId || !oldEventId) return;
      if (oldEventId.startsWith('$')) return;
      if (oldEventId !== eventId) return;

      setReaders(getEventReaders(room, event.getId()));
    };

    room.on(RoomEvent.Receipt, handleReceipt);
    room.on(RoomEvent.LocalEchoUpdated, handleLocalEcho);
    return () => {
      room.removeListener(RoomEvent.Receipt, handleReceipt);
      room.removeListener(RoomEvent.LocalEchoUpdated, handleLocalEcho);
    };
  }, [room, eventId]);

  return readers;
};
