import { Box, Button, config, Icon, Icons, Text } from 'folds';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { UserHero, UserHeroName } from './UserHero';
import { getMxIdServer, mxcUrlToHttp } from '../../utils/matrix';
import { getMemberAvatarMxc, getMemberDisplayName } from '../../utils/room';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useMediaAuthentication } from '../../hooks/useMediaAuthentication';
import { usePowerLevels } from '../../hooks/usePowerLevels';
import { useRoom } from '../../hooks/useRoom';
import { useUserPresence } from '../../hooks/useUserPresence';
import { IgnoredUserAlert, MutualRoomsChip, OptionsChip, ServerChip, ShareChip } from './UserChips';
import { useCloseUserRoomProfile } from '../../state/hooks/userRoomProfile';
import { PowerChip } from './PowerChip';
import { UserInviteAlert, UserBanAlert, UserModeration, UserKickAlert } from './UserModeration';
import { useIgnoredUsers } from '../../hooks/useIgnoredUsers';
import { useMembership } from '../../hooks/useMembership';
import { Membership } from '../../../types/matrix/room';
import { useRoomCreators } from '../../hooks/useRoomCreators';
import { useRoomPermissions } from '../../hooks/useRoomPermissions';
import { useMemberPowerCompare } from '../../hooks/useMemberPowerCompare';
import { CreatorChip } from './CreatorChip';
import { useIsDeactivated } from '../../features/admin/useDeactivated';
import { getDirectCreatePath, withSearchParam } from '../../pages/pathUtils';
import { DirectCreateSearchParams } from '../../pages/paths';

type UserRoomProfileProps = {
  userId: string;
};
export function UserRoomProfile({ userId }: UserRoomProfileProps) {
  const { t } = useTranslation();
  const mx = useMatrixClient();
  const useAuthentication = useMediaAuthentication();
  const navigate = useNavigate();
  const closeUserRoomProfile = useCloseUserRoomProfile();
  const ignoredUsers = useIgnoredUsers();
  const ignored = ignoredUsers.includes(userId);

  const room = useRoom();
  const powerLevels = usePowerLevels(room);
  const creators = useRoomCreators(room);

  const permissions = useRoomPermissions(creators, powerLevels);
  const { hasMorePower } = useMemberPowerCompare(creators, powerLevels);

  const myUserId = mx.getSafeUserId();
  const creator = creators.has(userId);

  const canKickUser = permissions.action('kick', myUserId) && hasMorePower(myUserId, userId);
  const canBanUser = permissions.action('ban', myUserId) && hasMorePower(myUserId, userId);
  const canUnban = permissions.action('ban', myUserId);
  // 只允许邀请本服务器会员
  const localServer = getMxIdServer(myUserId);
  const targetServer = getMxIdServer(userId);
  const isLocalUser = !!localServer && !!targetServer && localServer === targetServer;
  const canInvite = permissions.action('invite', myUserId) && isLocalUser;

  const member = room.getMember(userId);
  const membership = useMembership(room, userId);

  const server = getMxIdServer(userId);
  const displayName = getMemberDisplayName(room, userId);
  const avatarMxc = getMemberAvatarMxc(room, userId);
  const avatarUrl = (avatarMxc && mxcUrlToHttp(mx, avatarMxc, useAuthentication)) ?? undefined;

  const presence = useUserPresence(userId);

  // 被停用的账号: 不显示正常资料,只显示风控提示
  const deactivated = useIsDeactivated(userId);

  const handleMessage = () => {
    closeUserRoomProfile();
    const directSearchParam: DirectCreateSearchParams = {
      userId,
    };
    navigate(withSearchParam(getDirectCreatePath(), directSearchParam));
  };

  return (
    <Box direction="Column">
      <UserHero
        userId={userId}
        avatarUrl={avatarUrl}
        presence={presence && presence.lastActiveTs !== 0 ? presence : undefined}
      />
      {deactivated ? (
        <Box direction="Column" gap="200" style={{ padding: config.space.S400 }}>
          <Text size="T400" style={{ color: 'rgb(var(--folds-color-Critical-700))' }}>
            <b>{t('components:user-profile.account_deactivated_notice')}</b>
          </Text>
        </Box>
      ) : (
      <Box direction="Column" gap="500" style={{ padding: config.space.S400 }}>
        <Box direction="Column" gap="400">
          <Box gap="400" alignItems="Start">
            <UserHeroName displayName={displayName} userId={userId} />
            {userId !== myUserId && (
              <Box shrink="No">
                <Button
                  size="300"
                  variant="Primary"
                  fill="Solid"
                  radii="300"
                  before={<Icon size="50" src={Icons.Message} filled />}
                  onClick={handleMessage}
                >
                  <Text size="B300">{t('components:user-profile.message')}</Text>
                </Button>
              </Box>
            )}
          </Box>
          <Box alignItems="Center" gap="200" wrap="Wrap">
            {server && <ServerChip server={server} />}
            <ShareChip userId={userId} />
            {creator ? <CreatorChip /> : <PowerChip userId={userId} />}
            {userId !== myUserId && <MutualRoomsChip userId={userId} />}
            {userId !== myUserId && <OptionsChip userId={userId} />}
          </Box>
        </Box>
        {ignored && <IgnoredUserAlert />}
        {member && membership === Membership.Ban && (
          <UserBanAlert
            userId={userId}
            reason={member.events.member?.getContent().reason}
            canUnban={canUnban}
            bannedBy={member.events.member?.getSender()}
            ts={member.events.member?.getTs()}
          />
        )}
        {member &&
          membership === Membership.Leave &&
          member.events.member &&
          member.events.member.getSender() !== userId && (
            <UserKickAlert
              reason={member.events.member?.getContent().reason}
              kickedBy={member.events.member?.getSender()}
              ts={member.events.member?.getTs()}
            />
          )}
        {member && membership === Membership.Invite && (
          <UserInviteAlert
            userId={userId}
            reason={member.events.member?.getContent().reason}
            canKick={canKickUser}
            invitedBy={member.events.member?.getSender()}
            ts={member.events.member?.getTs()}
          />
        )}
        <UserModeration
          userId={userId}
          canInvite={canInvite && membership === Membership.Leave}
          canKick={canKickUser && membership === Membership.Join}
          canBan={canBanUser && membership !== Membership.Ban}
        />
      </Box>
      )}
    </Box>
  );
}
