import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  Icon,
  IconButton,
  Icons,
  Overlay,
  OverlayBackdrop,
  OverlayCenter,
  Scroll,
  Spinner,
  Text,
  color,
} from 'folds';
import FocusTrap from 'focus-trap-react';
import { useAtomValue } from 'jotai';
import { useTranslation } from 'react-i18next';
import { RoomCard, RoomCardGrid } from '../../../components/room-card';
import { allRoomsAtom } from '../../../state/room-list/roomList';
import {
  Page,
  PageContent,
  PageContentCenter,
  PageHeader,
  PageHero,
  PageHeroSection,
} from '../../../components/page';
import { RoomTopicViewer } from '../../../components/room-topic-viewer';
import * as css from './style.css';
import { useRoomNavigate } from '../../../hooks/useRoomNavigate';
import { ScreenSize, useScreenSizeContext } from '../../../hooks/useScreenSize';
import { BackRouteHandler } from '../../../components/BackRouteHandler';
import { AsyncStatus, useAsyncCallback } from '../../../hooks/useAsyncCallback';
import { stopPropagation } from '../../../utils/keyboard';
import { FeaturedEntry, useAdminService } from '../../../features/admin/useAdminService';
import { FeaturedContent, FeaturedRooms } from './Featured';

function FeaturedEntryCards({
  entries,
  allRooms,
  onView,
  renderTopicViewer,
  onPinClick,
}: {
  entries: FeaturedEntry[];
  allRooms: string[];
  onView: (roomId: string) => void;
  renderTopicViewer: (name: string, topic: string, requestClose: () => void) => React.ReactNode;
  onPinClick?: (entry: FeaturedEntry) => void;
}) {
  const { t } = useTranslation();
  // 直接用服务端补齐的名字/简介/头像/人数，同步渲染，不再异步调 summary 接口，
  // 避免首次打开时先闪一下房间 ID。
  // 已加入的房间 RoomCard 内部会用本地实时名字覆盖。
  // 服务端没给名字时不拿 room_id 充数，RoomCard 会用本地房间名或隐藏。
  return (
    <RoomCardGrid>
      {entries.map((entry) => (
        <Box key={entry.room_id} direction="Column" gap="100">
          <RoomCard
            roomIdOrAlias={entry.room_id}
            allRooms={allRooms}
            avatarUrl={entry.avatar_url}
            name={entry.name}
            topic={entry.topic}
            memberCount={entry.member_count}
            onView={onView}
            renderTopicViewer={renderTopicViewer}
          />
          {onPinClick && (
            <Box alignItems="Center" gap="100">
              <Icon size="200" src={Icons.Pin} />
              <Text size="T200" priority="400">
                {entry.pin_score
                  ? `${t('pages:client.explore.pin_pinned')} · ${entry.pin_score}`
                  : t('pages:client.explore.pin_unpinned')}
              </Text>
              <Button
                size="300"
                variant="Secondary"
                fill="Soft"
                radii="300"
                outlined
                onClick={() => onPinClick(entry)}
              >
                <Text size="B300">
                  {entry.pin_score
                    ? t('pages:client.explore.pin_set_score')
                    : t('pages:client.explore.pin')}
                </Text>
              </Button>
            </Box>
          )}
        </Box>
      ))}
    </RoomCardGrid>
  );
}

// 超级管理员置顶设置：选 1-10 分，分值越高在推荐页越靠前；保存走管理服务 pin 接口
function PinDialog({
  entry,
  onClose,
  onSave,
}: {
  entry: FeaturedEntry;
  onClose: () => void;
  onSave: (score: number) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [score, setScore] = useState(
    entry.pin_score && entry.pin_score > 0 ? entry.pin_score : 5
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (value: number) => {
    setSaving(true);
    setError(null);
    try {
      await onSave(value);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  };

  return (
    <Overlay open backdrop={<OverlayBackdrop />}>
      <OverlayCenter>
        <FocusTrap
          focusTrapOptions={{
            initialFocus: false,
            clickOutsideDeactivates: true,
            onDeactivate: onClose,
            escapeDeactivates: stopPropagation,
          }}
        >
          <Dialog variant="Surface">
            <Box style={{ padding: '16px', minWidth: '280px' }} direction="Column" gap="400">
              <Box direction="Column" gap="100">
                <Text size="H4">{t('pages:client.explore.pin_title')}</Text>
                <Text size="T300" priority="400">
                  {entry.name ?? entry.room_id}
                </Text>
                <Text size="T300" priority="400">
                  {t('pages:client.explore.pin_score_label')}
                </Text>
              </Box>
              <Box gap="100" style={{ flexWrap: 'wrap' }}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                  <Button
                    key={n}
                    size="300"
                    radii="300"
                    variant={score === n ? 'Primary' : 'Secondary'}
                    fill={score === n ? 'Solid' : 'Soft'}
                    onClick={() => setScore(n)}
                  >
                    <Text size="B300">{n}</Text>
                  </Button>
                ))}
              </Box>
              {error && (
                <Text size="T300" style={{ color: color.Critical.Main }}>
                  {t('pages:client.explore.pin_failed')}：{error}
                </Text>
              )}
              <Box gap="200" justifyContent="End">
                {!!entry.pin_score && (
                  <Button
                    size="400"
                    variant="Critical"
                    fill="Soft"
                    radii="300"
                    onClick={() => void save(0)}
                    disabled={saving}
                  >
                    <Text size="B400">{t('pages:client.explore.pin_unpin')}</Text>
                  </Button>
                )}
                <Button
                  size="400"
                  variant="Secondary"
                  fill="Soft"
                  radii="300"
                  onClick={onClose}
                  disabled={saving}
                >
                  <Text size="B400">{t('pages:client.explore.cancel')}</Text>
                </Button>
                <Button
                  size="400"
                  variant="Primary"
                  radii="300"
                  onClick={() => void save(score)}
                  disabled={saving}
                >
                  <Text size="B400">{t('pages:client.explore.pin_save')}</Text>
                </Button>
              </Box>
            </Box>
          </Dialog>
        </FocusTrap>
      </OverlayCenter>
    </Overlay>
  );
}

export function RecommendedContent({ compact }: { compact?: boolean }) {
  const { t } = useTranslation();
  const { enabled, fetchFeatured, isSuperAdmin, pin } = useAdminService();
  const allRooms = useAtomValue(allRoomsAtom);
  const { navigateSpace, navigateRoom } = useRoomNavigate();
  const [pinTarget, setPinTarget] = useState<FeaturedEntry | null>(null);

  const [featuredState, loadFeatured] = useAsyncCallback(fetchFeatured);

  useEffect(() => {
    if (enabled) loadFeatured();
  }, [enabled, loadFeatured]);

  const data = featuredState.status === AsyncStatus.Success ? featuredState.data : undefined;
  const blockedIds = new Set((data?.blocked ?? []).map((b) => b.room_id));
  // 置顶排序：分值高的在前；同分保持服务端原顺序（sort 是稳定排序）
  const byPinScore = (a: FeaturedEntry, b: FeaturedEntry) =>
    (b.pin_score ?? 0) - (a.pin_score ?? 0);
  const spaces = [...(data?.spaces ?? [])]
    .filter((s) => !blockedIds.has(s.room_id))
    .sort(byPinScore);
  const rooms = [...(data?.rooms ?? [])]
    .filter((r) => !blockedIds.has(r.room_id))
    .sort(byPinScore);

  const renderTopicViewer = (name: string, topic: string, requestClose: () => void) => (
    <RoomTopicViewer name={name} topic={topic} requestClose={requestClose} />
  );

  return (
    <Box direction="Column" gap="200">
      {compact ? (
        <Box direction="Column" gap="100">
          <Box alignItems="Center" gap="200">
            <Icon size="300" src={Icons.Bulb} />
            <Text size="H4">{t('pages:client.explore.recommended')}</Text>
          </Box>
          <Text size="T300" priority="400">
            {t('pages:client.explore.recommended_desc')}
          </Text>
        </Box>
      ) : (
        <PageHeroSection>
          <PageHero
            icon={<Icon size="600" src={Icons.Bulb} />}
            title={t('pages:client.explore.recommended')}
            subTitle={t('pages:client.explore.recommended_desc')}
          />
        </PageHeroSection>
      )}
      <Box direction="Column" gap={compact ? '300' : '700'}>
        {featuredState.status === AsyncStatus.Loading && (
          <Box justifyContent="Center" style={{ padding: compact ? '16px 0' : '32px 0' }}>
            <Spinner variant="Secondary" size="400" />
          </Box>
        )}
        {featuredState.status === AsyncStatus.Error && (
          <Box
            className={css.RoomsInfoCard}
            direction="Column"
            justifyContent="Center"
            alignItems="Center"
            gap="200"
          >
            <Icon size="400" src={Icons.Info} />
            <Text size="T300" align="Center" style={{ color: color.Critical.Main }}>
              {t('pages:client.explore.load_featured_failed')}
            </Text>
          </Box>
        )}
        {data && spaces.length > 0 && (
          <Box direction="Column" gap={compact ? '200' : '400'}>
            <Text size="H4">{t('pages:client.explore.featured_spaces')}</Text>
            <FeaturedEntryCards
              entries={spaces}
              allRooms={allRooms}
              onView={navigateSpace}
              renderTopicViewer={renderTopicViewer}
              onPinClick={isSuperAdmin ? setPinTarget : undefined}
            />
          </Box>
        )}
        {data && rooms.length > 0 && (
          <Box direction="Column" gap={compact ? '200' : '400'}>
            <Text size="H4">{t('pages:client.explore.featured_rooms')}</Text>
            <FeaturedEntryCards
              entries={rooms}
              allRooms={allRooms}
              onView={navigateRoom}
              renderTopicViewer={renderTopicViewer}
              onPinClick={isSuperAdmin ? setPinTarget : undefined}
            />
          </Box>
        )}
        {data && spaces.length === 0 && rooms.length === 0 && (
          <Box
            className={css.RoomsInfoCard}
            direction="Column"
            justifyContent="Center"
            alignItems="Center"
            gap="200"
          >
            <Icon size="400" src={Icons.Info} />
            <Text size="T300" align="Center">
              {t('pages:client.explore.no_rooms_or_spaces_featured')}
            </Text>
          </Box>
        )}
      </Box>
      {pinTarget && (
        <PinDialog
          entry={pinTarget}
          onClose={() => setPinTarget(null)}
          onSave={async (score) => {
            await pin(pinTarget.room_id, pinTarget.kind, score);
            loadFeatured();
          }}
        />
      )}
    </Box>
  );
}

export function RecommendedList() {
  const screenSize = useScreenSizeContext();

  return (
    <Page>
      {screenSize === ScreenSize.Mobile && (
        <PageHeader>
          <Box shrink="No">
            <BackRouteHandler>
              {(onBack) => (
                <IconButton onClick={onBack}>
                  <Icon src={Icons.ArrowLeft} />
                </IconButton>
              )}
            </BackRouteHandler>
          </Box>
        </PageHeader>
      )}
      <Box grow="Yes">
        <Scroll hideTrack visibility="Hover">
          <PageContent>
            <PageContentCenter>
              <RecommendedContent />
            </PageContentCenter>
          </PageContent>
        </Scroll>
      </Box>
    </Page>
  );
}

// Wrapper used by the router: when the admin service is enabled the
// "featured" explore route renders the service-backed recommended list,
// otherwise it keeps the original config.json-driven behaviour.
export function FeaturedOrRecommended() {
  const { enabled } = useAdminService();
  if (enabled) return <RecommendedList />;
  return <FeaturedRooms />;
}

// 无页面外壳的内容版：手机版发现页把推荐内容直接嵌在导航列表下方默认展示
export function FeaturedOrRecommendedContent({ compact }: { compact?: boolean }) {
  const { enabled } = useAdminService();
  if (enabled) return <RecommendedContent compact={compact} />;
  return <FeaturedContent compact={compact} />;
}
