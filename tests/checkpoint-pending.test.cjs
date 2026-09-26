const { test } = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function fixture() {
  const sqlite = new DatabaseSync(':memory:');
  let failOutbox = false;
  const db = {
    execAsync: async sql => sqlite.exec(sql),
    runAsync: async (sql, ...params) => {
      if (failOutbox && sql.startsWith('INSERT INTO outbox')) throw Error('disk write failed');
      return sqlite.prepare(sql).run(...params);
    },
    getFirstAsync: async (sql, ...params) => sqlite.prepare(sql).get(...params) ?? null,
    getAllAsync: async (sql, ...params) => sqlite.prepare(sql).all(...params),
    withExclusiveTransactionAsync: async task => {
      sqlite.exec('BEGIN IMMEDIATE');
      try { await task(db); sqlite.exec('COMMIT'); }
      catch (e) { sqlite.exec('ROLLBACK'); throw e; }
    },
  };
  const cache = new Map();
  function load(file) {
    file = path.resolve(__dirname, file);
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} }; cache.set(file, module);
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS },
    }).outputText;
    vm.runInNewContext(code, { module, exports: module.exports, require: name => {
      if (name === 'expo-sqlite') return { openDatabaseAsync: async () => db };
      if (name === 'react-native') return { Platform: { OS: 'android' } };
      return load(path.resolve(path.dirname(file), name + '.ts'));
    } });
    return module.exports;
  }
  return { database: load('../src/db/database.ts'), repos: load('../src/db/repositories.ts'),
    failWrites: () => { failOutbox = true; }, close: () => sqlite.close() };
}

const checkpoint = title => ({ generated_at: '2030-01-01T00:00:00Z',
  concursos: [{ id: 7, titulo: title }], favorites: [], alerts: [] });

test('checkpoint arriving after an offline favorite preserves both cache and pending action', async () => {
  const f = fixture();
  try {
    await f.database.applyCheckpoint(checkpoint('Original'));
    await f.repos.localFavorites.add(7);
    await assert.rejects(f.database.applyCheckpoint(checkpoint('Retificado')), /alterações locais/);
    assert.equal((await f.repos.localFavorites.all())[0].id, 7);
    assert.equal((await f.repos.localConcursos.byId(7)).titulo, 'Original');
    const outbox = await f.database.getOutbox();
    assert.equal(outbox.length, 1);
    // Acknowledged server state now includes the favorite and revised title.
    await f.database.deleteOutboxItem(outbox[0].id);
    const next = checkpoint('Retificado');
    next.favorites = [{ concurso_id: 7, concurso: next.concursos[0] }];
    await f.database.applyCheckpoint(next);
    assert.equal((await f.repos.localFavorites.all())[0].titulo, 'Retificado');
  } finally { f.close(); }
});

test('outbox failure rolls back local favorite and preferences writes', async () => {
  const f = fixture();
  try {
    await f.database.applyCheckpoint(checkpoint('Original'));
    f.failWrites();
    await assert.rejects(f.repos.localFavorites.add(7), /disk write failed/);
    await assert.rejects(f.repos.localPreferences.set({ states: ['PB'] }), /disk write failed/);
    assert.equal((await f.repos.localFavorites.all()).length, 0);
    assert.equal(await f.repos.localPreferences.get(), null);
    assert.equal((await f.database.getOutbox()).length, 0);
  } finally { f.close(); }
});

test('unsent alert edits survive checkpoint and deleting the alert cancels its queued work', async () => {
  const f = fixture();
  try {
    await f.database.applyCheckpoint(checkpoint('Original'));
    const alert = await f.repos.localAlerts.create({ name: 'Alerta local' });
    await f.repos.localAlerts.update(alert.id, { name: 'Nome corrigido' });
    await assert.rejects(f.database.applyCheckpoint(checkpoint('Retificado')), /alterações locais/);
    assert.equal((await f.repos.localAlerts.all())[0].name, 'Nome corrigido');
    await f.repos.localAlerts.remove(alert.id);
    assert.equal((await f.database.getOutbox()).length, 0);
    await f.database.applyCheckpoint(checkpoint('Retificado'));
    assert.equal((await f.repos.localAlerts.all()).length, 0);
  } finally { f.close(); }
});

test('unsent alert activation changes remain explicit in local data and outbox', async () => {
  const f = fixture();
  try {
    const alert = await f.repos.localAlerts.create({ name: 'Alerta toggle', active: true });
    const updated = await f.repos.localAlerts.update(alert.id, { active: false });
    assert.equal(updated.active, false);
    assert.equal((await f.repos.localAlerts.all())[0].active, false);
    const pending = await f.database.getOutbox();
    assert.deepEqual(JSON.parse(pending.at(-1).payload), { active: false });
  } finally { f.close(); }
});

test('switching accounts never exposes the previous user alert or outbox', async () => {
  const f = fixture();
  try {
    await f.database.setActiveUser(101);
    const alertA = await f.repos.localAlerts.create({ name: 'Somente A', active: false });
    assert.equal((await f.repos.localAlerts.all())[0].name, 'Somente A');
    assert.equal((await f.database.getOutbox()).length, 1);

    // Logout/login of another account is represented by changing the local
    // ownership boundary; private rows and pending requests are discarded,
    // while the public concursos cache remains available.
    await f.database.setActiveUser(202);
    assert.deepEqual(await f.repos.localAlerts.all(), []);
    assert.deepEqual(await f.database.getOutbox(), []);
    const alertB = await f.repos.localAlerts.create({ name: 'Somente B' });
    assert.equal((await f.repos.localAlerts.all())[0].name, 'Somente B');
    assert.notEqual(alertA.id, alertB.id);
  } finally { f.close(); }
});

test('outbox deletion is owner-scoped even when a stale worker has an old id', async () => {
  const f = fixture();
  try {
    await f.database.setActiveUser(101);
    await f.repos.localAlerts.create({ name: 'A' });
    const stale = (await f.database.getOutbox())[0];
    await f.database.setActiveUser(202);
    await f.repos.localAlerts.create({ name: 'B' });
    // A worker holding A's snapshot must not delete B's row if ids are reused
    // or if the account changed between its API response and acknowledgement.
    await f.database.deleteOutboxItem(stale.id, 101);
    const current = await f.database.getOutbox();
    assert.equal(current.length, 1);
    assert.equal(JSON.parse(current[0].payload).name, 'B');
  } finally { f.close(); }
});
