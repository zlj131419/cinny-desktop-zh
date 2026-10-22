import React from 'react';
import { Avatar, Box, Icon, Icons, Text, color, toRem } from 'folds';
import { useMatch, useNavigate } from 'react-router-dom';
import { ScreenSize, useScreenSizeContext } from '../../hooks/useScreenSize';
import { DIRECT_PATH, EXPLORE_PATH, HOME_PATH, INBOX_PATH, ME_PATH } from '../paths';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useUserProfile } from '../../hooks/useUserProfile';
import { UserAvatar } from '../../components/user-avatar';
import { getMxIdLocalPart, mxcUrlToHttp } from '../../utils/matrix';
import { useMediaAuthentication } from '../../hooks/useMediaAuthentication';
import { nameInitials } from '../../utils/common';

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

export function MobileTabBar() {
  const screenSize = useScreenSizeContext();
  const navigate = useNavigate();
  const mx = useMatrixClient();
  const useAuthentication = useMediaAuthentication();

  const homeMatch = useMatch({ path: HOME_PATH, caseSensitive: true, end: true });
  const directMatch = useMatch({ path: DIRECT_PATH, caseSensitive: true, end: true });
  const exploreMatch = useMatch({ path: EXPLORE_PATH, caseSensitive: true, end: true });
  const meMatch = useMatch({ path: ME_PATH, caseSensitive: true, end: true });
  const inboxMatch = useMatch({ path: INBOX_PATH, caseSensitive: true, end: true });

  const userId = mx.getUserId() ?? '';
  const profile = useUserProfile(userId);

  if (screenSize !== ScreenSize.Mobile) return null;
  if (!(homeMatch || directMatch || exploreMatch || meMatch || inboxMatch)) return null;

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
      shrink="No"
      style={{
        borderTop: `1px solid ${color.SurfaceVariant.ContainerLine}`,
        backgroundColor: color.Surface.Container,
        paddingBottom: 'env(safe-area-inset-bottom)',
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
          onClick={() => navigate(tab.path)}
          aria-pressed={tab.active}
          style={{
            padding: `${toRem(6)} 0`,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: tab.active ? color.Primary.Main : color.SurfaceVariant.OnContainer,
          }}
        >
          {tab.avatar ?? (tab.icon && <Icon src={tab.icon} size="200" filled={tab.active} />)}
          <Text size="T100" style={{ color: 'inherit' }}>
            {tab.label}
          </Text>
        </Box>
      ))}
    </Box>
  );
}
