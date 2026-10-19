import { Box, Button, Dialog, Spinner, Text, color, config } from 'folds';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { SplashScreen } from '../components/splash-screen';

export function ConfigConfigLoading() {
  const { t } = useTranslation();

  return (
    <SplashScreen>
      <Box grow="Yes" direction="Column" gap="300" alignItems="Center" justifyContent="Center" style={{ padding: '40px 20px' }}>
        <img
          src="https://chat.xxqw.net/public/siyu-icon-200.png"
          alt="私语 Siyu"
          style={{ width: 84, height: 84, borderRadius: 20, marginBottom: 8 }}
        />
        <Text size="H2" align="Center" style={{ fontWeight: 800, letterSpacing: 2 }}>
          私语 Siyu
        </Text>
        <Text size="T400" align="Center" style={{ opacity: 0.75 }}>
          聊天，本该如此安全
        </Text>
        <Box style={{ height: 24 }} />
        <Spinner variant="Secondary" size="500" />
        <Text size="T300" align="Center" style={{ opacity: 0.6 }}>
          {t('pages:heating_up')}
        </Text>
      </Box>
    </SplashScreen>
  );
}

type ConfigConfigErrorProps = {
  error: unknown;
  retry: () => void;
  ignore: () => void;
};
export function ConfigConfigError({ error, retry, ignore }: ConfigConfigErrorProps) {
  const { t } = useTranslation();

  return (
    <SplashScreen>
      <Box grow="Yes" direction="Column" gap="400" alignItems="Center" justifyContent="Center">
        <Dialog>
          <Box style={{ padding: config.space.S400 }} direction="Column" gap="400">
            <Box direction="Column" gap="100">
              <Text>{t('pages:failed_to_load_client_configuration_file')}</Text>
              {typeof error === 'object' &&
                error &&
                'message' in error &&
                typeof error.message === 'string' && (
                  <Text size="T300" style={{ color: color.Critical.Main }}>
                    {error.message}
                  </Text>
                )}
            </Box>
            <Button variant="Critical" onClick={retry}>
              <Text as="span" size="B400">
                {t('pages:retry')}
              </Text>
            </Button>
            <Button variant="Critical" onClick={ignore} fill="Soft">
              <Text as="span" size="B400">
                {t('pages:continue')}
              </Text>
            </Button>
          </Box>
        </Dialog>
      </Box>
    </SplashScreen>
  );
}
