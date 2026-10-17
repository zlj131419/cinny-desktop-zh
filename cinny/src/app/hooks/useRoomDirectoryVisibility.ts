import { useCallback, useEffect } from 'react';
import { Visibility } from 'matrix-js-sdk';
import { useAsyncCallback } from './useAsyncCallback';
import { useMatrixClient } from './useMatrixClient';
import { useClientConfig } from './useClientConfig';

export const useRoomDirectoryVisibility = (roomId: string) => {
  const mx = useMatrixClient();
  const config = useClientConfig();
  const adminServiceUrl = config.adminServiceUrl?.trim() || undefined;

  const [visibilityState, loadVisibility] = useAsyncCallback(
    useCallback(async () => {
      const v = await mx.getRoomDirectoryVisibility(roomId);
      return v.visibility === Visibility.Public;
    }, [mx, roomId])
  );

  useEffect(() => {
    loadVisibility();
  }, [loadVisibility]);

  const setVisibility = useCallback(
    async (visibility: boolean) => {
      // 优先走管理服务（直接写数据库，绕过 Synapse 有问题的 room_list_publication_rules 检查）
      if (adminServiceUrl) {
        try {
          const accessToken = mx.getAccessToken() ?? '';
          const res = await fetch(`${adminServiceUrl}/api/rooms/set_public`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              room_id: roomId,
              public: visibility,
              access_token: accessToken,
            }),
          });
          const data = await res.json().catch(() => null);
          if (!res.ok) {
            throw new Error((data && (data.error || data.message)) || `HTTP ${res.status}`);
          }
          await loadVisibility();
          return;
        } catch (e) {
          // 管理服务不可用时回退到标准 API
          console.warn('[useRoomDirectoryVisibility] admin service failed, fallback to Matrix API:', e);
        }
      }
      await mx.setRoomDirectoryVisibility(
        roomId,
        visibility ? Visibility.Public : Visibility.Private
      );
      await loadVisibility();
    },
    [mx, roomId, loadVisibility, adminServiceUrl]
  );

  return {
    visibilityState,
    setVisibility,
  };
};
