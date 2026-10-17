import React from 'react';
import { Icon, Icons } from 'folds';
import { useTranslation } from 'react-i18next';
import { SidebarAvatar, SidebarItem, SidebarItemTooltip } from '../../../components/sidebar';

export function DownloadTab() {
  const { t } = useTranslation();

  const open = () => {
    window.open('/public/download.html', '_blank', 'noopener');
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
