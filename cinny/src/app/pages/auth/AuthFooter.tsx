import React from 'react';
import { Box, Text } from 'folds';
import { useTranslation } from 'react-i18next';
import * as css from './styles.css';
import { SIYU_VERSION } from '../../../version';

export function AuthFooter() {
  const { t } = useTranslation();
  // 桌面端（Tauri）用绝对地址，避免相对路径被解析成 localhost
  const isTauri = typeof window !== 'undefined' && '__TAURI__' in window;
  const downloadUrl = isTauri ? 'https://chat.xxqw.net/public/download.html' : '/public/download.html';
  return (
    <Box className={css.AuthFooter} justifyContent="Center" gap="400" wrap="Wrap">
      <Text size="T300">私语 Siyu v{SIYU_VERSION}</Text>
      <Text
        as="a"
        size="T300"
        href={downloadUrl}
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
