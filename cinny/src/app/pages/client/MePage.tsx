import React, { ReactNode, useEffect, useState } from 'react';
import { Avatar, Box, Icon, Icons, Text, color, config, toRem } from 'folds';
import { useNavigate } from 'react-router-dom';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useUserProfile } from '../../hooks/useUserProfile';
import { UserAvatar } from '../../components/user-avatar';
import { getMxIdLocalPart, mxcUrlToHttp } from '../../utils/matrix';
import { useMediaAuthentication } from '../../hooks/useMediaAuthentication';
import { nameInitials } from '../../utils/common';
import { Modal500 } from '../../components/Modal500';
import { Settings, SettingsPages } from '../../features/settings';
import { useAtomValue } from 'jotai';
import { INotificationsResponse, Method } from 'matrix-js-sdk';
import { allInvitesAtom } from '../../state/room-list/inviteList';
import { logoutClient } from '../../../client/initMatrix';
import { INBOX_PATH } from '../paths';
import { SIYU_VERSION } from '../../../version';

/**
 * 「我」页面（手机版底部导航）：自己的头像与名字 + 菜单式功能列表。
 * 其余功能收纳于此：设置（弹窗，与侧边栏同一套）、收件箱、下载、关于。
 */

// 统一行式菜单：图标 + 标题 + 右侧，每行整宽（不用 SequenceCard，它是横排会把多行挤成多列）
function MeRow({
  first,
  icon,
  label,
  after,
  onClick,
  href,
}: {
  first?: boolean;
  icon: typeof Icons.Setting;
  label: string;
  after?: ReactNode;
  onClick?: () => void;
  href?: string;
}) {
  const style: React.CSSProperties = {
    width: '100%',
    padding: `${toRem(11)} ${config.space.S300}`,
    background: 'transparent',
    color: color.Surface.OnContainer,
    borderTop: first
      ? undefined
      : `${config.borderWidth.B300} solid ${color.SurfaceVariant.ContainerLine}`,
  };
  const content = (
    <>
      <Box
        shrink="No"
        alignItems="Center"
        justifyContent="Center"
        style={{ width: toRem(26) }}
      >
        <Icon src={icon} size="200" />
      </Box>
      <Box grow="Yes">
        <Text size="T400">{label}</Text>
      </Box>
      {after}
    </>
  );
  if (href) {
    return (
      <Box
        as="a"
        href={href}
        alignItems="Center"
        gap="300"
        style={{ ...style, textDecoration: 'none' }}
      >
        {content}
      </Box>
    );
  }
  if (onClick) {
    return (
      <Box
        as="button"
        onClick={onClick}
        alignItems="Center"
        gap="300"
        style={{ ...style, cursor: 'pointer', textAlign: 'left' }}
      >
        {content}
      </Box>
    );
  }
  return (
    <Box alignItems="Center" gap="300" style={style}>
      {content}
    </Box>
  );
}

const cardStyle: React.CSSProperties = {
  backgroundColor: color.Surface.Container,
  borderRadius: toRem(12),
  overflow: 'hidden',
};

export function MePage() {
  const mx = useMatrixClient();
  const navigate = useNavigate();
  const useAuthentication = useMediaAuthentication();
  const userId = mx.getUserId() ?? '';
  const profile = useUserProfile(userId);
  const [settingsPage, setSettingsPage] = useState<SettingsPages | null>(null);
  const [confirmLogout, setConfirmLogout] = useState(false);
  // 收件箱角标：邀请数 + 未读通知数（统一一个数字，不展开列表）
  const invites = useAtomValue(allInvitesAtom);
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  useEffect(() => {
    let alive = true;
    mx.http
      .authedRequest<INotificationsResponse>(Method.Get, '/notifications', { limit: 50 })
      .then((res) => {
        if (alive) setUnreadNotifs((res.notifications ?? []).filter((n) => !n.read).length);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [mx]);
  const inboxCount = invites.length + unreadNotifs;
  const inboxBadge =
    inboxCount > 0 ? (
      <span
        style={{
          backgroundColor: color.Critical.Main,
          color: '#fff',
          borderRadius: toRem(999),
          padding: `0 ${toRem(6)}`,
          fontSize: toRem(11),
          lineHeight: toRem(18),
          minWidth: toRem(18),
          textAlign: 'center',
        }}
      >
        {inboxCount > 99 ? '99+' : inboxCount}
      </span>
    ) : null;
  const handleLogout = () => {
    if (!confirmLogout) {
      setConfirmLogout(true);
      setTimeout(() => setConfirmLogout(false), 3000);
      return;
    }
    logoutClient(mx);
  };

  const displayName = profile.displayName ?? getMxIdLocalPart(userId) ?? userId;
  const avatarUrl = profile.avatarUrl
    ? mxcUrlToHttp(mx, profile.avatarUrl, useAuthentication, 160, 160, 'crop') ?? undefined
    : undefined;

  return (
    <Box grow="Yes" direction="Column" style={{ overflowY: 'auto', padding: config.space.S400 }}>
      <Box
        alignItems="Center"
        gap="400"
        style={{ padding: `${config.space.S300} 0 ${config.space.S500}` }}
      >
        <Avatar size="500">
          <UserAvatar
            userId={userId}
            src={avatarUrl}
            alt={displayName}
            renderFallback={() => (
              <Text size="H4">
                <b>{nameInitials(displayName)}</b>
              </Text>
            )}
          />
        </Avatar>
        <Box direction="Column" gap="100">
          <Text size="H4">{displayName}</Text>
          <Text size="T300" priority="300">
            {userId}
          </Text>
        </Box>
      </Box>

      <Box direction="Column" style={cardStyle}>
        <MeRow
          first
          icon={Icons.Inbox}
          label="收件箱"
          after={
            <>
              {inboxBadge}
              <Icon src={Icons.ChevronRight} size="100" />
            </>
          }
          onClick={() => navigate(INBOX_PATH)}
        />
      </Box>

      <Box direction="Column" style={{ ...cardStyle, marginTop: config.space.S300 }}>
        {[
          { page: SettingsPages.GeneralPage, icon: Icons.Setting, label: '通用' },
          { page: SettingsPages.AccountPage, icon: Icons.User, label: '账号' },
          { page: SettingsPages.NotificationPage, icon: Icons.Bell, label: '通知' },
          { page: SettingsPages.DevicesPage, icon: Icons.Monitor, label: '设备' },
          { page: SettingsPages.EmojisStickersPage, icon: Icons.Smile, label: '表情与贴纸' },
          { page: SettingsPages.DeveloperToolsPage, icon: Icons.Terminal, label: '开发者工具' },
        ].map((item, i) => (
          <MeRow
            key={item.label}
            first={i === 0}
            icon={item.icon}
            label={item.label}
            after={<Icon src={Icons.ChevronRight} size="100" />}
            onClick={() => setSettingsPage(item.page)}
          />
        ))}
        <MeRow
          icon={Icons.Download}
          label="下载私语 App"
          after={<Icon src={Icons.ChevronRight} size="100" />}
          href="/public/download.html"
        />
        <MeRow
          icon={Icons.Info}
          label="关于"
          after={
            <>
              <Text size="T300" priority="300">
                v{SIYU_VERSION}
              </Text>
              <Icon src={Icons.ChevronRight} size="100" />
            </>
          }
          onClick={() => setSettingsPage(SettingsPages.AboutPage)}
        />
      </Box>

      <Box
        as="button"
        onClick={handleLogout}
        justifyContent="Center"
        alignItems="Center"
        style={{
          width: '100%',
          marginTop: config.space.S300,
          padding: toRem(11),
          backgroundColor: color.Surface.Container,
          borderRadius: toRem(12),
          border: 'none',
          cursor: 'pointer',
        }}
      >
        <Text size="T400" style={{ color: color.Critical.Main }}>
          {confirmLogout ? '确认退出登录？' : '退出登录'}
        </Text>
      </Box>

      {settingsPage !== null && (
        <Modal500 requestClose={() => setSettingsPage(null)}>
          <Settings initialPage={settingsPage} requestClose={() => setSettingsPage(null)} />
        </Modal500>
      )}
    </Box>
  );
}
