import { getDb, getJsonRow, getJsonRows, queueOutbox, deleteOutboxForEntity, getActiveUserId } from './database';
import { withLocalTransaction } from './transaction';
import { Concurso } from '../types/concurso';
import type { ConcursoPublication } from '../api/publications';
import type { ConcursoUpdate, ConcursoVersion } from '../api/updates';
import { normalizarCargo } from '../utils/cargos';

const normalizarConcurso = (value: Concurso): Concurso => ({
  ...value,
  cargos: Array.isArray(value.cargos)
    ? value.cargos.map(cargo => normalizarCargo(cargo, value.taxa_inscricao ?? value.taxa)).filter((cargo): cargo is NonNullable<typeof cargo> => !!cargo)
    : value.cargos,
});

export const localConcursos = {
  all: async () => (await getJsonRows<Concurso>('SELECT data FROM concursos ORDER BY updated_at DESC, id DESC')).map(normalizarConcurso),
  byId: async (id: number) => {
    const concurso = await getJsonRow<Concurso>('SELECT data FROM concursos WHERE id = ?', id);
    return concurso ? normalizarConcurso(concurso) : null;
  },
};

export const localPublications = {
  byConcurso: (concursoId: number) => getJsonRows<ConcursoPublication>(
    'SELECT data FROM publications WHERE concurso_id = ? ORDER BY publication_date DESC, id DESC',
    concursoId,
  ),
};

export const localVersions = {
  byConcurso: (concursoId: number) => getJsonRows<ConcursoVersion>(
    'SELECT data FROM versions WHERE concurso_id = ? ORDER BY captured_at DESC, id DESC',
    concursoId,
  ),
};

export const localUpdates = {
  recent: async (limit = 20) => {
    const db = await getDb();
    const rows = await db.getAllAsync<{ data: string }>(
      'SELECT data FROM recent_updates ORDER BY captured_at DESC, id DESC LIMIT ?',
      limit,
    );
    return rows.map(row => JSON.parse(row.data) as ConcursoUpdate);
  },
  mine: async (limit = 20) => {
    const db = await getDb();
    const rows = await db.getAllAsync<{ data: string }>(
      'SELECT data FROM my_updates ORDER BY captured_at DESC, id DESC LIMIT ?',
      limit,
    );
    return rows.map(row => JSON.parse(row.data) as ConcursoUpdate);
  },
};

export const localFavorites = {
  all: async () => {
    const userId = await getActiveUserId();
    return getJsonRows<Concurso>('SELECT data FROM favorites WHERE owner_user_id IS ? OR owner_user_id = ? ORDER BY concurso_id DESC', userId, userId);
  },
  add: async (concursoId: number) => {
    return withLocalTransaction(await getDb(), async db => {
      const row = await db.getFirstAsync<{ data: string }>('SELECT data FROM concursos WHERE id = ?', concursoId);
      const concurso = row ? JSON.parse(row.data) as Concurso : null;
      if (!concurso) throw new Error('Concurso não encontrado no banco local.');
      await db.runAsync(
        'INSERT INTO favorites(concurso_id, data, owner_user_id) VALUES (?, ?, ?) ON CONFLICT(concurso_id) DO UPDATE SET data = excluded.data, owner_user_id = excluded.owner_user_id',
        concursoId,
        JSON.stringify(concurso),
        await getActiveUserId(),
      );
      await queueOutbox('favorite_add', concursoId, { concurso_id: concursoId }, db);
      return concurso;
    });
  },
  remove: async (concursoId: number) => {
    return withLocalTransaction(await getDb(), async db => {
      await db.runAsync('DELETE FROM favorites WHERE concurso_id = ? AND (owner_user_id IS NULL OR owner_user_id = ?)', concursoId, await getActiveUserId());
      await queueOutbox('favorite_remove', concursoId, { concurso_id: concursoId }, db);
    });
  },
};

const makeLocalId = () => -Math.max(Date.now(), 1);

export const localAlerts = {
  all: async () => {
    const userId = await getActiveUserId();
    return getJsonRows<any>('SELECT data FROM alerts WHERE owner_user_id IS ? OR owner_user_id = ? ORDER BY local_id DESC', userId, userId);
  },
  create: async (payload: any) => {
    return withLocalTransaction(await getDb(), async db => {
      const localId = makeLocalId();
      const now = new Date().toISOString();
      const alert = {
        id: localId,
        user_id: await getActiveUserId(),
        ...payload,
        active: payload.active ?? true,
        only_open: payload.only_open ?? true,
        created_at: now,
        updated_at: now,
        _pending_sync: true,
      };
      await db.runAsync(
        'INSERT INTO alerts(local_id, remote_id, data, owner_user_id) VALUES (?, NULL, ?, ?)',
        localId,
        JSON.stringify(alert),
        await getActiveUserId(),
      );
      await queueOutbox('alert_create', localId, payload, db);
      return alert;
    });
  },
  update: async (localId: number, changes: any) => {
    return withLocalTransaction(await getDb(), async db => {
      const row = await db.getFirstAsync<{ data: string }>('SELECT data FROM alerts WHERE local_id = ? AND (owner_user_id IS NULL OR owner_user_id = ?)', localId, await getActiveUserId());
      if (!row) throw new Error('Alerta não encontrado.');
      const current = JSON.parse(row.data);
      const next = { ...current, ...changes, updated_at: new Date().toISOString(), _pending_sync: true };
      await db.runAsync('UPDATE alerts SET data = ? WHERE local_id = ?', JSON.stringify(next), localId);
      await queueOutbox('alert_update', localId, changes, db);
      return next;
    });
  },
  remove: async (localId: number) => {
    return withLocalTransaction(await getDb(), async db => {
      const row = await db.getFirstAsync<{ remote_id: number | null }>(
        'SELECT remote_id FROM alerts WHERE local_id = ? AND (owner_user_id IS NULL OR owner_user_id = ?)',
        localId, await getActiveUserId(),
      );
      if (!row) return;
      await db.runAsync('DELETE FROM alerts WHERE local_id = ?', localId);
      if (row.remote_id == null) {
        await deleteOutboxForEntity(['alert_create', 'alert_update'], localId, db);
      } else {
        await queueOutbox('alert_delete', localId, { remote_id: row.remote_id }, db);
      }
    });
  },
};

export const localPreferences = {
  get: () => getJsonRow<any>('SELECT data FROM preferences WHERE id = 1'),
  set: async (payload: any) => {
    return withLocalTransaction(await getDb(), async db => {
      const normalized = { ...payload, _pending_sync: true };
      await db.runAsync(
        'INSERT INTO preferences(id, data) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data',
        JSON.stringify(normalized),
      );
      await queueOutbox('preferences_put', 'preferences', payload, db);
      return normalized;
    });
  },
};

export const localNotifications = {
  all: async (unreadOnly = false) => {
    const rows = await getJsonRows<any>('SELECT data FROM notifications ORDER BY created_at DESC, id DESC');
    return unreadOnly ? rows.filter(item => !(item.is_read ?? !!item.read_at)) : rows;
  },
  markRead: async (id: number) => {
    return withLocalTransaction(await getDb(), async db => {
      const row = await db.getFirstAsync<{ data: string }>('SELECT data FROM notifications WHERE id = ?', id);
      if (!row) throw new Error('Notificação não encontrada.');
      const current = JSON.parse(row.data);
      const next = { ...current, is_read: true, read_at: current.read_at || new Date().toISOString() };
      await db.runAsync('UPDATE notifications SET data = ? WHERE id = ?', JSON.stringify(next), id);
      await queueOutbox('notification_read', id, { notification_id: id }, db);
      return next;
    });
  },
  markAllRead: async () => {
    return withLocalTransaction(await getDb(), async db => {
      const rows = await db.getAllAsync<{ id: number; data: string }>('SELECT id, data FROM notifications');
      const now = new Date().toISOString();
      let updated = 0;
      for (const row of rows) {
        const current = JSON.parse(row.data);
        if (current.is_read ?? !!current.read_at) continue;
        await db.runAsync(
          'UPDATE notifications SET data = ? WHERE id = ?',
          JSON.stringify({ ...current, is_read: true, read_at: now }),
          row.id,
        );
        updated += 1;
      }
      await queueOutbox('notifications_read_all', 'all', {}, db);
      return { updated };
    });
  },
};

export const localUser = {
  get: () => getJsonRow<any>('SELECT data FROM user_cache WHERE id = 1'),
  set: async (user: any) => {
    return withLocalTransaction(await getDb(), async db => {
      await db.runAsync(
        'INSERT INTO user_cache(id, data) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data',
        JSON.stringify(user),
      );
    });
  },
};
