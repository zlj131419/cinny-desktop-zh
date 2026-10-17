import React, { useEffect } from 'react';
import { Box, Icon, IconButton, Icons, Scroll, Spinner, Text, color } from 'folds';
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
import { FeaturedEntry, useAdminService } from '../../../features/admin/useAdminService';
import { FeaturedRooms } from './Featured';

function FeaturedEntryCards({
  entries,
  allRooms,
  onView,
  renderTopicViewer,
}: {
  entries: FeaturedEntry[];
  allRooms: string[];
  onView: (roomId: string) => void;
  renderTopicViewer: (name: string, topic: string, requestClose: () => void) => React.ReactNode;
}) {
  // 直接用服务端补齐的名字/简介/头像/人数，同步渲染，不再异步调 summary 接口，
  // 避免首次打开时先闪一下房间 ID。
  // 已加入的房间 RoomCard 内部会用本地实时名字覆盖。
  // 服务端没给名字时不拿 room_id 充数，RoomCard 会用本地房间名或隐藏。
  return (
    <RoomCardGrid>
      {entries.map((entry) => (
        <RoomCard
          key={entry.room_id}
          roomIdOrAlias={entry.room_id}
          allRooms={allRooms}
          avatarUrl={entry.avatar_url}
          name={entry.name}
          topic={entry.topic}
          memberCount={entry.member_count}
          onView={onView}
          renderTopicViewer={renderTopicViewer}
        />
      ))}
    </RoomCardGrid>
  );
}

export function RecommendedList() {
  const { t } = useTranslation();
  const { enabled, fetchFeatured } = useAdminService();
  const allRooms = useAtomValue(allRoomsAtom);
  const screenSize = useScreenSizeContext();
  const { navigateSpace, navigateRoom } = useRoomNavigate();

  const [featuredState, loadFeatured] = useAsyncCallback(fetchFeatured);

  useEffect(() => {
    if (enabled) loadFeatured();
  }, [enabled, loadFeatured]);

  const data = featuredState.status === AsyncStatus.Success ? featuredState.data : undefined;
  const blockedIds = new Set((data?.blocked ?? []).map((b) => b.room_id));
  const spaces = (data?.spaces ?? []).filter((s) => !blockedIds.has(s.room_id));
  const rooms = (data?.rooms ?? []).filter((r) => !blockedIds.has(r.room_id));

  const renderTopicViewer = (name: string, topic: string, requestClose: () => void) => (
    <RoomTopicViewer name={name} topic={topic} requestClose={requestClose} />
  );

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
              <Box direction="Column" gap="200">
                <PageHeroSection>
                  <PageHero
                    icon={<Icon size="600" src={Icons.Bulb} />}
                    title={t('pages:client.explore.recommended')}
                    subTitle={t('pages:client.explore.recommended_desc')}
                  />
                </PageHeroSection>
                <Box direction="Column" gap="700">
                  {featuredState.status === AsyncStatus.Loading && (
                    <Box justifyContent="Center" style={{ padding: '32px 0' }}>
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
                    <Box direction="Column" gap="400">
                      <Text size="H4">{t('pages:client.explore.featured_spaces')}</Text>
                      <FeaturedEntryCards
                        entries={spaces}
                        allRooms={allRooms}
                        onView={navigateSpace}
                        renderTopicViewer={renderTopicViewer}
                      />
                    </Box>
                  )}
                  {data && rooms.length > 0 && (
                    <Box direction="Column" gap="400">
                      <Text size="H4">{t('pages:client.explore.featured_rooms')}</Text>
                      <FeaturedEntryCards
                        entries={rooms}
                        allRooms={allRooms}
                        onView={navigateRoom}
                        renderTopicViewer={renderTopicViewer}
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
              </Box>
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
