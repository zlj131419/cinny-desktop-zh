import React from 'react';
import { Icon, Icons } from 'folds';
import { useTranslation } from 'react-i18next';
import { SidebarAvatar, SidebarItem, SidebarItemTooltip } from '../../../components/sidebar';

export function DownloadTab() {
  const { t } = useTranslation();

  const open = () => {
    // 桌面端（Tauri）用绝对地址，避免解析成 localhost
    const isTauri = typeof window !== 'undefined' && '__TAURI__' in window;
    const url = isTauri
      ? 'https://chat.xxqw.net/public/download.html'
      : '/public/download.html';
    window.open(url, '_blank', 'noopener');
  };

  return (
    <SidebarItem>
      <SidebarItemTooltip tooltip={t('pages:client.sidebar.download_client')}>
        {(triggerRef) => (
          <SidebarAvatar as="button" ref={triggerRef} outlined onClick={open}>
            <Icon src={Icons.Download} />
          </SidebarAvatar>
        )}
      </SidebarItemTooltip>
    </SidebarItem>
  );
}
