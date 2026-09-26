import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';

// The web OPFS VFS owns one access handle per origin. Opening a second
// connection (even briefly) can make the primary connection fail with a
// misleading "database is locked" error. Keep the singleton from database.ts
// as the only connection and serialize explicit transactions on it.
let webTransactionTail: Promise<void> = Promise.resolve();

async function withWebTransaction<T>(
  db: SQLite.SQLiteDatabase,
  task: (transaction: SQLite.SQLiteDatabase) => Promise<T>,
) {
  let release!: () => void;
  const previous = webTransactionTail;
  webTransactionTail = new Promise<void>(resolve => { release = resolve; });
  await previous;

  let began = false;
  try {
    await db.execAsync('PRAGMA foreign_keys = ON');
    await db.execAsync('BEGIN IMMEDIATE');
    began = true;
    const result = await task(db);
    await db.execAsync('COMMIT');
    began = false;
    return result;
  } catch (error) {
    // Preserve the real operation error when rollback itself cannot run (for
    // example, while an external tab still owns the OPFS handle).
    if (began) {
      try { await db.execAsync('ROLLBACK'); } catch { /* keep original */ }
    }
    throw error;
  } finally {
    release();
  }
}

export async function withLocalTransaction<T>(
  db: SQLite.SQLiteDatabase,
  task: (transaction: SQLite.SQLiteDatabase) => Promise<T>,
) {
  if (Platform.OS !== 'web') {
    let result!: T;
    await db.withExclusiveTransactionAsync(async transaction => { result = await task(transaction); });
    return result;
  }
  // Expo's exclusive helper rejects web. Reuse the singleton connection: a
  // second AccessHandle connection on the same origin causes OPFS lock races.
  return withWebTransaction(db, task);
}
