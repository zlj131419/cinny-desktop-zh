import React, { ChangeEventHandler, FormEventHandler, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Button, Spinner, Text } from 'folds';
import { AuthType } from 'matrix-js-sdk';
import { SequenceCard } from '../../../components/sequence-card';
import { SequenceCardStyle } from '../styles.css';
import { SettingTile } from '../../../components/setting-tile';
import { PasswordInput } from '../../../components/password-input';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import { AsyncStatus, useAsyncCallback } from '../../../hooks/useAsyncCallback';
import { useAlive } from '../../../hooks/useAlive';

export function ChangePassword() {
  const { t } = useTranslation();
  const mx = useMatrixClient();
  const alive = useAlive();
  const userId = mx.getUserId() ?? '';

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string>();
  const [success, setSuccess] = useState(false);

  const [changeState, change] = useAsyncCallback(
    useCallback(
      (authDict: Record<string, unknown>, newPass: string) =>
        mx.setPassword(authDict as never, newPass, false),
      [mx]
    )
  );
  const changing = changeState.status === AsyncStatus.Loading;

  const handleChange =
    (setter: (v: string) => void): ChangeEventHandler<HTMLInputElement> =>
    (evt) => {
      setter(evt.currentTarget.value);
    };

  const handleSubmit: FormEventHandler<HTMLFormElement> = (evt) => {
    evt.preventDefault();
    if (changing) return;
    setErrorMsg(undefined);
    setSuccess(false);

    if (!currentPassword || !newPassword) return;
    if (newPassword !== confirmPassword) {
      setErrorMsg(t('features:settings.account.passwords_do_not_match'));
      return;
    }

    const authDict = {
      type: AuthType.Password,
      identifier: {
        type: 'm.id.user',
        user: userId,
      },
      password: currentPassword,
    };

    change(authDict, newPassword)
      .then(() => {
        if (alive()) {
          setSuccess(true);
          setCurrentPassword('');
          setNewPassword('');
          setConfirmPassword('');
        }
      })
      .catch((err) => {
        if (alive()) {
          const errcode = err?.errcode ?? err?.data?.errcode;
          setErrorMsg(
            errcode === 'M_FORBIDDEN'
              ? t('features:settings.account.incorrect_current_password')
              : `${t('features:settings.account.password_change_failed')}${
                  err?.message ? ` ${err.message}` : ''
                }`
          );
        }
      });
  };

  return (
    <Box direction="Column" gap="100">
      <Text size="L400">{t('features:settings.account.change_password')}</Text>
      <SequenceCard
        className={SequenceCardStyle}
        variant="SurfaceVariant"
        direction="Column"
        gap="400"
      >
        <SettingTile
          title={t('features:settings.account.change_password')}
          description={t('features:settings.account.change_password_description')}
        >
          <Box as="form" onSubmit={handleSubmit} direction="Column" gap="300">
            <PasswordInput
              name="currentPassword"
              size="400"
              variant="Secondary"
              required
              autoComplete="current-password"
              value={currentPassword}
              onChange={handleChange(setCurrentPassword)}
              readOnly={changing}
              placeholder={t('features:settings.account.current_password')}
            />
            <PasswordInput
              name="newPassword"
              size="400"
              variant="Secondary"
              required
              autoComplete="new-password"
              value={newPassword}
              onChange={handleChange(setNewPassword)}
              readOnly={changing}
              placeholder={t('features:settings.account.new_password')}
            />
            <PasswordInput
              name="confirmPassword"
              size="400"
              variant="Secondary"
              required
              autoComplete="new-password"
              value={confirmPassword}
              onChange={handleChange(setConfirmPassword)}
              readOnly={changing}
              placeholder={t('features:settings.account.confirm_new_password')}
            />
            {errorMsg && (
              <Text size="T200" style={{ color: 'rgb(var(--folds-color-Critical-700))' }}>
                {errorMsg}
              </Text>
            )}
            {success && (
              <Text size="T200" style={{ color: 'rgb(var(--folds-color-Success-700))' }}>
                {t('features:settings.account.password_changed_success')}
              </Text>
            )}
            <Box>
              <Button
                size="400"
                variant="Primary"
                radii="300"
                type="submit"
                disabled={changing}
              >
                {changing && <Spinner variant="Primary" size="300" />}
                <Text size="B400">{t('features:settings.account.change')}</Text>
              </Button>
            </Box>
          </Box>
        </SettingTile>
      </SequenceCard>
    </Box>
  );
}
