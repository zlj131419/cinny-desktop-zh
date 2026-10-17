import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, color, Spinner, Switch, Text } from 'folds';
import { JoinRule, MatrixError } from 'matrix-js-sdk';
import { RoomJoinRulesEventContent } from 'matrix-js-sdk/lib/types';
import { SequenceCard } from '../../../components/sequence-card';
import { SequenceCardStyle } from '../../room-settings/styles.css';
import { SettingTile } from '../../../components/setting-tile';
import { useRoom } from '../../../hooks/useRoom';
import { useIsRoomCreator } from '../../../hooks/useIsRoomCreator';
import { useRoomDirectoryVisibility } from '../../../hooks/useRoomDirectoryVisibility';
import { AsyncStatus, useAsyncCallback } from '../../../hooks/useAsyncCallback';
import { StateEvent } from '../../../../types/matrix/room';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import { useStateEvent } from '../../../hooks/useStateEvent';
import { ExtendedJoinRules } from '../../../components/JoinRulesSwitcher';
import { RoomPermissionsAPI } from '../../../hooks/useRoomPermissions';

type RoomPublishProps = {
  permissions: RoomPermissionsAPI;
};
export function RoomPublish({ permissions }: RoomPublishProps) {
  const { t } = useTranslation();
  const mx = useMatrixClient();
  const room = useRoom();

  const canEditCanonical = permissions.stateEvent(
    StateEvent.RoomCanonicalAlias,
    mx.getSafeUserId()
  );
  // 只有创建者可以操作公开到目录的开关，其余人灰色禁用
  // 用服务端判断（有数据库兜底），比客户端可靠
  const { isCreator, loading: creatorLoading } = useIsRoomCreator(room);
  const joinRuleEvent = useStateEvent(room, StateEvent.RoomJoinRules);
  const content = joinRuleEvent?.getContent<RoomJoinRulesEventContent>();
  const rule: ExtendedJoinRules = (content?.join_rule as ExtendedJoinRules) ?? JoinRule.Invite;

  const { visibilityState, setVisibility } = useRoomDirectoryVisibility(room.roomId);

  const [toggleState, toggleVisibility] = useAsyncCallback(setVisibility);
  // 403 无权限后直接禁用开关，避免反复点报错
  const [permDenied, setPermDenied] = useState(false);

  const handleToggle = useCallback(() => {
    toggleVisibility(!visibilityState.data).catch((e) => {
      if ((e as MatrixError)?.httpStatus === 403) setPermDenied(true);
    });
  }, [toggleVisibility, visibilityState.data]);

  const loading =
    visibilityState.status === AsyncStatus.Loading || toggleState.status === AsyncStatus.Loading;
  const validRule =
    rule === JoinRule.Public || rule === JoinRule.Knock || rule === 'knock_restricted';

  return (
    <SequenceCard
      className={SequenceCardStyle}
      variant="SurfaceVariant"
      direction="Column"
      gap="400"
    >
      <SettingTile
        title={t('features:common-settings.general.publish_to_directory')}
        description={
          room.isSpaceRoom()
            ? t('features:common-settings.general.list_the_space_in_the_public')
            : t('features:common-settings.general.list_the_room_in_the_public')
        }
        after={
          <Box gap="200" alignItems="Center">
            {loading && <Spinner variant="Secondary" />}
            {!loading && visibilityState.status === AsyncStatus.Success && (
              <Switch
                value={visibilityState.data}
                onChange={handleToggle}
                disabled={!isCreator || !canEditCanonical || !validRule || permDenied || creatorLoading}
              />
            )}
          </Box>
        }
      >
        {visibilityState.status === AsyncStatus.Error && (
          <Text style={{ color: color.Critical.Main }} size="T200">
            {(visibilityState.error as MatrixError).message}
          </Text>
        )}

        {toggleState.status === AsyncStatus.Error && (
          <Text style={{ color: color.Critical.Main }} size="T200">
            {(toggleState.error as MatrixError).message}
          </Text>
        )}
      </SettingTile>
    </SequenceCard>
  );
}
