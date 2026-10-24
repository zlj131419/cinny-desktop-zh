import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Text, config } from 'folds';
import { EventType } from 'matrix-js-sdk';
import { ReactEditor } from 'slate-react';
import { isKeyHotkey } from 'is-hotkey';
import { useStateEvent } from '../../hooks/useStateEvent';
import { StateEvent } from '../../../types/matrix/room';
import { usePowerLevelsContext } from '../../hooks/usePowerLevels';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useEditor } from '../../components/editor';
import { RoomInputPlaceholder } from './RoomInputPlaceholder';
import { RoomTimeline } from './RoomTimeline';
import { RoomViewTyping } from './RoomViewTyping';
import { RoomTombstone } from './RoomTombstone';
import { RoomInput } from './RoomInput';
import { RoomViewFollowing, RoomViewFollowingPlaceholder } from './RoomViewFollowing';
import { Page } from '../../components/page';
import { useKeyDown } from '../../hooks/useKeyDown';
import { editableActiveElement } from '../../utils/dom';
import { isKeyboardVisuallyOpen } from '../../utils/appViewport';
import { settingsAtom } from '../../state/settings';
import { useSetting } from '../../state/hooks/settings';
import { useRoomPermissions } from '../../hooks/useRoomPermissions';
import { useRoomCreators } from '../../hooks/useRoomCreators';
import { useRoom } from '../../hooks/useRoom';

const FN_KEYS_REGEX = /^F\d+$/;
const shouldFocusMessageField = (evt: KeyboardEvent): boolean => {
  const { code } = evt;
  if (evt.metaKey || evt.altKey || evt.ctrlKey) {
    return false;
  }

  if (FN_KEYS_REGEX.test(code)) return false;

  if (
    code.startsWith('OS') ||
    code.startsWith('Meta') ||
    code.startsWith('Shift') ||
    code.startsWith('Alt') ||
    code.startsWith('Control') ||
    code.startsWith('Arrow') ||
    code.startsWith('Page') ||
    code.startsWith('End') ||
    code.startsWith('Home') ||
    code === 'Tab' ||
    code === 'Space' ||
    code === 'Enter' ||
    code === 'NumLock' ||
    code === 'ScrollLock'
  ) {
    return false;
  }

  return true;
};

export function RoomView({ eventId }: { eventId?: string }) {
  const { t } = useTranslation();
  const roomInputRef = useRef<HTMLDivElement>(null);
  const roomViewRef = useRef<HTMLDivElement>(null);

  const [hideActivity] = useSetting(settingsAtom, 'hideActivity');

  const room = useRoom();
  const { roomId } = room;
  const editor = useEditor();

  const mx = useMatrixClient();

  const tombstoneEvent = useStateEvent(room, StateEvent.RoomTombstone);
  const powerLevels = usePowerLevelsContext();
  const creators = useRoomCreators(room);

  const permissions = useRoomPermissions(creators, powerLevels);
  const canMessage = permissions.event(EventType.RoomMessage, mx.getSafeUserId());

  useKeyDown(
    window,
    useCallback(
      (evt) => {
        if (editableActiveElement()) return;
        const portalContainer = document.getElementById('portalContainer');
        if (portalContainer && portalContainer.children.length > 0) {
          return;
        }
        if (shouldFocusMessageField(evt) || isKeyHotkey('mod+v', evt)) {
          ReactEditor.focus(editor);
        }
      },
      [editor]
    )
  );

  // 键盘弹起时收起输入框下方「正在关注」行：它在输入框下方恒占 28px
  // （Surface.Container 底色，无人关注时也是空条），输入框弹起后它就成了
  // 输入框与键盘之间的一条黑带（2026-10-24：1.0.45 实报，垫高双信号已进包、
  // 黑带仍在，排除后剩它）。判定用双信号：输入框聚焦，或视口高度明显收缩；
  // 失焦且视口恢复后还原。仅触屏设备启用，桌面端行为不动。
  const [hideFollowing, setHideFollowing] = useState(false);
  useEffect(() => {
    if (!window.matchMedia('(pointer: coarse)').matches) return undefined;
    const vv = window.visualViewport;
    const isEditable = (el: EventTarget | null) => {
      const node = el as HTMLElement | null;
      return (
        !!node &&
        (node.tagName === 'INPUT' || node.tagName === 'TEXTAREA' || node.isContentEditable)
      );
    };
    const update = () =>
      setHideFollowing(isEditable(document.activeElement) || isKeyboardVisuallyOpen());
    const onFocusIn = (e: FocusEvent) => {
      if (isEditable(e.target)) setHideFollowing(true);
    };
    const onFocusOut = () => {
      window.setTimeout(update, 50);
    };
    const onVvResize = () => update();
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    vv?.addEventListener('resize', onVvResize);
    return () => {
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
      vv?.removeEventListener('resize', onVvResize);
    };
  }, []);

  return (
    <Page ref={roomViewRef}>
      <Box grow="Yes" direction="Column" style={{ minWidth: 0 }}>
        <RoomTimeline
          key={roomId}
          room={room}
          eventId={eventId}
          roomInputRef={roomInputRef}
          editor={editor}
        />
        <RoomViewTyping room={room} />
      </Box>
      <Box shrink="No" direction="Column">
        <div style={{ padding: `0 ${config.space.S400}` }}>
          {tombstoneEvent ? (
            <RoomTombstone
              roomId={roomId}
              body={tombstoneEvent.getContent().body}
              replacementRoomId={tombstoneEvent.getContent().replacement_room}
            />
          ) : (
            <>
              {canMessage && (
                <RoomInput
                  room={room}
                  editor={editor}
                  roomId={roomId}
                  fileDropContainerRef={roomViewRef}
                  ref={roomInputRef}
                />
              )}
              {!canMessage && (
                <RoomInputPlaceholder
                  style={{ padding: config.space.S200 }}
                  alignItems="Center"
                  justifyContent="Center"
                >
                  <Text align="Center">{t('features:room.no_permission_to_post')}</Text>
                </RoomInputPlaceholder>
              )}
            </>
          )}
        </div>
        {hideFollowing
          ? null
          : hideActivity
            ? <RoomViewFollowingPlaceholder />
            : <RoomViewFollowing room={room} />}
      </Box>
    </Page>
  );
}
