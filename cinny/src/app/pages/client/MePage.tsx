import React, { useState } from 'react';
import { Avatar, Box, Icon, Icons, Text, config } from 'folds';
import { useNavigate } from 'react-router-dom';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useUserProfile } from '../../hooks/useUserProfile';
import { UserAvatar } from '../../components/user-avatar';
import { getMxIdLocalPart, mxcUrlToHttp } from '../../utils/matrix';
import { useMediaAuthentication } from '../../hooks/useMediaAuthentication';
import { nameInitials } from '../../utils/common';
import { SequenceCard } from '../../components/sequence-card';
import { SettingTile } from '../../components/setting-tile';
import { Modal500 } from '../../components/Modal500';
import { Settings } from '../../features/settings';
import { INBOX_PATH } from '../paths';
import { SIYU_VERSION } from '../../../version';

/**
 * 「我」页面（手机版底部导航）：自己的头像与名字 + 菜单式功能列表。
 * 其余功能收纳于此：设置（弹窗，与侧边栏同一套）、收件箱、下载、关于。
 */

const rowButtonStyle: React.CSSProperties = {
  width: '100%',
  textAlign: 'left',
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  padding: 0,
};

export function MePage() {
  const mx = useMatrixClient();
  const navigate = useNavigate();
  const useAuthentication = useMediaAuthentication();
  const userId = mx.getUserId() ?? '';
  const profile = useUserProfile(userId);
  const [settings, setSettings] = useState(false);

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

      <SequenceCard style={{ padding: config.space.S200 }}>
        <Box as="button" onClick={() => setSettings(true)} style={rowButtonStyle}>
          <SettingTile
            before={<Icon src={Icons.Setting} />}
            title={<Text size="T400">设置</Text>}
            after={<Icon src={Icons.ChevronRight} size="100" />}
          />
        </Box>
      </SequenceCard>

      <SequenceCard style={{ padding: config.space.S200, marginTop: config.space.S300 }}>
        <Box as="button" onClick={() => navigate(INBOX_PATH)} style={rowButtonStyle}>
          <SettingTile
            before={<Icon src={Icons.Inbox} />}
            title={<Text size="T400">收件箱</Text>}
            after={<Icon src={Icons.ChevronRight} size="100" />}
          />
        </Box>
        <Box
          as="a"
          href="/public/download.html"
          style={{ ...rowButtonStyle, textDecoration: 'none', display: 'block' }}
        >
          <SettingTile
            before={<Icon src={Icons.Download} />}
            title={<Text size="T400">下载私语 App</Text>}
            after={<Icon src={Icons.ChevronRight} size="100" />}
          />
        </Box>
        <SettingTile
          before={<Icon src={Icons.Info} />}
          title={<Text size="T400">关于私语</Text>}
          after={
            <Text size="T300" priority="300">
              v{SIYU_VERSION}
            </Text>
          }
        />
      </SequenceCard>

      {settings && (
        <Modal500 requestClose={() => setSettings(false)}>
          <Settings requestClose={() => setSettings(false)} />
        </Modal500>
      )}
    </Box>
  );
}
