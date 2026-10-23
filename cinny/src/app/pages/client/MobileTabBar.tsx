import React, { useEffect, useMemo, useState } from 'react';
import { Avatar, Box, Icon, Icons, Text, color, toRem } from 'folds';
import { useAtomValue } from 'jotai';
import { useLocation, useMatch, useNavigate } from 'react-router-dom';
import { ScreenSize, useScreenSizeContext } from '../../hooks/useScreenSize';
import { DIRECT_PATH, EXPLORE_PATH, HOME_PATH, ME_PATH } from '../paths';
import { getDirectRoomPath, getHomeRoomPath } from '../pathUtils';
import { roomToUnreadAtom } from '../../state/room/roomToUnread';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useUserProfile } from '../../hooks/useUserProfile';
import { UserAvatar } from '../../components/user-avatar';
import { getMxIdLocalPart, mxcUrlToHttp } from '../../utils/matrix';
import { useMediaAuthentication } from '../../hooks/useMediaAuthentication';
import { nameInitials } from '../../utils/common';
import { setAppBadge } from '../../utils/keepAlive';

/**
 * 手机版底部导航（微信式）：私语 / 通讯录 / 发现 / 我。
 * 仅在四个顶级页面显示；进入聊天房间后自动隐藏。桌面端不渲染。
 */

type TabDef = {
  key: string;
  label: string;
  path: string;
  active: boolean;
  icon?: (typeof Icons)[keyof typeof Icons];
  avatar?: React.ReactNode;
};


// 键盘是否弹起：iOS 键盘弹起时布局视口高（innerHeight）不变、可视视口
// （visualViewport）变矮，差值即键盘高度；收起时两者相等。安卓窗口被系统
// 缩高（adjustResize）时两者同步变化、差值约 0，不受影响。
function useKeyboardOpen(): boolean {
  const [kbOpen, setKbOpen] = useState(false);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return undefined;
    const onResize = () => setKbOpen(window.innerHeight - vv.height > 100);
    vv.addEventListener('resize', onResize);
    onResize();
    return () => vv.removeEventListener('resize', onResize);
  }, []);
  return kbOpen;
}

export function MobileTabBar() {
  const screenSize = useScreenSizeContext();
  const kbOpen = useKeyboardOpen();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const mx = useMatrixClient();
  const useAuthentication = useMediaAuthentication();

  const homeMatch = useMatch({ path: HOME_PATH, caseSensitive: true, end: true });
  const directMatch = useMatch({ path: DIRECT_PATH, caseSensitive: true, end: true });
  const exploreMatch = useMatch({ path: EXPLORE_PATH, caseSensitive: true, end: false });
  const meMatch = useMatch({ path: ME_PATH, caseSensitive: true, end: true });

  const userId = mx.getUserId() ?? '';
  const profile = useUserProfile(userId);

  // 未读直接读未读表的一线房间条目（from 为 null；空间的聚合条目不算）——
  // 与会话列表角标同一数据源：自己读完、回执一到条目即删，角标同步清
  const roomToUnread = useAtomValue(roomToUnreadAtom);
  const unreadRoomIds = useMemo(
    () =>
      [...roomToUnread.entries()]
        .filter(([, u]) => u.from === null && u.total > 0)
        .map(([roomId]) => roomId),
    [roomToUnread]
  );
  const unreadTotal = useMemo(
    () =>
      [...roomToUnread.entries()].reduce(
        (sum, [, u]) => (u.from === null && u.total > 0 ? sum + u.total : sum),
        0
      ),
    [roomToUnread]
  );

  // 桌面图标角标与未读总数同步（仅安卓 App 实际生效，其余环境自动跳过）
  useEffect(() => {
    void setAppBadge(unreadTotal);
  }, [unreadTotal]);

  // 点「私语」：有未读就依次跳到下一个未读会话（按最近活跃排序、循环）；没有未读回首页
  const handleHomeTab = () => {
    if (unreadRoomIds.length === 0) {
      navigate(HOME_PATH);
      return;
    }
    const sorted = [...unreadRoomIds].sort((a, b) => {
      const ta = mx.getRoom(a)?.getLastActiveTimestamp() ?? 0;
      const tb = mx.getRoom(b)?.getLastActiveTimestamp() ?? 0;
      return tb - ta;
    });
    const seg = pathname.split('/').filter(Boolean);
    let currentRoomId: string | undefined;
    try {
      if ((seg[0] === 'home' || seg[0] === 'direct') && seg[1]) {
        currentRoomId = decodeURIComponent(seg[1]);
      } else if (seg[0] === 'space' && seg[2]) {
        currentRoomId = decodeURIComponent(seg[2]);
      }
    } catch {
      currentRoomId = undefined;
    }
    const idx = currentRoomId ? sorted.indexOf(currentRoomId) : -1;
    const nextId = sorted[(idx + 1) % sorted.length];
    const dmContent = mx.getAccountData('m.direct')?.getContent<Record<string, string[]>>() ?? {};
    const isDM = Object.values(dmContent).some((ids) => Array.isArray(ids) && ids.includes(nextId));
    navigate(isDM ? getDirectRoomPath(nextId) : getHomeRoomPath(nextId));
  };

  // 底部导航与系统预留区同色：把导航实测背景色同步给 html/body 画布和 theme-color，
  // 状态栏区、回弹区、底部小横条所在区都由系统按画布色填充——换主题时观察 class 变化自动跟随，永不突兀
  useEffect(() => {
    const syncCanvasColor = () => {
      const bar = document.getElementById('siyu-tabbar');
      if (!bar) return;
      const c = getComputedStyle(bar).backgroundColor;
      if (!c) return;
      document.documentElement.style.backgroundColor = c;
      if (document.body) document.body.style.backgroundColor = c;
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', c);
    };
    syncCanvasColor();
    const raf = requestAnimationFrame(syncCanvasColor);
    const mo = new MutationObserver(() => requestAnimationFrame(syncCanvasColor));
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
      subtree: true,
    });
    return () => {
      cancelAnimationFrame(raf);
      mo.disconnect();
    };
  }, []);

  if (screenSize !== ScreenSize.Mobile) return null;

  // 聊天界面（有消息输入框的房间页）不显示底部导航，只留安全区垫高
  const inRoom =
    /^\/(home|direct)\/[^/]+/.test(pathname) || /^\/space\/[^/]+\/[^/]+/.test(pathname);
  if (inRoom) {
    // 键盘弹起时安全区垫高收起：键盘已盖住小横条区，再留 34px 就成了
    // 输入框与键盘之间的一块黑带；收起键盘时恢复，保证小横条不压内容
    return (
      <Box shrink="No" style={{ height: kbOpen ? 0 : 'env(safe-area-inset-bottom)' }} />
    );
  }

  const displayName = profile.displayName ?? getMxIdLocalPart(userId) ?? userId;
  const avatarUrl = profile.avatarUrl
    ? mxcUrlToHttp(mx, profile.avatarUrl, useAuthentication, 64, 64, 'crop') ?? undefined
    : undefined;

  const tabs: TabDef[] = [
    { key: 'home', label: '私语', path: HOME_PATH, active: !!homeMatch, icon: Icons.Message },
    { key: 'direct', label: '通讯录', path: DIRECT_PATH, active: !!directMatch, icon: Icons.User },
    { key: 'explore', label: '发现', path: EXPLORE_PATH, active: !!exploreMatch, icon: Icons.Explore },
    {
      key: 'me',
      label: '我',
      path: ME_PATH,
      active: !!meMatch,
      avatar: (
        <Avatar size="200">
          <UserAvatar
            userId={userId}
            src={avatarUrl}
            alt={displayName}
            renderFallback={() => (
              <Text size="T200">
                <b>{nameInitials(displayName)}</b>
              </Text>
            )}
          />
        </Avatar>
      ),
    },
  ];

  return (
    <Box
      id="siyu-tabbar"
      shrink="No"
      style={{
        backgroundColor: color.Surface.Container,
        // 底部不留白：文字直接坐在屏幕底（系统小横条浮在其上），只给按钮留 1px
        paddingBottom: 0,
      }}
    >
      {tabs.map((tab) => (
        <Box
          key={tab.key}
          as="button"
          grow="Yes"
          direction="Column"
          alignItems="Center"
          justifyContent="Center"
          gap="100"
          onClick={() => (tab.key === 'home' ? handleHomeTab() : navigate(tab.path))}
          aria-pressed={tab.active}
          style={{
            padding: `${toRem(3)} 0 ${toRem(1)}`,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: tab.active ? color.Primary.Main : color.SurfaceVariant.OnContainer,
          }}
        >
          <Box style={{ position: 'relative' }}>
            {tab.avatar ?? (tab.icon && <Icon src={tab.icon} size="100" filled={tab.active} />)}
            {tab.key === 'home' && unreadTotal > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: toRem(-5),
                  right: toRem(-12),
                  minWidth: toRem(17),
                  height: toRem(17),
                  padding: `0 ${toRem(4)}`,
                  borderRadius: toRem(9),
                  backgroundColor: color.Critical.Main,
                  color: '#fff',
                  fontSize: toRem(10),
                  fontWeight: 700,
                  lineHeight: toRem(17),
                  textAlign: 'center',
                  boxSizing: 'border-box',
                }}
              >
                {unreadTotal > 99 ? '99+' : unreadTotal}
              </span>
            )}
          </Box>
          <Text size="T100" style={{ color: 'inherit' }}>
            {tab.label}
          </Text>
        </Box>
      ))}
    </Box>
  );
}
