import { useCallback, useMemo } from 'react';
import { useClientConfig } from '../../hooks/useClientConfig';
import { useMatrixClient } from '../../hooks/useMatrixClient';

export type FeaturedKind = 'room' | 'space';

export type FeaturedEntry = {
  room_id: string;
  kind: FeaturedKind;
  added_by?: string;
  added_at?: number;
  // 服务端经 Synapse admin API 补齐的展示字段（未加入房间也能显示名字）
  name?: string;
  topic?: string;
  avatar_url?: string;
  member_count?: number;
};

export type BlockedEntry = {
  room_id: string;
  kind: FeaturedKind;
  blocked_by?: string;
  blocked_at?: number;
};

export type FeaturedResponse = {
  rooms: FeaturedEntry[];
  spaces: FeaturedEntry[];
  blocked: BlockedEntry[];
};

export type AdminJobStatus = 'running' | 'done' | 'error';

export type UserStatusResponse = {
  user_id: string;
  deactivated: boolean;
  erased: boolean;
};

export type AdminJob = {
  job_id: string;
  status: AdminJobStatus;
  step?: string;
  detail?: string;
  finished_at?: number;
};

const REQUEST_TIMEOUT_MS = 15000;

async function request<T>(url: string, options?: { method?: string; body?: unknown }): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: options?.method ?? 'GET',
      headers: { 'Content-Type': 'application/json' },
      body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
    let data: any = null;
    try {
      data = await res.json();
    } catch {
      // non-JSON body; handled below
    }
    if (!res.ok) {
      const msg = (data && (data.error || data.message)) || `HTTP ${res.status}`;
      throw new Error(String(msg));
    }
    return data as T;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('request_timeout');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export function useAdminService() {
  const mx = useMatrixClient();
  const config = useClientConfig();

  const baseUrl = config.adminServiceUrl?.trim() || undefined;
  const enabled = !!baseUrl;
  const superAdmin = config.superAdmin?.trim() || undefined;
  const me = mx.getUserId();
  const isSuperAdmin = !!superAdmin && !!me && me === superAdmin;

  const post = useCallback(
    async <T,>(path: string, body: Record<string, unknown>): Promise<T> => {
      if (!baseUrl) throw new Error('admin_service_disabled');
      const accessToken = mx.getAccessToken() ?? '';
      return request<T>(`${baseUrl}${path}`, {
        method: 'POST',
        body: { ...body, access_token: accessToken },
      });
    },
    [baseUrl, mx]
  );

  const fetchFeatured = useCallback(async (): Promise<FeaturedResponse> => {
    if (!baseUrl) throw new Error('admin_service_disabled');
    const data = await request<FeaturedResponse>(`${baseUrl}/api/featured`);
    return {
      rooms: data.rooms ?? [],
      spaces: data.spaces ?? [],
      blocked: data.blocked ?? [],
    };
  }, [baseUrl]);

  const recommend = useCallback(
    (roomId: string, kind: FeaturedKind) =>
      post<{ ok: boolean }>('/api/featured/recommend', { room_id: roomId, kind }),
    [post]
  );

  const unrecommend = useCallback(
    (roomId: string) => post<{ ok: boolean }>('/api/featured/unrecommend', { room_id: roomId }),
    [post]
  );

  const block = useCallback(
    (roomId: string) => post<{ ok: boolean }>('/api/featured/block', { room_id: roomId }),
    [post]
  );

  const unblock = useCallback(
    (roomId: string) => post<{ ok: boolean }>('/api/featured/unblock', { room_id: roomId }),
    [post]
  );

  const deactivateUser = useCallback(
    (userId: string, erase: boolean) =>
      post<{ ok: boolean }>('/api/users/deactivate', { user_id: userId, erase }),
    [post]
  );

  const deleteUser = useCallback(
    (userId: string) => post<{ job_id: string }>('/api/users/delete', { user_id: userId }),
    [post]
  );

  const getJob = useCallback(
    async (jobId: string): Promise<AdminJob> => {
      if (!baseUrl) throw new Error('admin_service_disabled');
      return request<AdminJob>(`${baseUrl}/api/jobs/${encodeURIComponent(jobId)}`);
    },
    [baseUrl]
  );

  const getUserStatus = useCallback(
    async (userId: string): Promise<UserStatusResponse> => {
      if (!baseUrl) throw new Error('admin_service_disabled');
      return request<UserStatusResponse>(
        `${baseUrl}/api/users/status?user_id=${encodeURIComponent(userId)}`
      );
    },
    [baseUrl]
  );

  return useMemo(
    () => ({
      baseUrl,
      enabled,
      superAdmin,
      isSuperAdmin,
      fetchFeatured,
      recommend,
      unrecommend,
      block,
      unblock,
      deactivateUser,
      deleteUser,
      getJob,
      getUserStatus,
    }),
    [
      baseUrl,
      enabled,
      superAdmin,
      isSuperAdmin,
      fetchFeatured,
      recommend,
      unrecommend,
      block,
      unblock,
      deactivateUser,
      deleteUser,
      getJob,
      getUserStatus,
    ]
  );
}
