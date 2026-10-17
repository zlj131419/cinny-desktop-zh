import React, { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Spinner, Switch, Text, color } from 'folds';
import { JoinRule } from 'matrix-js-sdk';
import { SequenceCard } from '../../../components/sequence-card';
import { SequenceCardStyle } from '../../room-settings/styles.css';
import { SettingTile } from '../../../components/setting-tile';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import { useRoom } from '../../../hooks/useRoom';
import { useIsRoomCreator } from '../../../hooks/useIsRoomCreator';
import { AsyncStatus, useAsyncCallback } from '../../../hooks/useAsyncCallback';
import { useAdminService } from '../../admin/useAdminService';

export function RoomRecommend() {
  const { t } = useTranslation();
  const mx = useMatrixClient();
  const room = useRoom();
  // 用服务端判断创建者（有数据库兜底），比客户端可靠
  const { isCreator, loading: creatorLoading } = useIsRoomCreator(room);
  const { enabled, fetchFeatured, recommend, unrecommend } = useAdminService();

  // 只有公开房间才允许推荐到探索页
  const isPublicRoom = room.getJoinRule() === JoinRule.Public;

  const [featuredState, loadFeatured] = useAsyncCallback(fetchFeatured);
  const [toggleState, toggleRecommend] = useAsyncCallback(
    useCallback(
      (toRecommend: boolean) => {
        const kind = room.isSpaceRoom() ? 'space' : 'room';
        return toRecommend ? recommend(room.roomId, kind) : unrecommend(room.roomId);
      },
      [recommend, unrecommend, room]
    )
  );

  useEffect(() => {
    if (enabled) {
      loadFeatured();
    }
  }, [enabled, loadFeatured]);

  if (!enabled) return null;

  const data = featuredState.status === AsyncStatus.Success ? featuredState.data : undefined;
  const entries = [...(data?.spaces ?? []), ...(data?.rooms ?? [])];
  const isBlocked = (data?.blocked ?? []).some((b) => b.room_id === room.roomId);
  const isRecommended = entries.some((e) => e.room_id === room.roomId) && !isBlocked;

  const loading =
    featuredState.status === AsyncStatus.Loading ||
    toggleState.status === AsyncStatus.Loading ||
    creatorLoading;

  const canToggle = isCreator && isPublicRoom && !isBlocked && !creatorLoading;

  const handleChange = () => {
    if (loading || !canToggle) return;
    toggleRecommend(!isRecommended).then(() => loadFeatured());
  };

  const description = isBlocked
    ? t('features:common-settings.general.recommend_blocked_by_admin')
    : !isCreator
      ? t('features:common-settings.general.recommend_creator_only')
      : !isPublicRoom
        ? t('features:common-settings.general.recommend_need_public')
        : t('features:common-settings.general.recommend_to_explore_desc');

  return (
    <SequenceCard
      className={SequenceCardStyle}
      variant="SurfaceVariant"
      direction="Column"
      gap="400"
    >
      <SettingTile
        title={t('features:common-settings.general.recommend_to_explore')}
        description={description}
        after={
          <Box gap="200" alignItems="Center">
            {loading && <Spinner variant="Secondary" />}
            {featuredState.status === AsyncStatus.Success && !loading && (
              <Switch value={isRecommended} onChange={handleChange} disabled={!canToggle} />
            )}
          </Box>
        }
      >
        {featuredState.status === AsyncStatus.Error && (
          <Text style={{ color: color.Critical.Main }} size="T200">
            {t('features:common-settings.general.recommend_load_failed')}
          </Text>
        )}
        {toggleState.status === AsyncStatus.Error && (
          <Text style={{ color: color.Critical.Main }} size="T200">
            {t('features:common-settings.general.recommend_failed')}{' '}
            {(toggleState.error as Error)?.message}
          </Text>
        )}
      </SettingTile>
    </SequenceCard>
  );
}
