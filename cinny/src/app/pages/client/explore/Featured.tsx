import React from 'react';
import { Box, Icon, IconButton, Icons, Scroll, Text } from 'folds';
import { useAtomValue } from 'jotai';
import { useTranslation } from 'react-i18next';
import { useClientConfig } from '../../../hooks/useClientConfig';
import { RoomCard, RoomCardGrid } from '../../../components/room-card';
import { allRoomsAtom } from '../../../state/room-list/roomList';
import { RoomSummaryLoader } from '../../../components/RoomSummaryLoader';
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

export function FeaturedContent({ compact }: { compact?: boolean }) {
  const { t } = useTranslation();
  const { featuredCommunities } = useClientConfig();
  const { rooms, spaces } = featuredCommunities ?? {};
  const allRooms = useAtomValue(allRoomsAtom);
  const { navigateSpace, navigateRoom } = useRoomNavigate();

  return (
    <Box direction="Column" gap="200">
      {compact ? (
        <Box direction="Column" gap="100">
          <Box alignItems="Center" gap="200">
            <Icon size="300" src={Icons.Bulb} />
            <Text size="H4">{t('pages:client.explore.featured_by_client')}</Text>
          </Box>
          <Text size="T300" priority="400">
            {t('pages:client.explore.find_and_explore_public_rooms')}
          </Text>
        </Box>
      ) : (
        <PageHeroSection>
          <PageHero
            icon={<Icon size="600" src={Icons.Bulb} />}
            title={t('pages:client.explore.featured_by_client')}
            subTitle={t('pages:client.explore.find_and_explore_public_rooms')}
          />
        </PageHeroSection>
      )}
      <Box direction="Column" gap={compact ? '300' : '700'}>
        {spaces && spaces.length > 0 && (
          <Box direction="Column" gap={compact ? '200' : '400'}>
            <Text size="H4">{t('pages:client.explore.featured_spaces')}</Text>
            <RoomCardGrid>
              {spaces.map((roomIdOrAlias) => (
                <RoomSummaryLoader key={roomIdOrAlias} roomIdOrAlias={roomIdOrAlias}>
                  {(roomSummary) => (
                    <RoomCard
                      roomIdOrAlias={roomIdOrAlias}
                      allRooms={allRooms}
                      avatarUrl={roomSummary?.avatar_url}
                      name={roomSummary?.name}
                      topic={roomSummary?.topic}
                      memberCount={roomSummary?.num_joined_members}
                      onView={navigateSpace}
                      renderTopicViewer={(name, topic, requestClose) => (
                        <RoomTopicViewer name={name} topic={topic} requestClose={requestClose} />
                      )}
                    />
                  )}
                </RoomSummaryLoader>
              ))}
            </RoomCardGrid>
          </Box>
        )}
        {rooms && rooms.length > 0 && (
          <Box direction="Column" gap={compact ? '200' : '400'}>
            <Text size="H4">{t('pages:client.explore.featured_rooms')}</Text>
            <RoomCardGrid>
              {rooms.map((roomIdOrAlias) => (
                <RoomSummaryLoader key={roomIdOrAlias} roomIdOrAlias={roomIdOrAlias}>
                  {(roomSummary) => (
                    <RoomCard
                      roomIdOrAlias={roomIdOrAlias}
                      allRooms={allRooms}
                      avatarUrl={roomSummary?.avatar_url}
                      name={roomSummary?.name}
                      topic={roomSummary?.topic}
                      memberCount={roomSummary?.num_joined_members}
                      onView={navigateRoom}
                      renderTopicViewer={(name, topic, requestClose) => (
                        <RoomTopicViewer name={name} topic={topic} requestClose={requestClose} />
                      )}
                    />
                  )}
                </RoomSummaryLoader>
              ))}
            </RoomCardGrid>
          </Box>
        )}
        {((spaces && spaces.length === 0 && rooms && rooms.length === 0) ||
          (!spaces && !rooms)) && (
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
  );
}

export function FeaturedRooms() {
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
              <FeaturedContent />
            </PageContentCenter>
          </PageContent>
        </Scroll>
      </Box>
    </Page>
  );
}
