import React, { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Spinner, Switch, Text, color } from 'folds';
import { readPowerLevel } from '../../../hooks/usePowerLevels';
import { SequenceCard } from '../../../components/sequence-card';
import { SequenceCardStyle } from '../../room-settings/styles.css';
import { SettingTile } from '../../../components/setting-tile';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import { useRoom } from '../../../hooks/useRoom';
import { usePowerLevels } from '../../../hooks/usePowerLevels';
import { useRoomCreators } from '../../../hooks/useRoomCreators';
import { AsyncStatus, useAsyncCallback } from '../../../hooks/useAsyncCallback';
import { useAdminService } from '../../admin/useAdminService';

export function RoomRecommend() {
  const { t } = useTranslation();
  const mx = useMatrixClient();
  const room = useRoom();
  const powerLevels = usePowerLevels(room);
  const creators = useRoomCreators(room);
  const { enabled, fetchFeatured, recommend, unrecommend } = useAdminService();

  const me = mx.getSafeUserId();
  const isRoomAdmin = creators.has(me) || readPowerLevel.user(powerLevels, me) >= 50;

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
    if (enabled && isRoomAdmin) {
      loadFeatured();
    }
  }, [enabled, isRoomAdmin, loadFeatured]);

  if (!enabled || !isRoomAdmin) return null;

  const data = featuredState.status === AsyncStatus.Success ? featuredState.data : undefined;
  const entries = [...(data?.spaces ?? []), ...(data?.rooms ?? [])];
  const isBlocked = (data?.blocked ?? []).some((b) => b.room_id === room.roomId);
  const isRecommended = entries.some((e) => e.room_id === room.roomId) && !isBlocked;

  const loading =
    featuredState.status === AsyncStatus.Loading || toggleState.status === AsyncStatus.Loading;

  const handleChange = () => {
    if (loading || isBlocked) return;
    toggleRecommend(!isRecommended).then(() => loadFeatured());
  };

  return (
    <SequenceCard
      className={SequenceCardStyle}
      variant="SurfaceVariant"
      direction="Column"
      gap="400"
    >
      <SettingTile
        title={t('features:common-settings.general.recommend_to_explore')}
        description={
          isBlocked
            ? t('features:common-settings.general.recommend_blocked_by_admin')
            : t('features:common-settings.general.recommend_to_explore_desc')
        }
        after={
          <Box gap="200" alignItems="Center">
            {loading && <Spinner variant="Secondary" />}
            {featuredState.status === AsyncStatus.Success && !loading && (
              <Switch value={isRecommended} onChange={handleChange} disabled={isBlocked} />
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
