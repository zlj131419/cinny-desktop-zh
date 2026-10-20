import React, { MouseEventHandler, forwardRef, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Avatar,
  Box,
  Button,
  Icon,
  IconButton,
  Icons,
  Menu,
  MenuItem,
  PopOut,
  RectCords,
  Text,
  config,
  toRem,
} from 'folds';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useAtom, useAtomValue } from 'jotai';
import FocusTrap from 'focus-trap-react';
import { factoryRoomIdByActivity, factoryRoomIdByAtoZ } from '../../../utils/sort';
import {
  NavButton,
  NavCategory,
  NavCategoryHeader,
  NavEmptyCenter,
  NavEmptyLayout,
  NavItem,
  NavItemContent,
  NavLink,
} from '../../../components/nav';
import {
  encodeSearchParamValueArray,
  getExplorePath,
  getHomeCreatePath,
  getHomeRoomPath,
  getDirectRoomPath,
  getSpacePath,
  getHomeSearchPath,
  withSearchParam,
} from '../../pathUtils';
import { getCanonicalAliasOrRoomId } from '../../../utils/matrix';
import { useSelectedRoom } from '../../../hooks/router/useSelectedRoom';
import {
  useHomeCreateSelected,
  useHomeSearchSelected,
} from '../../../hooks/router/useHomeSelected';
import { useHomeRooms } from './useHomeRooms';
import { useAllRooms } from './useAllRooms';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import { VirtualTile } from '../../../components/virtualizer';
import { RoomNavCategoryButton, RoomNavItem } from '../../../features/room-nav';
import { makeNavCategoryId } from '../../../state/closedNavCategories';
import { roomToUnreadAtom } from '../../../state/room/roomToUnread';
import { mDirectAtom } from '../../../state/mDirectList';
import { isSpace } from '../../../utils/room';
import { useCategoryHandler } from '../../../hooks/useCategoryHandler';
import { useNavToActivePathMapper } from '../../../hooks/useNavToActivePathMapper';
import { PageNav, PageNavHeader, PageNavContent } from '../../../components/page';
import { useRoomsUnread } from '../../../state/hooks/unread';
import { markAsRead } from '../../../utils/notifications';
import { useClosedNavCategoriesAtom } from '../../../state/hooks/closedNavCategories';
import { stopPropagation } from '../../../utils/keyboard';
import { useSetting } from '../../../state/hooks/settings';
import { settingsAtom } from '../../../state/settings';
import {
  getRoomNotificationMode,
  useRoomsNotificationPreferencesContext,
} from '../../../hooks/useRoomsNotificationPreferences';
import { UseStateProvider } from '../../../components/UseStateProvider';
import { JoinAddressPrompt } from '../../../components/join-address-prompt';
import { _RoomSearchParams } from '../../paths';
import { useTranslation } from 'react-i18next';

type HomeMenuProps = {
  requestClose: () => void;
};
const HomeMenu = forwardRef<HTMLDivElement, HomeMenuProps>(({ requestClose }, ref) => {
  const { t } = useTranslation();
  const orphanRooms = useHomeRooms();
  const [hideActivity] = useSetting(settingsAtom, 'hideActivity');
  const unread = useRoomsUnread(orphanRooms, roomToUnreadAtom);
  const mx = useMatrixClient();

  const handleMarkAsRead = () => {
    if (!unread) return;
    orphanRooms.forEach((rId) => markAsRead(mx, rId, hideActivity));
    requestClose();
  };

  return (
    <Menu ref={ref} style={{ maxWidth: toRem(160), width: '100vw' }}>
      <Box direction="Column" gap="100" style={{ padding: config.space.S100 }}>
        <MenuItem
          onClick={handleMarkAsRead}
          size="300"
          after={<Icon size="100" src={Icons.CheckTwice} />}
          radii="300"
          aria-disabled={!unread}
        >
          <Text style={{ flexGrow: 1 }} as="span" size="T300" truncate>
            {t('pages:client.home.mark_as_read')}
          </Text>
        </MenuItem>
      </Box>
    </Menu>
  );
});

function HomeHeader() {
  const { t } = useTranslation();
  const [menuAnchor, setMenuAnchor] = useState<RectCords>();
  const handleOpenMenu: MouseEventHandler<HTMLButtonElement> = (evt) => {
    const cords = evt.currentTarget.getBoundingClientRect();
    setMenuAnchor((currentState) => {
      if (currentState) return undefined;
      return cords;
    });
  };

  return (
    <>
      <PageNavHeader>
        <Box alignItems="Center" grow="Yes" gap="300">
          <Box grow="Yes">
            <Text size="H4" truncate>
              {t('pages:client.home.home')}
            </Text>
          </Box>
          <Box>
            <IconButton aria-pressed={!!menuAnchor} variant="Background" onClick={handleOpenMenu}>
              <Icon src={Icons.VerticalDots} size="200" />
            </IconButton>
          </Box>
        </Box>
      </PageNavHeader>
      <PopOut
        anchor={menuAnchor}
        position="Bottom"
        align="End"
        offset={6}
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
            <HomeMenu requestClose={() => setMenuAnchor(undefined)} />
          </FocusTrap>
        }
      />
    </>
  );
}

function HomeEmpty() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <NavEmptyCenter>
      <NavEmptyLayout
        icon={<Icon size="600" src={Icons.Hash} />}
        title={
          <Text size="H5" align="Center">
            {t('pages:client.home.no_rooms')}
          </Text>
        }
        content={
          <Text size="T300" align="Center">
            {t('pages:client.home.you_do_not_have_any')}
          </Text>
        }
        options={
          <>
            <Button onClick={() => navigate(getHomeCreatePath())} variant="Secondary" size="300">
              <Text size="B300" truncate>
                {t('pages:client.home.create_room')}
              </Text>
            </Button>
            <Button
              onClick={() => navigate(getExplorePath())}
              variant="Secondary"
              fill="Soft"
              size="300"
            >
              <Text size="B300" truncate>
                {t('pages:client.home.explore_community_rooms')}
              </Text>
            </Button>
          </>
        }
      />
    </NavEmptyCenter>
  );
}

const DEFAULT_CATEGORY_ID = makeNavCategoryId('home', 'room');
export function Home() {
  const { t } = useTranslation();
  const mx = useMatrixClient();
  useNavToActivePathMapper('home');
  const scrollRef = useRef<HTMLDivElement>(null);
  const orphanRooms = useHomeRooms();
  const allRoomIds = useAllRooms();
  const mDirects = useAtomValue(mDirectAtom);
  const [viewMode, setViewMode] = useState<'all' | 'friends' | 'rooms' | 'spaces'>('all');
  const [filter, setFilter] = useState<'all' | 'favourite' | 'unread' | 'rooms' | 'friends' | 'mentions'>('all');
  // 确保 rooms 始终是有效字符串数组
  const rooms = useMemo(() => {
    if (!mx) return [];
    let list: string[] = [];
    const isDM = (id: string): boolean => {
      try {
        return !!(mDirects && mDirects.has(id));
      } catch {
        return false;
      }
    };
    const isSpaceRoom = (id: string): boolean => {
      try {
        const room = mx.getRoom(id);
        return room ? isSpace(room) : false;
      } catch {
        return false;
      }
    };
    if (viewMode === 'all') {
      list = allRoomIds;
    } else if (viewMode === 'friends') {
      // 好友：只显示 DM
      list = allRoomIds.filter((id) => typeof id === 'string' && isDM(id));
    } else if (viewMode === 'rooms') {
      // 房间：普通房间（非 DM，非 Space）
      list = allRoomIds.filter(
        (id) => typeof id === 'string' && !isDM(id) && !isSpaceRoom(id)
      );
    } else if (viewMode === 'spaces') {
      // 空间：只显示 Space
      list = allRoomIds.filter((id) => typeof id === 'string' && isSpaceRoom(id));
    }
    if (!Array.isArray(list)) return [];
    return list.filter((id) => typeof id === 'string' && id.startsWith('!'));
  }, [viewMode, allRoomIds, mx, mDirects]);
  const notificationPreferences = useRoomsNotificationPreferencesContext();
  const roomToUnread = useAtomValue(roomToUnreadAtom);
  const navigate = useNavigate();

  const selectedRoomId = useSelectedRoom();
  const createRoomSelected = useHomeCreateSelected();
  const searchSelected = useHomeSearchSelected();
  const noRoomToDisplay = rooms.length === 0;
  const [closedCategories, setClosedCategories] = useAtom(useClosedNavCategoriesAtom());

  // 根据视图模式和房间类型获取正确的跳转路径
  const getRoomLinkPath = (roomId: string): string => {
    const roomIdOrAlias = getCanonicalAliasOrRoomId(mx, roomId);
    try {
      if (viewMode === 'friends') {
        return getDirectRoomPath(roomIdOrAlias);
      }
      if (viewMode === 'spaces') {
        return getSpacePath(roomIdOrAlias);
      }
      const room = mx.getRoom(roomId);
      if (room) {
        if (mDirects?.has(roomId)) {
          return getDirectRoomPath(roomIdOrAlias);
        }
        if (isSpace(room)) {
          return getSpacePath(roomIdOrAlias);
        }
      }
      return getHomeRoomPath(roomIdOrAlias);
    } catch {
      return getHomeRoomPath(roomIdOrAlias);
    }
  };

  const sortedRooms = useMemo(() => {
    if (!mx || !Array.isArray(rooms)) return [];
    let items = Array.from(rooms);
    
    // 筛选（带空检查）
    try {
      if (filter === 'unread' && roomToUnread) {
        items = items.filter((rId) => typeof rId === 'string' && roomToUnread.has(rId));
      } else if (filter === 'friends' && mDirects) {
        items = items.filter((rId) => typeof rId === 'string' && mDirects.has(rId));
      } else if (filter === 'rooms' && mDirects) {
        items = items.filter((rId) => typeof rId === 'string' && !mDirects.has(rId));
      } else if (filter === 'mentions' && roomToUnread) {
        items = items.filter((rId) => typeof rId === 'string' && roomToUnread.has(rId));
      } else if (filter === 'favourite') {
        items = items.filter((rId) => {
          if (typeof rId !== 'string') return false;
          try {
            const room = mx.getRoom(rId);
            return !!(room?.tags?.['m.favourite']);
          } catch {
            return false;
          }
        });
      }
    } catch {
      // 筛选失败时返回原列表
    }
    
    // 排序：置顶 > 收藏 > 按活动时间（带空检查）
    const getRoomSafe = (rId: string) => {
      try {
        if (typeof rId !== 'string') return null;
        return mx.getRoom(rId);
      } catch {
        return null;
      }
    };
    
    const isPinned = (rId: string) => {
      const room = getRoomSafe(rId);
      return !!(room?.tags?.['com.siyu.pinned']);
    };
    const isFav = (rId: string) => {
      const room = getRoomSafe(rId);
      return !!(room?.tags?.['m.favourite']);
    };
    
    const pinnedFav = items.filter((rId) => isPinned(rId) || isFav(rId));
    const rest = items.filter((rId) => !isPinned(rId) && !isFav(rId));
    
    // 置顶排最前，收藏其次
    pinnedFav.sort((a, b) => {
      const pinA = isPinned(a) ? 0 : 1;
      const pinB = isPinned(b) ? 0 : 1;
      if (pinA !== pinB) return pinA - pinB;
      return 0;
    });
    
    try {
      const activitySort = closedCategories.has(DEFAULT_CATEGORY_ID)
        ? factoryRoomIdByActivity(mx)
        : factoryRoomIdByAtoZ(mx);
      rest.sort(activitySort);
    } catch {
      // 排序失败时保持原序
    }
    
    let result = [...pinnedFav, ...rest];
    if (closedCategories.has(DEFAULT_CATEGORY_ID) && roomToUnread) {
      result = result.filter((rId) => roomToUnread.has(rId) || rId === selectedRoomId);
    }
    return result;
  }, [mx, rooms, closedCategories, roomToUnread, selectedRoomId, filter, mDirects]);

  const virtualizer = useVirtualizer({
    count: sortedRooms.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 38,
    overscan: 10,
  });

  const handleCategoryClick = useCategoryHandler(setClosedCategories, (categoryId) =>
    closedCategories.has(categoryId)
  );

  return (
    <PageNav>
      <HomeHeader />
      <Box direction="Column" gap="100" style={{ padding: `${config.space.S200} ${config.space.S300}`, maxWidth: '100%', overflow: 'hidden' }}>
        <Box direction="Row" gap="100" alignItems="Center" wrap="Wrap" style={{ maxWidth: '100%' }}>
          {(['all', 'friends', 'rooms', 'spaces'] as const).map((m) => (
            <Button
              key={m}
              size="300"
              variant={viewMode === m ? 'Primary' : 'Secondary'}
              fill={viewMode === m ? 'Solid' : 'None'}
              onClick={() => setViewMode(m)}
              style={{ flexShrink: 0 }}
            >
              <Text size="T300">
                {m === 'all' ? '所有聊天' : m === 'friends' ? '好友' : m === 'rooms' ? '房间' : '空间'}
              </Text>
            </Button>
          ))}
        </Box>
        {viewMode === 'all' && (
          <Box direction="Row" gap="100" wrap="Wrap" style={{ maxWidth: '100%' }}>
            {(['all', 'favourite', 'unread', 'rooms', 'friends', 'mentions'] as const).map((f) => (
              <Button
                key={f}
                size="300"
                variant={filter === f ? 'Primary' : 'Secondary'}
                fill={filter === f ? 'Solid' : 'None'}
                radii="400"
                onClick={() => setFilter(f)}
                style={{ flexShrink: 0 }}
              >
                <Text size="T300">
                  {f === 'all' ? '全部' : f === 'favourite' ? '收藏' : f === 'unread' ? '未读' : f === 'rooms' ? '房间' : f === 'friends' ? '好友' : '提及'}
                </Text>
              </Button>
            ))}
          </Box>
        )}
      </Box>
      {noRoomToDisplay ? (
        <HomeEmpty />
      ) : (
        <PageNavContent scrollRef={scrollRef}>
          <Box direction="Column" gap="300">
            <NavCategory>
              <NavItem variant="Background" radii="400" aria-selected={createRoomSelected}>
                <NavButton onClick={() => navigate(getHomeCreatePath())}>
                  <NavItemContent>
                    <Box as="span" grow="Yes" alignItems="Center" gap="200">
                      <Avatar size="200" radii="400">
                        <Icon src={Icons.Plus} size="100" />
                      </Avatar>
                      <Box as="span" grow="Yes">
                        <Text as="span" size="Inherit" truncate>
                          {t('pages:client.home.create_room')}
                        </Text>
                      </Box>
                    </Box>
                  </NavItemContent>
                </NavButton>
              </NavItem>
              <UseStateProvider initial={false}>
                {(open, setOpen) => (
                  <>
                    <NavItem variant="Background" radii="400">
                      <NavButton onClick={() => setOpen(true)}>
                        <NavItemContent>
                          <Box as="span" grow="Yes" alignItems="Center" gap="200">
                            <Avatar size="200" radii="400">
                              <Icon src={Icons.Link} size="100" />
                            </Avatar>
                            <Box as="span" grow="Yes">
                              <Text as="span" size="Inherit" truncate>
                                {t('pages:client.home.join_with_address')}
                              </Text>
                            </Box>
                          </Box>
                        </NavItemContent>
                      </NavButton>
                    </NavItem>
                    {open && (
                      <JoinAddressPrompt
                        onCancel={() => setOpen(false)}
                        onOpen={(roomIdOrAlias, viaServers, eventId) => {
                          setOpen(false);
                          const path = getHomeRoomPath(roomIdOrAlias, eventId);
                          navigate(
                            viaServers
                              ? withSearchParam<_RoomSearchParams>(path, {
                                viaServers: encodeSearchParamValueArray(viaServers),
                              })
                              : path
                          );
                        }}
                      />
                    )}
                  </>
                )}
              </UseStateProvider>
              <NavItem variant="Background" radii="400" aria-selected={searchSelected}>
                <NavLink to={getHomeSearchPath()}>
                  <NavItemContent>
                    <Box as="span" grow="Yes" alignItems="Center" gap="200">
                      <Avatar size="200" radii="400">
                        <Icon src={Icons.Search} size="100" filled={searchSelected} />
                      </Avatar>
                      <Box as="span" grow="Yes">
                        <Text as="span" size="Inherit" truncate>
                          {t('pages:client.home.message_search')}
                        </Text>
                      </Box>
                    </Box>
                  </NavItemContent>
                </NavLink>
              </NavItem>
            </NavCategory>
            <NavCategory>
              <NavCategoryHeader>
                <RoomNavCategoryButton
                  closed={closedCategories.has(DEFAULT_CATEGORY_ID)}
                  data-category-id={DEFAULT_CATEGORY_ID}
                  onClick={handleCategoryClick}
                >
                  {t('pages:client.home.rooms')}
                </RoomNavCategoryButton>
              </NavCategoryHeader>
              <div
                style={{
                  position: 'relative',
                  height: virtualizer.getTotalSize(),
                }}
              >
                {virtualizer.getVirtualItems().map((vItem) => {
                  const roomId = sortedRooms[vItem.index];
                  const room = mx.getRoom(roomId);
                  if (!room) return null;
                  const selected = selectedRoomId === roomId;

                  return (
                    <VirtualTile
                      virtualItem={vItem}
                      key={vItem.index}
                      ref={virtualizer.measureElement}
                    >
                      <RoomNavItem
                        room={room}
                        selected={selected}
                        linkPath={getRoomLinkPath(roomId)}
                        notificationMode={getRoomNotificationMode(
                          notificationPreferences,
                          room.roomId
                        )}
                      />
                    </VirtualTile>
                  );
                })}
              </div>
            </NavCategory>
          </Box>
        </PageNavContent>
      )}
    </PageNav>
  );
}
