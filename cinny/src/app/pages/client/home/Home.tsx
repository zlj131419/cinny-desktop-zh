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
  getSpaceRoomPath,
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
import { siyuTouchDrag } from '../../../utils/siyuDrag';
import { makeNavCategoryId } from '../../../state/closedNavCategories';
import { roomToUnreadAtom } from '../../../state/room/roomToUnread';
import { mDirectAtom } from '../../../state/mDirectList';
import { isSpace, getRoomToParents, getAllParents } from '../../../utils/room';
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
  // 分组折叠状态（本地记忆）
  const [closedGroups, setClosedGroups] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem('siyu-closed-groups');
      return new Set(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
      return new Set<string>();
    }
  });
  React.useEffect(() => {
    if (!touchDrag) return;
    const prevent = (e: TouchEvent) => e.preventDefault();
    document.addEventListener('touchmove', prevent, { passive: false });
    return () => document.removeEventListener('touchmove', prevent);
  }, [touchDrag]);
  const toggleGroup = (name: string) => {
    setClosedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      try {
        localStorage.setItem('siyu-closed-groups', JSON.stringify(Array.from(next)));
      } catch {
        /* ignore */
      }
      return next;
    });
  };
  // 分组顺序（本地记忆，新分组排最后）
  const [groupOrder, setGroupOrder] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('siyu-group-order');
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  });
  const moveGroup = (name: string, dir: -1 | 1, allNames: string[]) => {
    setGroupOrder((prev) => {
      const base = allNames.filter((n) => prev.includes(n)).concat(allNames.filter((n) => !prev.includes(n)));
      const merged = prev.length ? base : [...allNames];
      const list = [...merged];
      const idx = list.indexOf(name);
      const swap = idx + dir;
      if (idx < 0 || swap < 0 || swap >= list.length) return prev;
      [list[idx], list[swap]] = [list[swap], list[idx]];
      try {
        localStorage.setItem('siyu-group-order', JSON.stringify(list));
      } catch {
        /* ignore */
      }
      return list;
    });
  };
  // 拖拽：当前拖动的房间（桌面 HTML5）
  const dragRoomIdRef = useRef<string | null>(null);
  // 触屏拖拽：ghost 跟随手指 + 悬停落点高亮
  const [touchDrag, setTouchDrag] = useState<{ roomId: string; x: number; y: number } | null>(null);
  const [hoverDrop, setHoverDrop] = useState<string | null>(null);
  const touchRef = useRef<{
    roomId: string; startX: number; startY: number; lastX: number; lastY: number;
    armed: boolean; active: boolean; timer: ReturnType<typeof setTimeout> | null;
  } | null>(null);
  const dropNameAt = (x: number, y: number): string | null => {
    try {
      const el = document.elementFromPoint(x, y)?.closest('[data-siyu-drop]');
      return el ? (el.getAttribute('data-siyu-drop') as string) : null;
    } catch { return null; }
  };
  const applyDrop = (roomId: string, dropName: string | null) => {
    if (!dropName) return;
    if (dropName === '__ungroup__') {
      mx.deleteRoomTag(roomId, 'com.siyu.group').catch(() => {});
    } else {
      mx.setRoomTag(roomId, 'com.siyu.group', { name: dropName }).catch(() => {});
    }
  };
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
  // 所有房间都用 Home 路径，不跳转页面（HomeRouteRoomProvider 已改为接受所有房间）
  const getRoomLinkPath = (roomId: string): string => {
    const roomIdOrAlias = getCanonicalAliasOrRoomId(mx, roomId);
    try {
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

  // 构建带分组标题的显示列表（所有聊天模式下按分组分区）
  type DisplayItem = { type: 'header'; title: string } | { type: 'room'; roomId: string };
  const displayItems = useMemo<DisplayItem[]>(() => {
    if (viewMode !== 'all') {
      return sortedRooms.map((roomId) => ({ type: 'room' as const, roomId }));
    }
    const getGroup = (rId: string): string | undefined => {
      try {
        const room = mx.getRoom(rId);
        const n = room?.tags?.['com.siyu.group']?.name;
        return typeof n === 'string' && n ? n : undefined;
      } catch {
        return undefined;
      }
    };
    const grouped = new Map<string, string[]>();
    const ungrouped: string[] = [];
    sortedRooms.forEach((rId) => {
      const g = getGroup(rId);
      if (g) {
        const arr = grouped.get(g) ?? [];
        arr.push(rId);
        grouped.set(g, arr);
      } else {
        ungrouped.push(rId);
      }
    });
    if (grouped.size === 0) {
      return sortedRooms.map((roomId) => ({ type: 'room' as const, roomId }));
    }
    const items: DisplayItem[] = [];
    // 分组按用户自定义顺序（groupOrder 优先，其余按名称），每个分组前加标题
    const names = Array.from(grouped.keys());
    const ordered = [
      ...groupOrder.filter((n) => names.includes(n)),
      ...names.filter((n) => !groupOrder.includes(n)).sort(),
    ];
    ordered.forEach((g) => {
      items.push({ type: 'header', title: g });
      if (!closedGroups.has(g)) {
        (grouped.get(g) ?? []).forEach((roomId) => items.push({ type: 'room', roomId }));
      }
    });
    // 未分组的默认排在所有分组下面（保持活跃排序）
    ungrouped.forEach((roomId) => items.push({ type: 'room', roomId }));
    return items;
  }, [viewMode, sortedRooms, mx, closedGroups, groupOrder]);

  const virtualizer = useVirtualizer({
    count: displayItems.length,
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
                <div
                  data-siyu-drop="__ungroup__"
                  onDragOver={(e: React.DragEvent) => e.preventDefault()}
                  onDrop={(e: React.DragEvent) => {
                    e.preventDefault();
                    const rid = dragRoomIdRef.current ?? e.dataTransfer.getData('text/siyu-room');
                    if (rid) applyDrop(rid, '__ungroup__');
                    dragRoomIdRef.current = null;
                  }}
                  style={{
                    background: hoverDrop === '__ungroup__' ? 'rgba(63, 131, 246, 0.18)' : undefined,
                    borderRadius: 8,
                  }}
                  title="拖到此处可移出分组"
                >
                  <RoomNavCategoryButton
                    closed={closedCategories.has(DEFAULT_CATEGORY_ID)}
                    data-category-id={DEFAULT_CATEGORY_ID}
                    onClick={handleCategoryClick}
                  >
                    {'所有'}
                  </RoomNavCategoryButton>
                </div>
              </NavCategoryHeader>
              <div
                style={{
                  position: 'relative',
                  height: virtualizer.getTotalSize(),
                }}
              >
                {virtualizer.getVirtualItems().map((vItem) => {
                  const item = displayItems[vItem.index];
                  if (!item) return null;
                  if (item.type === 'header') {
                    const groupNames = displayItems
                      .filter((d) => d.type === 'header')
                      .map((d) => (d.type === 'header' ? d.title : ''));
                    const isClosed = closedGroups.has(item.title);
                    return (
                      <VirtualTile
                        virtualItem={vItem}
                        key={vItem.index}
                        ref={virtualizer.measureElement}
                      >
                        <Box
                          direction="Row"
                          alignItems="Center"
                          gap="100"
                          onDragOver={(e: React.DragEvent) => {
                            e.preventDefault();
                          }}
                          data-siyu-drop={item.title}
                          onDrop={(e: React.DragEvent) => {
                            e.preventDefault();
                            const rid = dragRoomIdRef.current ?? e.dataTransfer.getData('text/siyu-room');
                            if (rid) applyDrop(rid, item.title);
                            dragRoomIdRef.current = null;
                          }}
                          style={{
                            padding: `${config.space.S300} ${config.space.S200} ${config.space.S100}`,
                            cursor: 'pointer',
                            background:
                              hoverDrop === item.title ? 'rgba(63, 131, 246, 0.18)' : undefined,
                            borderRadius: 8,
                          }}
                        >
                          <RoomNavCategoryButton
                            closed={isClosed}
                            onClick={() => toggleGroup(item.title)}
                          >
                            {item.title}
                          </RoomNavCategoryButton>
                          <span style={{ flexGrow: 1 }} />
                          <span
                            role="button"
                            aria-label="上移"
                            onClick={(e) => {
                              e.stopPropagation();
                              moveGroup(item.title, -1, groupNames);
                            }}
                            style={{ padding: '0 4px', opacity: 0.7 }}
                          >
                            ↑
                          </span>
                          <span
                            role="button"
                            aria-label="下移"
                            onClick={(e) => {
                              e.stopPropagation();
                              moveGroup(item.title, 1, groupNames);
                            }}
                            style={{ padding: '0 4px', opacity: 0.7 }}
                          >
                            ↓
                          </span>
                        </Box>
                      </VirtualTile>
                    );
                  }
                  const roomId = item.roomId;
                  const room = mx.getRoom(roomId);
                  if (!room) return null;
                  const selected = selectedRoomId === roomId;

                  return (
                    <VirtualTile
                      virtualItem={vItem}
                      key={vItem.index}
                      ref={virtualizer.measureElement}
                    >
                      <div
                        draggable
                        style={{ WebkitTouchCallout: 'none', userSelect: 'none', WebkitUserSelect: 'none' }}
                        onDragStart={(e: React.DragEvent) => {
                          dragRoomIdRef.current = roomId;
                          try {
                            e.dataTransfer.setData('text/siyu-room', roomId);
                            e.dataTransfer.effectAllowed = 'move';
                          } catch {
                            /* ignore */
                          }
                        }}
                        onDragEnd={() => {
                          dragRoomIdRef.current = null;
                        }}
                        onTouchStart={(e: React.TouchEvent) => {
                          const t = e.touches[0];
                          if (!t) return;
                          const rec = {
                            roomId, startX: t.clientX, startY: t.clientY,
                            lastX: t.clientX, lastY: t.clientY,
                            armed: false, active: false, timer: null as ReturnType<typeof setTimeout> | null,
                          };
                          rec.timer = setTimeout(() => { rec.armed = true; }, 260);
                          touchRef.current = rec;
                        }}
                        onTouchMove={(e: React.TouchEvent) => {
                          const rec = touchRef.current;
                          const t = e.touches[0];
                          if (!rec || !t) return;
                          rec.lastX = t.clientX; rec.lastY = t.clientY;
                          if (!rec.active && rec.armed && Math.hypot(t.clientX - rec.startX, t.clientY - rec.startY) > 10) {
                            rec.active = true;
                            siyuTouchDrag.active = true;
                            try { navigator.vibrate?.(15); } catch { /* ignore */ }
                            setTouchDrag({ roomId: rec.roomId, x: t.clientX, y: t.clientY });
                          }
                          if (rec.active) {
                            setTouchDrag({ roomId: rec.roomId, x: t.clientX, y: t.clientY });
                            const g = dropNameAt(t.clientX, t.clientY);
                            setHoverDrop((prev) => (prev === g ? prev : g));
                          }
                        }}
                        onTouchEnd={() => {
                          const rec = touchRef.current;
                          if (rec?.timer) clearTimeout(rec.timer);
                          if (rec?.active) {
                            applyDrop(rec.roomId, dropNameAt(rec.lastX, rec.lastY));
                          }
                          siyuTouchDrag.active = false;
                          setTouchDrag(null);
                          setHoverDrop(null);
                          touchRef.current = null;
                        }}
                        onTouchCancel={() => {
                          const rec = touchRef.current;
                          if (rec?.timer) clearTimeout(rec.timer);
                          siyuTouchDrag.active = false;
                          setTouchDrag(null);
                          setHoverDrop(null);
                          touchRef.current = null;
                        }}
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
                      </div>
                    </VirtualTile>
                  );
                })}
              </div>
            </NavCategory>
          </Box>
          {touchDrag && (
            <div
              style={{
                position: 'fixed',
                left: touchDrag.x - 70,
                top: touchDrag.y - 24,
                width: 140,
                padding: '8px 12px',
                background: 'rgba(63, 131, 246, 0.92)',
                color: '#fff',
                borderRadius: 8,
                fontSize: 13,
                textAlign: 'center',
                pointerEvents: 'none',
                zIndex: 9999,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
              }}
            >
              {(() => {
                try {
                  return mx.getRoom(touchDrag.roomId)?.name ?? '';
                } catch {
                  return '';
                }
              })()}
            </div>
          )}
        </PageNavContent>
      )}
    </PageNav>
  );
}
