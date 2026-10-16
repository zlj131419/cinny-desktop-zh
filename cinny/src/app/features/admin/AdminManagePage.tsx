import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Button,
  Icon,
  IconButton,
  Icons,
  Input,
  Scroll,
  Spinner,
  Text,
  color,
} from 'folds';
import { Page, PageContent, PageHeader } from '../../components/page';
import { RoomSummaryLoader } from '../../components/RoomSummaryLoader';
import { AsyncStatus, useAsyncCallback } from '../../hooks/useAsyncCallback';
import { useAlive } from '../../hooks/useAlive';
import { AdminJob, FeaturedEntry, useAdminService } from './useAdminService';
import { invalidateDeactivatedCache } from './useDeactivated';

function FeaturedRow({
  entry,
  blocked,
  onChanged,
}: {
  entry: FeaturedEntry;
  blocked: boolean;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const { block, unblock } = useAdminService();
  const alive = useAlive();

  const [actionState, runAction] = useAsyncCallback(
    useCallback(
      () => (blocked ? unblock(entry.room_id) : block(entry.room_id)),
      [blocked, unblock, block, entry.room_id]
    )
  );
  const acting = actionState.status === AsyncStatus.Loading;

  const handleClick = () => {
    if (acting) return;
    runAction()
      .then(() => {
        if (alive()) onChanged();
      })
      .catch(() => {});
  };

  return (
    <RoomSummaryLoader roomIdOrAlias={entry.room_id}>
      {(roomSummary) => (
        <Box
          direction="Row"
          alignItems="Center"
          gap="300"
          style={{
            padding: '8px 12px',
            borderRadius: '8px',
            backgroundColor: 'rgb(var(--folds-color-SurfaceVariant-Container))',
          }}
        >
          <Box grow="Yes" direction="Column" gap="100">
            <Text size="B400" truncate>
              {roomSummary?.name ?? entry.name ?? entry.room_id}
            </Text>
            <Text size="T200" truncate style={{ opacity: 0.7 }}>
              {entry.kind === 'space'
                ? t('pages:client.explore.spaces')
                : t('pages:client.explore.rooms')}{' '}
              · {roomSummary?.topic ?? entry.topic ?? entry.room_id}
            </Text>
            {actionState.status === AsyncStatus.Error && (
              <Text size="T200" style={{ color: color.Critical.Main }}>
                {(actionState.error as Error)?.message}
              </Text>
            )}
          </Box>
          {blocked && (
            <Text
              size="T200"
              style={{
                padding: '2px 8px',
                borderRadius: '999px',
                backgroundColor: 'rgb(var(--folds-color-Critical-Container))',
                color: 'rgb(var(--folds-color-Critical-OnContainer))',
              }}
            >
              {t('pages:client.explore.blocked')}
            </Text>
          )}
          <Button
            size="300"
            variant={blocked ? 'Secondary' : 'Critical'}
            fill="Soft"
            outlined
            radii="300"
            onClick={handleClick}
            disabled={acting}
          >
            {acting && <Spinner variant="Secondary" size="300" />}
            <Text size="B300">
              {blocked
                ? t('pages:client.explore.unblock')
                : t('pages:client.explore.block')}
            </Text>
          </Button>
        </Box>
      )}
    </RoomSummaryLoader>
  );
}

function RecommendedManage() {
  const { t } = useTranslation();
  const { fetchFeatured } = useAdminService();

  const [featuredState, loadFeatured] = useAsyncCallback(fetchFeatured);

  useEffect(() => {
    loadFeatured();
  }, [loadFeatured]);

  const data = featuredState.status === AsyncStatus.Success ? featuredState.data : undefined;
  const blockedIds = new Set((data?.blocked ?? []).map((b) => b.room_id));
  const active = [...(data?.spaces ?? []), ...(data?.rooms ?? [])].filter(
    (e) => !blockedIds.has(e.room_id)
  );
  const blockedEntries = [...(data?.spaces ?? []), ...(data?.rooms ?? [])].filter((e) =>
    blockedIds.has(e.room_id)
  );

  return (
    <Box direction="Column" gap="300">
      <Box alignItems="Center" justifyContent="SpaceBetween" gap="200">
        <Text size="H4">{t('pages:client.explore.manage_featured')}</Text>
        <IconButton
          size="300"
          radii="300"
          variant="Secondary"
          onClick={() => loadFeatured()}
          aria-label={t('pages:client.explore.refresh')}
        >
          <Icon src={Icons.Reload} size="100" />
        </IconButton>
      </Box>
      {featuredState.status === AsyncStatus.Loading && (
        <Box justifyContent="Center" style={{ padding: '16px 0' }}>
          <Spinner variant="Secondary" size="400" />
        </Box>
      )}
      {featuredState.status === AsyncStatus.Error && (
        <Text size="T300" style={{ color: color.Critical.Main }}>
          {t('pages:client.explore.load_featured_failed')}
        </Text>
      )}
      {data && (
        <>
          <Text size="L400">
            {t('pages:client.explore.recommended_now')} ({active.length})
          </Text>
          <Box direction="Column" gap="200">
            {active.map((entry) => (
              <FeaturedRow
                key={entry.room_id}
                entry={entry}
                blocked={false}
                onChanged={() => loadFeatured()}
              />
            ))}
            {active.length === 0 && (
              <Text size="T300" style={{ opacity: 0.7 }}>
                {t('pages:client.explore.no_rooms_or_spaces_featured')}
              </Text>
            )}
          </Box>
          <Text size="L400">
            {t('pages:client.explore.blocked_list')} ({blockedEntries.length})
          </Text>
          <Box direction="Column" gap="200">
            {blockedEntries.map((entry) => (
              <FeaturedRow
                key={entry.room_id}
                entry={entry}
                blocked
                onChanged={() => loadFeatured()}
              />
            ))}
            {blockedEntries.length === 0 && (
              <Text size="T300" style={{ opacity: 0.7 }}>
                {t('pages:client.explore.no_rooms_or_spaces_featured')}
              </Text>
            )}
          </Box>
        </>
      )}
    </Box>
  );
}

function UserManage() {
  const { t } = useTranslation();
  const { deactivateUser, deleteUser, getJob, superAdmin } = useAdminService();
  const alive = useAlive();

  const [targetUserId, setTargetUserId] = useState('');
  const [confirm, setConfirm] = useState<'deactivate' | 'delete' | null>(null);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<AdminJob | null>(null);

  // Poll delete job progress.
  useEffect(() => {
    if (!jobId) return;
    let stopped = false;
    const poll = async () => {
      try {
        const j = await getJob(jobId);
        if (stopped || !alive()) return;
        setJob(j);
        if (j.status !== 'running') {
          setJobId(null);
          setWorking(false);
          if (j.status === 'done') invalidateDeactivatedCache(normalizedId);
          setMessage({
            ok: j.status === 'done',
            text:
              j.status === 'done'
                ? t('pages:client.explore.delete_user_done')
                : `${t('pages:client.explore.job_failed')}${j.detail ?? j.step ?? ''}`,
          });
        }
      } catch (err) {
        if (stopped || !alive()) return;
        setJobId(null);
        setWorking(false);
        setMessage({ ok: false, text: (err as Error)?.message });
      }
    };
    poll();
    const timer = setInterval(poll, 2000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [jobId, getJob, alive, t]);

  const normalizedId = targetUserId.trim();

  const handleDeactivate = async () => {
    if (!normalizedId || working) return;
    if (normalizedId === superAdmin) {
      setMessage({ ok: false, text: t('pages:client.explore.cannot_operate_self') });
      setConfirm(null);
      return;
    }
    setWorking(true);
    setMessage(null);
    setConfirm(null);
    try {
      await deactivateUser(normalizedId, false);
      invalidateDeactivatedCache(normalizedId);
      if (alive()) setMessage({ ok: true, text: t('pages:client.explore.deactivate_success') });
    } catch (err) {
      if (alive()) setMessage({ ok: false, text: (err as Error)?.message });
    } finally {
      if (alive()) setWorking(false);
    }
  };

  const handleDelete = async () => {
    if (!normalizedId || working) return;
    if (normalizedId === superAdmin) {
      setMessage({ ok: false, text: t('pages:client.explore.cannot_operate_self') });
      setConfirm(null);
      return;
    }
    setWorking(true);
    setMessage(null);
    setConfirm(null);
    setJob(null);
    try {
      const { job_id } = await deleteUser(normalizedId);
      if (alive()) setJobId(job_id);
    } catch (err) {
      if (alive()) {
        setWorking(false);
        setMessage({ ok: false, text: (err as Error)?.message });
      }
    }
  };

  return (
    <Box direction="Column" gap="300">
      <Text size="H4">{t('pages:client.explore.manage_users')}</Text>
      <Box direction="Column" gap="200">
        <Text size="L400">{t('pages:client.explore.user_id')}</Text>
        <Input
          value={targetUserId}
          onChange={(evt) => setTargetUserId(evt.currentTarget.value)}
          variant="Secondary"
          radii="300"
          placeholder="@user:chat.xxqw.net"
          readOnly={working}
        />
      </Box>
      {confirm === null ? (
        <Box gap="200">
          <Button
            size="400"
            variant="Warning"
            radii="300"
            onClick={() => setConfirm('deactivate')}
            disabled={!normalizedId || working}
          >
            <Text size="B400">{t('pages:client.explore.deactivate_user')}</Text>
          </Button>
          <Button
            size="400"
            variant="Critical"
            radii="300"
            onClick={() => setConfirm('delete')}
            disabled={!normalizedId || working}
          >
            <Text size="B400">{t('pages:client.explore.delete_user')}</Text>
          </Button>
        </Box>
      ) : (
        <Box direction="Column" gap="200">
          <Text size="T300">
            {confirm === 'deactivate'
              ? t('pages:client.explore.confirm_deactivate', { userId: normalizedId })
              : t('pages:client.explore.confirm_delete', { userId: normalizedId })}
          </Text>
          <Box gap="200">
            <Button
              size="400"
              variant={confirm === 'deactivate' ? 'Warning' : 'Critical'}
              radii="300"
              onClick={confirm === 'deactivate' ? handleDeactivate : handleDelete}
              disabled={working}
            >
              {working && <Spinner variant="Secondary" size="300" />}
              <Text size="B400">{t('pages:client.explore.confirm')}</Text>
            </Button>
            <Button
              size="400"
              variant="Secondary"
              fill="Soft"
              outlined
              radii="300"
              onClick={() => setConfirm(null)}
              disabled={working}
            >
              <Text size="B400">{t('pages:client.explore.cancel')}</Text>
            </Button>
          </Box>
        </Box>
      )}
      {working && job && (
        <Box direction="Column" gap="100">
          <Text size="T300">
            {t('pages:client.explore.delete_job_running')} {job.step ?? ''}
          </Text>
          {job.detail && (
            <Text size="T200" style={{ opacity: 0.7 }}>
              {job.detail}
            </Text>
          )}
        </Box>
      )}
      {message && (
        <Text
          size="T300"
          style={{ color: message.ok ? color.Success.Main : color.Critical.Main }}
        >
          {message.text}
        </Text>
      )}
    </Box>
  );
}

export function AdminManagePage() {
  const { t } = useTranslation();
  const { enabled, isSuperAdmin } = useAdminService();

  return (
    <Page>
      <PageHeader outlined={false}>
        <Box grow="Yes" gap="200">
          <Box grow="Yes" alignItems="Center" gap="200">
            <Icon src={Icons.ShieldUser} size="200" />
            <Text size="H3" truncate>
              {t('pages:client.explore.admin_manage')}
            </Text>
          </Box>
        </Box>
      </PageHeader>
      <Box grow="Yes">
        <Scroll hideTrack visibility="Hover">
          <PageContent>
            {!enabled || !isSuperAdmin ? (
              <Box justifyContent="Center" style={{ padding: '32px 0' }}>
                <Text size="T300" style={{ color: color.Critical.Main }}>
                  {t('pages:client.explore.no_permission')}
                </Text>
              </Box>
            ) : (
              <Box direction="Column" gap="700">
                <RecommendedManage />
                <UserManage />
              </Box>
            )}
          </PageContent>
        </Scroll>
      </Box>
    </Page>
  );
}
