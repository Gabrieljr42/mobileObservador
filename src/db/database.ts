import * as SQLite from 'expo-sqlite';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export type OutboxOperation = {
  id: number;
  op: string;
  entity_key: string | null;
  payload: string | null;
  created_at: string;
};

export const getDb = async (): Promise<SQLite.SQLiteDatabase> => {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('observador.db');
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        PRAGMA foreign_keys = ON;

        CREATE TABLE IF NOT EXISTS metadata (
          key TEXT PRIMARY KEY NOT NULL,
          value TEXT
        );

        CREATE TABLE IF NOT EXISTS user_cache (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          data TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS concursos (
          id INTEGER PRIMARY KEY NOT NULL,
          updated_at TEXT,
          data TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_concursos_updated_at ON concursos(updated_at);

        CREATE TABLE IF NOT EXISTS publications (
          id INTEGER PRIMARY KEY NOT NULL,
          concurso_id INTEGER NOT NULL,
          publication_date TEXT,
          data TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_publications_concurso ON publications(concurso_id);

        CREATE TABLE IF NOT EXISTS versions (
          id INTEGER PRIMARY KEY NOT NULL,
          concurso_id INTEGER NOT NULL,
          captured_at TEXT,
          data TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_versions_concurso ON versions(concurso_id);

        CREATE TABLE IF NOT EXISTS recent_updates (
          id INTEGER PRIMARY KEY NOT NULL,
          captured_at TEXT,
          data TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS my_updates (
          id INTEGER PRIMARY KEY NOT NULL,
          captured_at TEXT,
          data TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS favorites (
          concurso_id INTEGER PRIMARY KEY NOT NULL,
          data TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS alerts (
          local_id INTEGER PRIMARY KEY NOT NULL,
          remote_id INTEGER,
          data TEXT NOT NULL
        );
        CREATE UNIQUE INDEX IF NOT EXISTS idx_alerts_remote_id ON alerts(remote_id) WHERE remote_id IS NOT NULL;

        CREATE TABLE IF NOT EXISTS notifications (
          id INTEGER PRIMARY KEY NOT NULL,
          created_at TEXT,
          data TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS preferences (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          data TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS outbox (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          op TEXT NOT NULL,
          entity_key TEXT,
          payload TEXT,
          created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_outbox_created_at ON outbox(created_at, id);
      `);
      return db;
    })().catch(error => {
      dbPromise = null;
      throw error;
    });
  }
  return dbPromise;
};

const parse = <T>(value: string | null | undefined): T | null => {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
};

export const setMetadata = async (key: string, value: string | null) => {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO metadata(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    key,
    value,
  );
};

export const getMetadata = async (key: string): Promise<string | null> => {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string | null }>('SELECT value FROM metadata WHERE key = ?', key);
  return row?.value ?? null;
};

export const getJsonRows = async <T>(sql: string, ...params: any[]): Promise<T[]> => {
  const db = await getDb();
  const rows = await db.getAllAsync<{ data: string }>(sql, ...params);
  return rows.map(row => parse<T>(row.data)).filter((value): value is T => value !== null);
};

export const getJsonRow = async <T>(sql: string, ...params: any[]): Promise<T | null> => {
  const db = await getDb();
  const row = await db.getFirstAsync<{ data: string }>(sql, ...params);
  return parse<T>(row?.data);
};

export const queueOutbox = async (op: string, entityKey?: string | number | null, payload?: unknown) => {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO outbox(op, entity_key, payload, created_at) VALUES (?, ?, ?, ?)',
    op,
    entityKey == null ? null : String(entityKey),
    payload === undefined ? null : JSON.stringify(payload),
    new Date().toISOString(),
  );
};

export const getOutbox = async (): Promise<OutboxOperation[]> => {
  const db = await getDb();
  return db.getAllAsync<OutboxOperation>('SELECT * FROM outbox ORDER BY id ASC');
};

export const deleteOutboxItem = async (id: number) => {
  const db = await getDb();
  await db.runAsync('DELETE FROM outbox WHERE id = ?', id);
};

export const deleteOutboxForEntity = async (ops: string[], entityKey: string | number) => {
  const db = await getDb();
  if (!ops.length) return;
  const placeholders = ops.map(() => '?').join(',');
  await db.runAsync(
    `DELETE FROM outbox WHERE entity_key = ? AND op IN (${placeholders})`,
    String(entityKey),
    ...ops,
  );
};

export const applyCheckpoint = async (checkpoint: any) => {
  const db = await getDb();

  await db.withExclusiveTransactionAsync(async transaction => {
    await transaction.execAsync(`
      DELETE FROM concursos;
      DELETE FROM publications;
      DELETE FROM versions;
      DELETE FROM recent_updates;
      DELETE FROM my_updates;
      DELETE FROM favorites;
      DELETE FROM alerts;
      DELETE FROM notifications;
      DELETE FROM preferences;
      DELETE FROM user_cache;
    `);

    if (checkpoint.user) {
      await transaction.runAsync('INSERT INTO user_cache(id, data) VALUES (1, ?)', JSON.stringify(checkpoint.user));
    }
    if (checkpoint.preferences) {
      await transaction.runAsync('INSERT INTO preferences(id, data) VALUES (1, ?)', JSON.stringify(checkpoint.preferences));
    }

    for (const item of checkpoint.concursos || []) {
      await transaction.runAsync(
        'INSERT INTO concursos(id, updated_at, data) VALUES (?, ?, ?)',
        item.id,
        item.updated_at || null,
        JSON.stringify(item),
      );
    }
    for (const item of checkpoint.publications || []) {
      await transaction.runAsync(
        'INSERT INTO publications(id, concurso_id, publication_date, data) VALUES (?, ?, ?, ?)',
        item.id,
        item.concurso_id,
        item.publication_date || null,
        JSON.stringify(item),
      );
    }
    for (const item of checkpoint.versions || []) {
      await transaction.runAsync(
        'INSERT INTO versions(id, concurso_id, captured_at, data) VALUES (?, ?, ?, ?)',
        item.id,
        item.concurso_id,
        item.captured_at || null,
        JSON.stringify(item),
      );
    }
    for (const item of checkpoint.recent_updates || []) {
      await transaction.runAsync(
        'INSERT INTO recent_updates(id, captured_at, data) VALUES (?, ?, ?)',
        item.id,
        item.captured_at || null,
        JSON.stringify(item),
      );
    }
    for (const item of checkpoint.my_updates || []) {
      await transaction.runAsync(
        'INSERT INTO my_updates(id, captured_at, data) VALUES (?, ?, ?)',
        item.id,
        item.captured_at || null,
        JSON.stringify(item),
      );
    }
    for (const favorite of checkpoint.favorites || []) {
      if (!favorite?.concurso_id || !favorite?.concurso) continue;
      await transaction.runAsync(
        'INSERT INTO favorites(concurso_id, data) VALUES (?, ?)',
        favorite.concurso_id,
        JSON.stringify(favorite.concurso),
      );
    }
    for (const item of checkpoint.alerts || []) {
      await transaction.runAsync(
        'INSERT INTO alerts(local_id, remote_id, data) VALUES (?, ?, ?)',
        item.id,
        item.id,
        JSON.stringify(item),
      );
    }
    for (const item of checkpoint.notifications || []) {
      const normalized = {
        ...item,
        is_read: item.is_read ?? !!item.read_at,
        body: item.body ?? item.message ?? '',
      };
      await transaction.runAsync(
        'INSERT INTO notifications(id, created_at, data) VALUES (?, ?, ?)',
        item.id,
        item.created_at || null,
        JSON.stringify(normalized),
      );
    }

    await transaction.runAsync(
      'INSERT INTO metadata(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      'last_sync_at',
      checkpoint.generated_at || new Date().toISOString(),
    );
  });
};

export const clearLocalData = async () => {
  const db = await getDb();
  await db.withExclusiveTransactionAsync(async transaction => {
    await transaction.execAsync(`
      DELETE FROM concursos;
      DELETE FROM publications;
      DELETE FROM versions;
      DELETE FROM recent_updates;
      DELETE FROM my_updates;
      DELETE FROM favorites;
      DELETE FROM alerts;
      DELETE FROM notifications;
      DELETE FROM preferences;
      DELETE FROM user_cache;
      DELETE FROM outbox;
      DELETE FROM metadata;
    `);
  });
};

export const countLocalConcursos = async () => {
  const db = await getDb();
  const row = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM concursos');
  return row?.count ?? 0;
};
