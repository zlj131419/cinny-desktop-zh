import React, { MouseEventHandler, forwardRef, useRef, useState } from 'react';
import { Room } from 'matrix-js-sdk';
import {
  Avatar,
  Box,
  Icon,
  IconButton,
  Icons,
  Text,
  Menu,
  MenuItem,
  config,
  PopOut,
  toRem,
  Line,
  RectCords,
  Badge,
  Spinner,
} from 'folds';
import { useFocusWithin, useHover } from 'react-aria';
import { useTranslation } from 'react-i18next';
import FocusTrap from 'focus-trap-react';
import { useAtom, useAtomValue } from 'jotai';
import { NavItem, NavItemContent, NavItemOptions, NavLink } from '../../components/nav';
import { UnreadBadge, UnreadBadgeCenter } from '../../components/unread-badge';
import { RoomAvatar, RoomIcon } from '../../components/room-avatar';
import { getDirectRoomAvatarUrl, getRoomAvatarUrl, getStateEvent } from '../../utils/room';
import { nameInitials } from '../../utils/common';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useRoomUnread } from '../../state/hooks/unread';
import { roomToUnreadAtom } from '../../state/room/roomToUnread';
import { getPowersLevelFromMatrixEvent, usePowerLevels } from '../../hooks/usePowerLevels';
import { copyToClipboard } from '../../utils/dom';
import { markAsRead } from '../../utils/notifications';
import { UseStateProvider } from '../../components/UseStateProvider';
import { LeaveRoomPrompt } from '../../components/leave-room-prompt';
import { useRoomTypingMember } from '../../hooks/useRoomTypingMembers';
import { TypingIndicator } from '../../components/typing-indicator';
import { stopPropagation } from '../../utils/keyboard';
import { getMatrixToRoom } from '../../plugins/matrix-to';
import { getCanonicalAliasOrRoomId, isRoomAlias } from '../../utils/matrix';
import { getViaServers } from '../../plugins/via-servers';
import { useMediaAuthentication } from '../../hooks/useMediaAuthentication';
import { useSetting } from '../../state/hooks/settings';
import { settingsAtom } from '../../state/settings';
import { useOpenRoomSettings } from '../../state/hooks/roomSettings';
import { useSpaceOptionally } from '../../hooks/useSpace';
import { siyuTouchDrag } from '../../utils/siyuDrag';
import {
  getRoomNotificationModeIcon,
  RoomNotificationMode,
} from '../../hooks/useRoomsNotificationPreferences';
import { RoomNotificationModeSwitcher } from '../../components/RoomNotificationSwitcher';
import { getRoomCreatorsForRoomId, useRoomCreators } from '../../hooks/useRoomCreators';
import { getRoomPermissionsAPI, useRoomPermissions } from '../../hooks/useRoomPermissions';
import { InviteUserPrompt } from '../../components/invite-user-prompt';
import { useRoomName } from '../../hooks/useRoomMeta';
import { useCallMembers, useCallSession } from '../../hooks/useCall';
import { useCallEmbed, useCallStart } from '../../hooks/useCallEmbed';
import { callChatAtom } from '../../state/callEmbed';
import { useCallPreferencesAtom } from '../../state/hooks/callPreferences';
import { useAutoDiscoveryInfo } from '../../hooks/useAutoDiscoveryInfo';
import { livekitSupport } from '../../hooks/useLivekitSupport';
import { StateEvent } from '../../../types/matrix/room';
import { webRTCSupported } from '../../utils/rtc';

type RoomNavItemMenuProps = {
  room: Room;
  requestClose: () => void;
  notificationMode?: RoomNotificationMode;
};
const RoomNavItemMenu = forwardRef<HTMLDivElement, RoomNavItemMenuProps>(
  ({ room, requestClose, notificationMode }, ref) => {
    const mx = useMatrixClient();
    const { t } = useTranslation();
    const [hideActivity] = useSetting(settingsAtom, 'hideActivity');
    const unread = useRoomUnread(room.roomId, roomToUnreadAtom);
    const powerLevels = usePowerLevels(room);
    const creators = useRoomCreators(room);

    const permissions = useRoomPermissions(creators, powerLevels);
    const canInvite = permissions.action('invite', mx.getSafeUserId());
    const openRoomSettings = useOpenRoomSettings();
    const space = useSpaceOptionally();

    const [invitePrompt, setInvitePrompt] = useState(false);

    const handleMarkAsRead = () => {
      markAsRead(mx, room.roomId, hideActivity);
      requestClose();
    };

    const handleInvite = () => {
      setInvitePrompt(true);
    };

    const handleCopyLink = () => {
      const roomIdOrAlias = getCanonicalAliasOrRoomId(mx, room.roomId);
      const viaServers = isRoomAlias(roomIdOrAlias) ? undefined : getViaServers(room);
      copyToClipboard(getMatrixToRoom(roomIdOrAlias, viaServers));
      requestClose();
    };

    const handleRoomSettings = () => {
      openRoomSettings(room.roomId, space?.roomId);
      requestClose();
    };

    const isFavourite = !!room.tags?.['m.favourite'];
    const handleToggleFavourite = () => {
      if (!room?.roomId) return;
      if (isFavourite) {
        mx.deleteRoomTag(room.roomId, 'm.favourite').catch(() => {});
      } else {
        mx.setRoomTag(room.roomId, 'm.favourite', {}).catch(() => {});
      }
      requestClose();
    };

    const isPinned = !!room.tags?.['com.siyu.pinned'];
    const handleTogglePin = () => {
      if (!room?.roomId) return;
      if (isPinned) {
        mx.deleteRoomTag(room.roomId, 'com.siyu.pinned').catch(() => {});
      } else {
        mx.setRoomTag(room.roomId, 'com.siyu.pinned', { order: 0 }).catch(() => {});
      }
      requestClose();
    };

    // 分组子菜单折叠状态
    const [showGroups, setShowGroups] = useState(false);
    // 分组：组名存在标签 com.siyu.group 的 name 字段
    const currentGroup =
      typeof room.tags?.['com.siyu.group']?.name === 'string'
        ? (room.tags['com.siyu.group'].name as string)
        : undefined;
    const allGroups = (() => {
      try {
        const names = new Set<string>();
        mx.getRooms().forEach((r) => {
          const n = r.tags?.['com.siyu.group']?.name;
          if (typeof n === 'string' && n) names.add(n);
        });
        return Array.from(names).sort();
      } catch {
        return [];
      }
    })();
    const handleMoveToGroup = (groupName: string | undefined) => {
      if (!room?.roomId) return;
      if (groupName) {
        mx.setRoomTag(room.roomId, 'com.siyu.group', { name: groupName }).catch(() => {});
      } else {
        mx.deleteRoomTag(room.roomId, 'com.siyu.group').catch(() => {});
      }
      requestClose();
    };
    const handleCreateGroup = () => {
      const name = window.prompt('新建分组名称');
      if (name && name.trim()) {
        handleMoveToGroup(name.trim());
      } else {
        requestClose();
      }
    };

    return (
      <Menu ref={ref} style={{ maxWidth: toRem(160), width: '100vw' }}>
        {invitePrompt && room && (
          <InviteUserPrompt
            room={room}
            requestClose={() => {
              setInvitePrompt(false);
              requestClose();
            }}
          />
        )}
        <Box direction="Column" gap="100" style={{ padding: config.space.S100 }}>
          <MenuItem
            onClick={handleMarkAsRead}
            size="300"
            after={<Icon size="100" src={Icons.CheckTwice} />}
            radii="300"
            disabled={!unread}
          >
            <Text style={{ flexGrow: 1 }} as="span" size="T300" truncate>
              {t('features:room-nav.mark_as_read')}
            </Text>
          </MenuItem>
          <RoomNotificationModeSwitcher roomId={room.roomId} value={notificationMode}>
            {(handleOpen, opened, changing) => (
              <MenuItem
                size="300"
                after={
                  changing ? (
                    <Spinner size="100" variant="Secondary" />
                  ) : (
                    <Icon size="100" src={getRoomNotificationModeIcon(notificationMode)} />
                  )
                }
                radii="300"
                aria-pressed={opened}
                onClick={handleOpen}
              >
                <Text style={{ flexGrow: 1 }} as="span" size="T300" truncate>
                  {t('features:room-nav.notifications')}
                </Text>
              </MenuItem>
            )}
          </RoomNotificationModeSwitcher>
        </Box>
        <Line variant="Surface" size="300" />
        <Box direction="Column" gap="100" style={{ padding: config.space.S100 }}>
          <MenuItem
            onClick={handleInvite}
            variant="Primary"
            fill="None"
            size="300"
            after={<Icon size="100" src={Icons.UserPlus} />}
            radii="300"
            aria-pressed={invitePrompt}
            disabled={!canInvite}
          >
            <Text style={{ flexGrow: 1 }} as="span" size="T300" truncate>
              {t('features:room-nav.invite')}
            </Text>
          </MenuItem>
          <MenuItem
            onClick={handleCopyLink}
            size="300"
            after={<Icon size="100" src={Icons.Link} />}
            radii="300"
          >
            <Text style={{ flexGrow: 1 }} as="span" size="T300" truncate>
              {t('features:room-nav.copy_link')}
            </Text>
          </MenuItem>
          <MenuItem
            onClick={handleToggleFavourite}
            size="300"
            after={<Icon size="100" src={Icons.Star} filled={isFavourite} />}
            radii="300"
          >
            <Text style={{ flexGrow: 1 }} as="span" size="T300" truncate>
              {isFavourite ? '取消收藏' : '收藏'}
            </Text>
          </MenuItem>
          <MenuItem
            onClick={handleTogglePin}
            size="300"
            after={<Icon size="100" src={Icons.Pin} />}
            radii="300"
          >
            <Text style={{ flexGrow: 1 }} as="span" size="T300" truncate>
              {isPinned ? '取消置顶' : '置顶'}
            </Text>
          </MenuItem>
          <MenuItem
            onClick={() => setShowGroups((v) => !v)}
            size="300"
            after={
              <Icon size="100" src={showGroups ? Icons.ChevronBottom : Icons.ChevronRight} />
            }
            radii="300"
          >
            <Text style={{ flexGrow: 1 }} as="span" size="T300" truncate>
              移动到分组{currentGroup ? `（当前：${currentGroup}）` : ''}
            </Text>
          </MenuItem>
          {showGroups && (
            <>
              {allGroups
                .filter((g) => g !== currentGroup)
                .map((g) => (
                  <MenuItem
                    key={g}
                    onClick={() => handleMoveToGroup(g)}
                    size="300"
                    after={<Icon size="100" src={Icons.Category} />}
                    radii="300"
                    style={{ paddingLeft: '1.75rem' }}
                  >
                    <Text style={{ flexGrow: 1 }} as="span" size="T300" truncate>
                      {g}
                    </Text>
                  </MenuItem>
                ))}
              <MenuItem
                onClick={handleCreateGroup}
                size="300"
                after={<Icon size="100" src={Icons.Plus} />}
                radii="300"
                style={{ paddingLeft: '1.75rem' }}
              >
                <Text style={{ flexGrow: 1 }} as="span" size="T300" truncate>
                  新建分组
                </Text>
              </MenuItem>
              {currentGroup && (
                <MenuItem
                  onClick={() => handleMoveToGroup(undefined)}
                  size="300"
                  after={<Icon size="100" src={Icons.Cross} />}
                  radii="300"
                  style={{ paddingLeft: '1.75rem' }}
                >
                  <Text style={{ flexGrow: 1 }} as="span" size="T300" truncate>
                    移出分组
                  </Text>
                </MenuItem>
              )}
            </>
          )}
          <MenuItem
            onClick={handleRoomSettings}
            size="300"
            after={<Icon size="100" src={Icons.Setting} />}
            radii="300"
          >
            <Text style={{ flexGrow: 1 }} as="span" size="T300" truncate>
              {t('features:room-nav.room_settings')}
            </Text>
          </MenuItem>
        </Box>
        <Line variant="Surface" size="300" />
        <Box direction="Column" gap="100" style={{ padding: config.space.S100 }}>
          <UseStateProvider initial={false}>
            {(promptLeave, setPromptLeave) => (
              <>
                <MenuItem
                  onClick={() => setPromptLeave(true)}
                  variant="Critical"
                  fill="None"
                  size="300"
                  after={<Icon size="100" src={Icons.ArrowGoLeft} />}
                  radii="300"
                  aria-pressed={promptLeave}
                >
                  <Text style={{ flexGrow: 1 }} as="span" size="T300" truncate>
                    {t('features:room-nav.leave_room')}
                  </Text>
                </MenuItem>
                {promptLeave && (
                  <LeaveRoomPrompt
                    roomId={room.roomId}
                    onDone={requestClose}
                    onCancel={() => setPromptLeave(false)}
                  />
                )}
              </>
            )}
          </UseStateProvider>
        </Box>
      </Menu>
    );
  }
);

function CallChatToggle() {
  const [chat, setChat] = useAtom(callChatAtom);
  const { t } = useTranslation();

  return (
    <IconButton
      onClick={() => setChat(!chat)}
      aria-pressed={chat}
      aria-label={t('features:room-nav.toggle_chat')}
      variant="Background"
      fill="None"
      size="300"
      radii="300"
    >
      <Icon size="50" src={Icons.Message} filled={chat} />
    </IconButton>
  );
}

type RoomNavItemProps = {
  room: Room;
  selected: boolean;
  linkPath: string;
  notificationMode?: RoomNotificationMode;
  showAvatar?: boolean;
  direct?: boolean;
};
export function RoomNavItem({
  room,
  selected,
  showAvatar,
  direct,
  notificationMode,
  linkPath,
}: RoomNavItemProps) {
  const mx = useMatrixClient();
  const useAuthentication = useMediaAuthentication();
  const [hover, setHover] = useState(false);
  const { t } = useTranslation();
  const { hoverProps } = useHover({ onHoverChange: setHover });
  const { focusWithinProps } = useFocusWithin({ onFocusWithinChange: setHover });
  const [menuAnchor, setMenuAnchor] = useState<RectCords>();
  const unread = useRoomUnread(room.roomId, roomToUnreadAtom);
  const typingMember = useRoomTypingMember(room.roomId).filter(
    (receipt) => receipt.userId !== mx.getUserId()
  );

  const roomName = useRoomName(room);

  const handleContextMenu: MouseEventHandler<HTMLElement> = (evt) => {
    evt.preventDefault();
    setMenuAnchor({
      x: evt.clientX,
      y: evt.clientY,
      width: 0,
      height: 0,
    });
  };

  const handleOpenMenu: MouseEventHandler<HTMLButtonElement> = (evt) => {
    setMenuAnchor(evt.currentTarget.getBoundingClientRect());
  };

  // 长按唤出菜单（移动端无右键）
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFired = useRef(false);
  const longPressPos = useRef<{ x: number; y: number } | null>(null);
  const cancelLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };
  const handleTouchStart = (evt: React.TouchEvent) => {
    const t = evt.touches[0];
    if (!t) return;
    longPressPos.current = { x: t.clientX, y: t.clientY };
    longPressFired.current = false;
    cancelLongPress();
    longPressTimer.current = setTimeout(() => {
      if (siyuTouchDrag.active) {
        longPressTimer.current = null;
        return;
      }
      longPressFired.current = true;
      const p = longPressPos.current;
      setMenuAnchor({ x: p?.x ?? 0, y: p?.y ?? 0, width: 0, height: 0 });
      longPressTimer.current = null;
    }, 500);
  };
  const handleTouchMove = (evt: React.TouchEvent) => {
    const t = evt.touches[0];
    const p = longPressPos.current;
    if (t && p && Math.hypot(t.clientX - p.x, t.clientY - p.y) > 12) cancelLongPress();
  };
  const handleTouchEnd = () => cancelLongPress();
  const handleNavLinkClick: MouseEventHandler<HTMLAnchorElement> = (evt) => {
    if (longPressFired.current) {
      // 长按后松手：阻止跳转
      longPressFired.current = false;
      evt.preventDefault();
      return;
    }
    if (room.isCallRoom()) handleStartCall(evt);
  };
  const optionsVisible = hover || !!menuAnchor;
  const callSession = useCallSession(room);
  const callMembers = useCallMembers(callSession);
  const startCall = useCallStart(direct);
  const callEmbed = useCallEmbed();
  const callPref = useAtomValue(useCallPreferencesAtom());
  const autoDiscoveryInfo = useAutoDiscoveryInfo();

  const handleStartCall: MouseEventHandler<HTMLAnchorElement> = (evt) => {
    const powerLevelsEvent = getStateEvent(room, StateEvent.RoomPowerLevels);
    const powerLevels = getPowersLevelFromMatrixEvent(powerLevelsEvent);
    const creators = getRoomCreatorsForRoomId(mx, room.roomId);
    const permissions = getRoomPermissionsAPI(creators, powerLevels);

    const hasCallPermission = permissions.stateEvent(
      StateEvent.GroupCallMemberPrefix,
      mx.getSafeUserId()
    );

    // Do not join if missing permissions or no livekit support or no webRTC support
    if (!hasCallPermission || !livekitSupport(autoDiscoveryInfo) || !webRTCSupported()) {
      return;
    }

    // Do not join if already in call
    if (callEmbed) {
      return;
    }
    // Start call in second click
    if (selected) {
      evt.preventDefault();
      startCall(room, callPref);
    }
  };

  return (
    <NavItem
      variant="Background"
      radii="400"
      highlight={unread !== undefined}
      aria-selected={selected}
      data-hover={!!menuAnchor}
      onContextMenu={handleContextMenu}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      style={{ WebkitTouchCallout: 'none', userSelect: 'none' }}
      {...hoverProps}
      {...focusWithinProps}
    >
      <NavLink to={linkPath} onClick={handleNavLinkClick}>
        <NavItemContent>
          <Box as="span" grow="Yes" alignItems="Center" gap="200">
            <Avatar size="200" radii="400">
              {showAvatar ? (
                <RoomAvatar
                  roomId={room.roomId}
                  src={
                    direct
                      ? getDirectRoomAvatarUrl(mx, room, 96, useAuthentication)
                      : getRoomAvatarUrl(mx, room, 96, useAuthentication)
                  }
                  alt={roomName}
                  renderFallback={() => (
                    <Text as="span" size="H6">
                      {nameInitials(roomName)}
                    </Text>
                  )}
                />
              ) : (
                <RoomIcon
                  style={{
                    opacity: unread ? config.opacity.P500 : config.opacity.P300,
                  }}
                  filled={selected}
                  size="100"
                  joinRule={room.getJoinRule()}
                  roomType={room.getType()}
                />
              )}
            </Avatar>
            <Box as="span" grow="Yes">
              <Text priority={unread ? '500' : '300'} as="span" size="Inherit" truncate>
                {roomName}
              </Text>
            </Box>
            {!optionsVisible && !unread && !selected && typingMember.length > 0 && (
              <Badge size="300" variant="Secondary" fill="Soft" radii="Pill" outlined>
                <TypingIndicator size="300" disableAnimation />
              </Badge>
            )}
            {!optionsVisible && unread && (
              <UnreadBadgeCenter>
                <UnreadBadge highlight={unread.highlight > 0} count={unread.total} />
              </UnreadBadgeCenter>
            )}
            {!optionsVisible && notificationMode !== RoomNotificationMode.Unset && (
              <Icon
                size="50"
                src={getRoomNotificationModeIcon(notificationMode)}
                aria-label={notificationMode}
              />
            )}
            {callMembers.length > 0 && (
              <Badge variant="Critical" fill="Solid" size="400">
                <Text as="span" size="L400" truncate>
                  {callMembers.length} {t('features:room-nav.live')}
                </Text>
              </Badge>
            )}
          </Box>
        </NavItemContent>
      </NavLink>
      {optionsVisible && (
        <NavItemOptions>
          {selected && (callEmbed?.roomId === room.roomId || room.isCallRoom()) && (
            <CallChatToggle />
          )}
          <PopOut
            id={`menu-${room.roomId}`}
            aria-expanded={!!menuAnchor}
            anchor={menuAnchor}
            offset={menuAnchor?.width === 0 ? 0 : undefined}
            alignOffset={menuAnchor?.width === 0 ? 0 : -5}
            position="Bottom"
            align={menuAnchor?.width === 0 ? 'Start' : 'End'}
            content={
              <FocusTrap
                focusTrapOptions={{
                  initialFocus: false,
                  returnFocusOnDeactivate: false,
                  onDeactivate: () => setMenuAnchor(undefined),
                  clickOutsideDeactivates: true,
                  isKeyForward: (evt: KeyboardEvent) => evt.key === 'ArrowDown',
                  isKeyBackward: (evt: KeyboardEvent) => evt.key === 'ArrowUp',
                  escapeDeactivates: stopPropagation,
                }}
              >
                <RoomNavItemMenu
                  room={room}
                  requestClose={() => setMenuAnchor(undefined)}
                  notificationMode={notificationMode}
                />
              </FocusTrap>
            }
          >
            <IconButton
              onClick={handleOpenMenu}
              aria-pressed={!!menuAnchor}
              aria-controls={`menu-${room.roomId}`}
              aria-label={t('features:room-nav.more_options')}
              variant="Background"
              fill="None"
              size="300"
              radii="300"
            >
              <Icon size="50" src={Icons.VerticalDots} />
            </IconButton>
          </PopOut>
        </NavItemOptions>
      )}
    </NavItem>
  );
}
