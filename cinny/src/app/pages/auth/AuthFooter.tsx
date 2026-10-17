import React from 'react';
import { Box, Text } from 'folds';
import { useTranslation } from 'react-i18next';
import * as css from './styles.css';

export function AuthFooter() {
  const { t } = useTranslation();
  return (
    <Box className={css.AuthFooter} justifyContent="Center" gap="400" wrap="Wrap">
      <Text size="T300">私语 Siyu v1.0.0</Text>
      <Text
        as="a"
        size="T300"
        href="https://github.com/zlj131419/cinny-desktop-zh/releases/latest"
        target="_blank"
        rel="noreferrer"
      >
        下载桌面客户端
      </Text>
      <Text as="a" size="T300" href="https://matrix.org" target="_blank" rel="noreferrer">
        {t('pages:auth.powered_by_matrix')}
      </Text>
    </Box>
  );
}
