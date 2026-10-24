import React from 'react';
import { Icon, Icons } from 'folds';
import { useTranslation } from 'react-i18next';
import { SidebarAvatar, SidebarItem, SidebarItemTooltip } from '../../../components/sidebar';

export function DownloadTab() {
  const { t } = useTranslation();

  const open = async () => {
    const url = 'https://chat.xxqw.net/download.html';
    // 注意：2026-10-24 实锤：服务器上有两份下载页（根目录 download.html 与
    // public/download.html），只刷一处必漂移——客户端此前开的是 public/ 那份
    // 旧页（安卓链接还是本地镜像地址），故改开根目录这份唯一正本。
    const tauri = (window as unknown as Record<string, any>).__TAURI__;
    // App 里必须走系统浏览器：window.open 会被 WebView 接管、把下载页开在 App
    // 内部，而下载页是外来页面没权限再调浏览器，里面的下载按钮就成了死的。
    // （2026-10-21 实测踩中：侧边栏下载按钮一直用的 window.open。）
    // 注意：__TAURI__.shell / __TAURI__.opener 在 Tauri v2 里不存在（一直是
    // undefined），插件必须经 core.invoke 调 plugin:opener|open_url，否则又
    // 会落回 window.open 被 WebView 吞掉。2026-10-21 二次实锤。
    if (tauri?.core?.invoke) {
      try {
        await tauri.core.invoke('plugin:opener|open_url', { url });
        return;
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
