import axios from 'axios';
import { checkpointCommitted } from './revision';
import { apiClient } from '../api/client';
import { refreshAccessToken } from '../api/auth';
import {
  applyCheckpoint,
  deleteOutboxItem,
  getDb,
  getActiveUserId,
  getMetadata,
  getOutbox,
  setMetadata,
} from '../db/database';
import {
  getStoredRefreshToken,
  saveRefreshToken,
  saveToken,
  updateRememberedUser,
} from '../storage/auth';

export const SYNC_INTERVAL_MS = 60 * 60 * 1000;
// A failed transport must not suppress a pending local write for the whole
// normal sync interval. This is intentionally short enough to recover after
// an outage even when navigator.onLine never emits a transition.
export const OUTBOX_RETRY_INTERVAL_MS = 60 * 1000;
let running: Promise<SyncResult> | null = null;

export type SyncResult = {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  synced_at?: string;
  concursos?: number;
};

const isHttpStatus = (error: unknown, status: number) =>
  axios.isAxiosError(error) && error.response?.status === status;

const ensureServerSession = async () => {
  try {
    await apiClient.get('/auth/me', { timeout: 10000 });
    return;
  } catch (error) {
    if (!isHttpStatus(error, 401)) throw error;
  }

  const refreshToken = await getStoredRefreshToken();
  if (!refreshToken) throw new Error('Sem refresh token para sincronizar. Entre online novamente quando puder.');
  const refreshed = await refreshAccessToken(refreshToken);
  if (!refreshed?.access_token) throw new Error('Servidor não retornou access token.');
  await saveToken(refreshed.access_token);
  if (refreshed.refresh_token) await saveRefreshToken(refreshed.refresh_token);
  if (refreshed.user) await updateRememberedUser(refreshed.user);
};

const syncOutbox = async () => {
  const db = await getDb();
  const items = await getOutbox();

  for (const item of items) {
    // The queue snapshot may outlive a logout/login. Never let an item
    // captured for A reach the API with B's token or mutate B's local rows.
    const activeUserId = await getActiveUserId();
    const itemOwner = item.owner_user_id == null ? null : Number(item.owner_user_id);
    if (itemOwner !== activeUserId) {
      throw new Error('Sessão alterada durante a sincronização; fila antiga preservada.');
    }
    const payload = item.payload ? JSON.parse(item.payload) : {};
    try {
      switch (item.op) {
        case 'favorite_add':
          await apiClient.post(`/me/favorites/${payload.concurso_id}`);
          break;
        case 'favorite_remove':
          await apiClient.delete(`/me/favorites/${payload.concurso_id}`);
          break;
        case 'preferences_put':
          await apiClient.put('/me/preferences', payload);
          break;
        case 'notification_read':
          await apiClient.post(`/me/notifications/${payload.notification_id}/read`);
          break;
        case 'notifications_read_all':
          await apiClient.post('/me/notifications/read-all');
          break;
        case 'alert_create': {
          const localId = Number(item.entity_key);
          // A create can be followed by an offline toggle before the first
          // sync. Read the latest local state so the server receives the
          // user's final choice even if the follow-up update is delayed.
          const localRow = await db.getFirstAsync<{ data: string }>(
            'SELECT data FROM alerts WHERE local_id = ? AND (owner_user_id IS ? OR owner_user_id = ?)',
            localId, activeUserId, activeUserId,
          );
          const localData = localRow ? JSON.parse(localRow.data) : null;
          const createPayload = localData
            ? { ...payload, active: localData.active, only_open: localData.only_open }
            : payload;
          const response = await apiClient.post('/me/alerts', createPayload);
          const serverAlert = response.data;
          await db.runAsync(
            'UPDATE alerts SET remote_id = ?, data = ? WHERE local_id = ? AND (owner_user_id IS ? OR owner_user_id = ?)',
            serverAlert.id,
            JSON.stringify(serverAlert),
            localId,
            activeUserId, activeUserId,
          );
          break;
        }
        case 'alert_update': {
          const localId = Number(item.entity_key);
          const row = await db.getFirstAsync<{ remote_id: number | null }>(
            'SELECT remote_id FROM alerts WHERE local_id = ? AND (owner_user_id IS ? OR owner_user_id = ?)',
            localId, activeUserId, activeUserId,
          );
          if (row?.remote_id == null) continue;
          await apiClient.patch(`/me/alerts/${row.remote_id}`, payload);
          break;
        }
        case 'alert_delete': {
          const remoteId = payload.remote_id;
          if (remoteId != null) await apiClient.delete(`/me/alerts/${remoteId}`);
          break;
        }
        default:
          console.warn('Discarding unknown outbox operation', item.op);
      }
      await deleteOutboxItem(item.id, itemOwner);
    } catch (error) {
      if (isHttpStatus(error, 404) && ['favorite_remove', 'alert_delete', 'notification_read'].includes(item.op)) {
        await deleteOutboxItem(item.id, itemOwner);
        continue;
      }
      throw error;
    }
  }
};

const executeSync = async (): Promise<SyncResult> => {
  await setMetadata('last_sync_attempt_at', new Date().toISOString());
  try {
    await ensureServerSession();
    await syncOutbox();
    const response = await apiClient.get('/sync/checkpoint', { timeout: 45000 });
    const checkpoint = response.data;
    await applyCheckpoint(checkpoint);
    if (checkpoint.user) await updateRememberedUser(checkpoint.user);
    await setMetadata('last_sync_error', null);
    checkpointCommitted();
    return {
      ok: true,
      synced_at: checkpoint.generated_at || new Date().toISOString(),
      concursos: checkpoint.concursos?.length ?? 0,
    };
  } catch (error: any) {
    const message = axios.isAxiosError(error)
      ? (error.response?.data?.detail || error.message || 'Falha de rede')
      : (error?.message || String(error));
    await setMetadata('last_sync_error', message);
    return { ok: false, reason: message };
  }
};

export const syncNow = async (): Promise<SyncResult> => {
  if (!running) {
    running = executeSync().finally(() => {
      running = null;
    });
  }
  return running;
};

export const syncIfDue = async (force = false): Promise<SyncResult> => {
  if (!force) {
    const [lastSync, lastAttempt, outbox] = await Promise.all([
      getMetadata('last_sync_at'),
      getMetadata('last_sync_attempt_at'),
      getOutbox(),
    ]);
    const timestamps = [lastSync, lastAttempt]
      .filter((value): value is string => !!value)
      .map(value => new Date(value).getTime())
      .filter(Number.isFinite);
    const mostRecent = timestamps.length ? Math.max(...timestamps) : null;
    const retryWindow = outbox.length ? OUTBOX_RETRY_INTERVAL_MS : SYNC_INTERVAL_MS;
    if (mostRecent != null && Date.now() - mostRecent < retryWindow) {
      return {
        ok: true,
        skipped: true,
        reason: 'próxima tentativa ainda não venceu',
        synced_at: lastSync || undefined,
      };
    }
  }
  return syncNow();
};

export const getSyncStatus = async () => ({
  lastSyncAt: await getMetadata('last_sync_at'),
  lastAttemptAt: await getMetadata('last_sync_attempt_at'),
  lastError: await getMetadata('last_sync_error'),
});
