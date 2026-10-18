import React, { MouseEventHandler, useCallback, useState } from 'react';
import { Icon, Icons, Menu, MenuItem, PopOut, RectCords, Scroll, config } from 'folds';
import FocusTrap from 'focus-trap-react';
import { ErrorBoundary } from 'react-error-boundary';
import { useTranslation } from 'react-i18next';
import { Box, Text, Switch, Button, color, Spinner } from 'folds';
import { IPusherRequest } from 'matrix-js-sdk';
import { SequenceCard } from '../../../components/sequence-card';
import { SequenceCardStyle } from '../styles.css';
import { SettingTile } from '../../../components/setting-tile';
import { useSetting } from '../../../state/hooks/settings';
import { settingsAtom } from '../../../state/settings';
import { getNotificationState, usePermissionState } from '../../../hooks/usePermission';
import { useEmailNotifications } from '../../../hooks/useEmailNotifications';
import { AsyncStatus, useAsyncCallback } from '../../../hooks/useAsyncCallback';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import { NOTIFICATION_SOUNDS, getNotificationSoundSrc } from './notificationSounds';

function SoundSelector() {
  const [notificationSoundId, setNotificationSoundId] = useSetting(
    settingsAtom,
    'notificationSoundId'
  );
  const [menuCords, setMenuCords] = useState<RectCords>();

  const current = NOTIFICATION_SOUNDS.find((s) => s.id === notificationSoundId) ?? NOTIFICATION_SOUNDS[0];

  const handleToggle: MouseEventHandler<HTMLButtonElement> = (evt) => {
    if (menuCords) setMenuCords(undefined);
    else setMenuCords(evt.currentTarget.getBoundingClientRect());
  };

  const handleSelect = (id: string) => {
    setMenuCords(undefined);
    setNotificationSoundId(id);
    const el = new Audio(getNotificationSoundSrc(id));
    el.play().catch(() => {});
  };

  return (
    <>
      <Button
        size="300"
        variant="Primary"
        outlined
        fill="Soft"
        radii="300"
        onClick={handleToggle}
        after={<Icon size="300" src={Icons.ChevronBottom} />}
      >
        <Text size="T300">{current.name}</Text>
      </Button>
      <PopOut
        anchor={menuCords}
        offset={5}
        position="Bottom"
        align="End"
        content={
          <FocusTrap
            focusTrapOptions={{
              initialFocus: false,
              onDeactivate: () => setMenuCords(undefined),
              clickOutsideDeactivates: true,
            }}
          >
            <Menu>
              <Scroll style={{ maxHeight: '300px' }} variant="Surface" size="300" visibility="Hover" hideTrack>
                <Box direction="Column" gap="100" style={{ padding: config.space.S100 }}>
                  {NOTIFICATION_SOUNDS.map((s) => (
                    <MenuItem
                      key={s.id}
                      size="300"
                      variant={s.id === current.id ? 'Primary' : 'Surface'}
                      radii="300"
                      onClick={() => handleSelect(s.id)}
                    >
                      <Text size="T300" style={{ whiteSpace: 'nowrap' }}>{s.name}</Text>
                    </MenuItem>
                  ))}
                </Box>
              </Scroll>
            </Menu>
          </FocusTrap>
        }
      />
    </>
  );
}

function EmailNotification() {
  const { t } = useTranslation();
  const mx = useMatrixClient();
  const [result, refreshResult] = useEmailNotifications();

  const [setState, setEnable] = useAsyncCallback(
    useCallback(
      async (email: string, enable: boolean) => {
        if (enable) {
          await mx.setPusher({
            kind: 'email',
            app_id: 'm.email',
            pushkey: email,
            app_display_name: 'Email Notifications',
            device_display_name: email,
            lang: 'en',
            data: {
              brand: '私语',
            },
            append: true,
          });
          return;
        }
        await mx.setPusher({
          pushkey: email,
          app_id: 'm.email',
          kind: null,
        } as unknown as IPusherRequest);
      },
      [mx]
    )
  );

  const handleChange = (value: boolean) => {
    if (result && result.email) {
      setEnable(result.email, value).then(() => {
        refreshResult();
      });
    }
  };

  return (
    <SettingTile
      title={t('features:settings.notifications.email_notification')}
      description={
        <>
          {result && !result.email && (
            <Text as="span" style={{ color: color.Critical.Main }} size="T200">
              {t('features:settings.notifications.your_account_does_not_have_any_email')}
            </Text>
          )}
          {result && result.email && <>{t('features:settings.notifications.send_notification_to_your_email')} {`("${result.email}")`}</>}
          {result === null && (
            <Text as="span" style={{ color: color.Critical.Main }} size="T200">
              {t('features:settings.notifications.unexpected_error')}
            </Text>
          )}
          {result === undefined && t('features:settings.notifications.send_notification_to_your_email')}
        </>
      }
      after={
        <>
          {setState.status !== AsyncStatus.Loading &&
            typeof result === 'object' &&
            result?.email && <Switch value={result.enabled} onChange={handleChange} />}
          {(setState.status === AsyncStatus.Loading || result === undefined) && (
            <Spinner variant="Secondary" />
          )}
        </>
      }
    />
  );
}

export function SystemNotification() {
  const { t } = useTranslation();
  const notifPermission = usePermissionState('notifications', getNotificationState());
  const [showNotifications, setShowNotifications] = useSetting(settingsAtom, 'showNotifications');
  const [isNotificationSounds, setIsNotificationSounds] = useSetting(
    settingsAtom,
    'isNotificationSounds'
  );


  const requestNotificationPermission = () => {
    window.Notification.requestPermission();
  };

  return (
    <Box direction="Column" gap="100">
      <Text size="L400">{t('features:settings.notifications.system')}</Text>
      <SequenceCard
        className={SequenceCardStyle}
        variant="SurfaceVariant"
        direction="Column"
        gap="400"
      >
        <SettingTile
          title={t('features:settings.notifications.desktop_notifications')}
          description={
            notifPermission === 'denied' ? (
              <Text as="span" style={{ color: color.Critical.Main }} size="T200">
                {'Notification' in window
                  ? t('features:settings.notifications.notification_permission_is_blocked')
                  : t('features:settings.notifications.notifications_are_not_supported')}
              </Text>
            ) : (
              <span>{t('features:settings.notifications.show_desktop_notifications')}</span>
            )
          }
          after={
            notifPermission !== 'granted' ? (
              <Button size="300" radii="300" onClick={requestNotificationPermission}>
                <Text size="B300">{t('features:settings.notifications.enable')}</Text>
              </Button>
            ) : (
              <Switch
                disabled={notifPermission !== 'granted'}
                value={showNotifications}
                onChange={setShowNotifications}
              />
            )
          }
        />
      </SequenceCard>
      <SequenceCard
        className={SequenceCardStyle}
        variant="SurfaceVariant"
        direction="Column"
        gap="400"
      >
        <SettingTile
          title={t('features:settings.notifications.notification_sound')}
          description={t('features:settings.notifications.play_sound_when_new')}
          after={<Switch value={isNotificationSounds} onChange={setIsNotificationSounds} />}
        />
        {isNotificationSounds && (
          <SettingTile
            title="提示音"
            description="选择新消息的提示声音"
            after={
              <ErrorBoundary
                fallbackRender={({ error }) => (
                  <Text size="B300" style={{ color: 'red' }}>
                    铃声选择器加载失败: {error?.message}
                  </Text>
                )}
              >
                <SoundSelector />
              </ErrorBoundary>
            }
          />
        )}
      </SequenceCard>
      <SequenceCard
        className={SequenceCardStyle}
        variant="SurfaceVariant"
        direction="Column"
        gap="400"
      >
        <EmailNotification />
      </SequenceCard>
    </Box>
  );
}
