import React, { useCallback, useEffect, useMemo, useReducer } from 'react';
import { Box, Button, Text, color, toRem } from 'folds';
import { EventType, MatrixEvent, Room, RoomEvent } from 'matrix-js-sdk';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { getMemberDisplayName } from '../../utils/room';

/**
 * 投票卡片（MSC3381）：渲染 m.poll.start 事件，聚合房间内的
 * m.poll.response（每人取最新一份）实时计票，点击选项即投票（可改票），
 * 发起人可结束投票（m.poll.end）。与 Element 互通。
 */

export const POLL_START_TYPE = 'm.poll.start';
const POLL_RESPONSE_TYPE = 'm.poll.response';
const POLL_END_TYPE = 'm.poll.end';
const POLL_START_KEY = 'org.matrix.msc3381.poll.start';
const POLL_RESPONSE_KEY = 'org.matrix.msc3381.response';
const TEXT_KEY = 'org.matrix.msc1767.text';

type PollAnswerDef = { id: string; text: string };

const parsePollDef = (mEvent: MatrixEvent): { question: string; answers: PollAnswerDef[] } => {
  const start = mEvent.getContent()?.[POLL_START_KEY] ?? {};
  const question = start?.question?.[TEXT_KEY] ?? start?.question?.body ?? '投票';
  const answers: PollAnswerDef[] = Array.isArray(start?.answers)
    ? start.answers
        .filter((a: Record<string, unknown>) => typeof a?.id === 'string')
        .map((a: Record<string, any>) => ({
          id: a.id as string,
          text: (a[TEXT_KEY] as string) ?? (a.body as string) ?? (a.id as string),
        }))
    : [];
  return { question: String(question), answers };
};

type PollAgg = {
  ended: boolean;
  counts: Map<string, number>;
  total: number;
  myAnswerId?: string;
};

const aggregatePoll = (room: Room, pollId: string, myUserId: string | null): PollAgg => {
  const latestByUser = new Map<string, { answerId: string; ts: number }>();
  let ended = false;
  room
    .getLiveTimeline()
    .getEvents()
    .forEach((ev) => {
      if (ev.isRedacted()) return;
      const rel = ev.getContent()?.['m.relates_to'];
      if (!rel || rel.event_id !== pollId) return;
      if (ev.getType() === POLL_END_TYPE) {
        ended = true;
        return;
      }
      if (ev.getType() !== POLL_RESPONSE_TYPE) return;
      const sender = ev.getSender();
      const answers = ev.getContent()?.[POLL_RESPONSE_KEY]?.answers;
      if (!sender || !Array.isArray(answers) || typeof answers[0] !== 'string') return;
      const prev = latestByUser.get(sender);
      if (!prev || ev.getTs() >= prev.ts) {
        latestByUser.set(sender, { answerId: answers[0], ts: ev.getTs() });
      }
    });
  const counts = new Map<string, number>();
  latestByUser.forEach(({ answerId }) => counts.set(answerId, (counts.get(answerId) ?? 0) + 1));
  return {
    ended,
    counts,
    total: latestByUser.size,
    myAnswerId: myUserId ? latestByUser.get(myUserId)?.answerId : undefined,
  };
};

export function PollTile({ room, mEvent }: { room: Room; mEvent: MatrixEvent }) {
  const mx = useMatrixClient();
  const [version, bump] = useReducer((x: number) => x + 1, 0);

  useEffect(() => {
    const handler = () => bump();
    mx.on(RoomEvent.Timeline, handler);
    mx.on(RoomEvent.Redaction, handler);
    return () => {
      mx.removeListener(RoomEvent.Timeline, handler);
      mx.removeListener(RoomEvent.Redaction, handler);
    };
  }, [mx]);

  const { question, answers } = useMemo(() => parsePollDef(mEvent), [mEvent]);
  const pollId = mEvent.getId() ?? '';
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const agg = useMemo(() => aggregatePoll(room, pollId, mx.getUserId()), [room, pollId, mx, version]);
  const senderId = mEvent.getSender() ?? '';
  const senderName = getMemberDisplayName(room, senderId) ?? senderId;
  const isCreator = senderId === mx.getUserId();

  const vote = useCallback(
    (answerId: string) => {
      if (agg.ended || !pollId) return;
      void mx
        .sendEvent(room.roomId, POLL_RESPONSE_TYPE as unknown as EventType, {
          'm.relates_to': { rel_type: 'm.reference', event_id: pollId },
          [POLL_RESPONSE_KEY]: { answers: [answerId] },
        })
        .catch(() => undefined);
    },
    [mx, room, pollId, agg.ended]
  );

  const endPoll = useCallback(() => {
    if (!pollId) return;
    void mx
      .sendEvent(room.roomId, POLL_END_TYPE as unknown as EventType, {
        'm.relates_to': { rel_type: 'm.reference', event_id: pollId },
        [TEXT_KEY]: '投票已结束',
      })
      .catch(() => undefined);
  }, [mx, room, pollId]);

  return (
    <Box
      direction="Column"
      gap="200"
      style={{
        border: `1px solid ${color.SurfaceVariant.ContainerLine}`,
        borderRadius: toRem(10),
        padding: toRem(12),
        maxWidth: toRem(460),
        backgroundColor: color.Surface.Container,
      }}
    >
      <Box alignItems="Center" gap="200">
        <Text size="T400" style={{ flex: 1 }}>
          <b>{question}</b>
        </Text>
        {agg.ended && (
          <Text size="T200" priority="300">
            已结束
          </Text>
        )}
      </Box>
      <Text size="T200" priority="300">
        {senderName} 发起
      </Text>
      <Box direction="Column" gap="100">
        {answers.map((a) => {
          const count = agg.counts.get(a.id) ?? 0;
          const pct = agg.total > 0 ? Math.round((count / agg.total) * 100) : 0;
          const mine = agg.myAnswerId === a.id;
          return (
            <Box
              key={a.id}
              as="button"
              onClick={() => vote(a.id)}
              alignItems="Center"
              gap="200"
              style={{
                position: 'relative',
                overflow: 'hidden',
                textAlign: 'left',
                border: `1px solid ${mine ? color.Primary.Container : color.SurfaceVariant.ContainerLine}`,
                borderRadius: toRem(8),
                padding: `${toRem(7)} ${toRem(10)}`,
                background: 'transparent',
                cursor: agg.ended ? 'default' : 'pointer',
                width: '100%',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: `${pct}%`,
                  backgroundColor: mine ? color.Primary.Container : color.SurfaceVariant.Container,
                  opacity: 0.25,
                  pointerEvents: 'none',
                }}
              />
              <span
                style={{
                  width: toRem(14),
                  height: toRem(14),
                  borderRadius: '50%',
                  border: `2px solid ${mine ? color.Primary.Container : 'rgba(127,127,127,0.7)'}`,
                  backgroundColor: mine ? color.Primary.Container : 'transparent',
                  flexShrink: 0,
                  zIndex: 1,
                }}
              />
              <Text size="T300" style={{ flex: 1, zIndex: 1 }}>
                {a.text}
              </Text>
              <Text size="T200" priority="300" style={{ zIndex: 1 }}>
                {count} 票 · {pct}%
              </Text>
            </Box>
          );
        })}
      </Box>
      <Box alignItems="Center" gap="200">
        <Text size="T200" priority="300" style={{ flex: 1 }}>
          共 {agg.total} 人参与{agg.ended ? '' : ' · 点击选项投票，可改票'}
        </Text>
        {isCreator && !agg.ended && (
          <Button size="300" variant="Secondary" fill="Soft" radii="300" onClick={endPoll}>
            结束投票
          </Button>
        )}
      </Box>
    </Box>
  );
}
