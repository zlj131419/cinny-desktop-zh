import { useEffect, useState } from 'react';
import { useAdminService } from './useAdminService';

// userId -> {deactivated, fetchedAt}; deactivated=false 缓存 5 分钟,true 永久(需重进刷新)
const cache = new Map<string, { value: boolean; at: number }>();
const pending = new Map<string, Promise<boolean>>();
const NEG_TTL_MS = 5 * 60 * 1000;

function readCache(userId: string): boolean | undefined {
  const hit = cache.get(userId);
  if (!hit) return undefined;
  if (!hit.value) {
    if (Date.now() - hit.at > NEG_TTL_MS) {
      cache.delete(userId);
      return undefined;
    }
  }
  return hit.value;
}

/**
 * 查询用户是否被停用(禁用/删除)。返回:
 * - true: 已停用
 * - false: 正常
 * - undefined: 服务未启用 / 加载中 / 查询失败(按正常处理)
 */
export function useIsDeactivated(userId: string | undefined): boolean | undefined {
  const admin = useAdminService();
  const [deactivated, setDeactivated] = useState<boolean | undefined>(() =>
    userId ? readCache(userId) : undefined
  );

  useEffect(() => {
    if (!userId || !admin.enabled) return;
    const cached = readCache(userId);
    if (cached !== undefined) {
      setDeactivated(cached);
      return;
    }
    let live = true;
    let p = pending.get(userId);
    if (!p) {
      p = admin
        .getUserStatus(userId)
        .then((r) => !!r.deactivated)
        .catch(() => false);
      pending.set(userId, p);
    }
    p.then((v) => {
      pending.delete(userId);
      cache.set(userId, { value: v, at: Date.now() });
      if (live) setDeactivated(v);
    });
    return () => {
      live = false;
    };
  }, [userId, admin]);

  return deactivated;
}

/** 停用后清掉该用户的缓存(管理页操作成功后调用,让展示立即生效)。 */
export function invalidateDeactivatedCache(userId: string) {
  cache.delete(userId);
}
