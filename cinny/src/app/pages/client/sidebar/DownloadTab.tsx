import React from 'react';
import { Icon, Icons } from 'folds';
import { useTranslation } from 'react-i18next';
import { SidebarAvatar, SidebarItem, SidebarItemTooltip } from '../../../components/sidebar';

export function DownloadTab() {
  const { t } = useTranslation();

  const open = async () => {
    const url = 'https://chat.xxqw.net/public/download.html';
    const tauri = (window as unknown as Record<string, any>).__TAURI__;
    // App 里必须走系统浏览器：window.open 会被 WebView 接管、把下载页开在 App
    // 内部，而下载页是外来页面没权限再调浏览器，里面的下载按钮就成了死的。
    // （2026-10-21 实测踩中：侧边栏下载按钮一直用的 window.open。）
    if (tauri?.core?.invoke) {
      try {
        if (tauri.shell?.open) {
          await tauri.shell.open(url);
          return;
        }
        if (tauri.opener?.openUrl) {
          await tauri.opener.openUrl(url);
          return;
        }
      } catch {
        /* 继续走下面的兜底 */
      }
    }
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
