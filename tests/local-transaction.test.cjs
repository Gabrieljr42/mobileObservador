const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(platform, open) {
  const module = { exports: {} };
  const source = fs.readFileSync(require.resolve('../src/db/transaction.ts'), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require: name => name === 'react-native'
    ? { Platform: { OS: platform } } : { openDatabaseAsync: open } });
  return module.exports.withLocalTransaction;
}

test('web uses the passed singleton, rolls back, and does not open or close a second connection', async () => {
  const calls = [];
  const connection = { execAsync: async sql => calls.push(sql), closeAsync: async () => calls.push('CLOSE') };
  const run = load('web', async () => { throw Error('unexpected auxiliary connection'); });
  await assert.rejects(run(connection, async tx => { assert.equal(tx, connection); throw Error('invalid checkpoint'); }), /invalid checkpoint/);
  assert.deepEqual(calls, ['PRAGMA foreign_keys = ON', 'BEGIN IMMEDIATE', 'ROLLBACK']);
});

test('successful web checkpoint commits on the singleton', async () => {
  const calls = [];
  const connection = { execAsync: async sql => calls.push(sql), closeAsync: async () => calls.push('CLOSE') };
  const run = load('web', async () => { throw Error('unexpected auxiliary connection'); });
  await run(connection, async tx => { assert.equal(tx, connection); calls.push('CHECKPOINT'); });
  assert.deepEqual(calls, ['PRAGMA foreign_keys = ON', 'BEGIN IMMEDIATE', 'CHECKPOINT', 'COMMIT']);
});

test('web serializes concurrent transactions and releases the queue after a real lock error', async () => {
  const calls = [];
  let releaseFirst;
  const firstGate = new Promise(resolve => { releaseFirst = resolve; });
  let beginCount = 0;
  const connection = { execAsync: async sql => {
    calls.push(sql);
    if (sql === 'BEGIN IMMEDIATE' && ++beginCount === 1) await firstGate;
  } };
  const run = load('web', async () => { throw Error('unexpected auxiliary connection'); });
  const first = run(connection, async () => calls.push('FIRST'));
  await new Promise(resolve => setImmediate(resolve));
  const second = run(connection, async () => calls.push('SECOND'));
  assert.deepEqual(calls, ['PRAGMA foreign_keys = ON', 'BEGIN IMMEDIATE']);
  releaseFirst();
  await Promise.all([first, second]);
  assert.deepEqual(calls, [
    'PRAGMA foreign_keys = ON', 'BEGIN IMMEDIATE', 'FIRST', 'COMMIT',
    'PRAGMA foreign_keys = ON', 'BEGIN IMMEDIATE', 'SECOND', 'COMMIT',
  ]);
});

test('web lock failure is surfaced and a later retry can proceed', async () => {
  const calls = [];
  let locked = true;
  const connection = { execAsync: async sql => {
    calls.push(sql);
    if (sql === 'BEGIN IMMEDIATE' && locked) { locked = false; throw Error('database is locked'); }
  } };
  const run = load('web', async () => { throw Error('unexpected auxiliary connection'); });
  await assert.rejects(run(connection, async () => undefined), /database is locked/);
  await run(connection, async () => calls.push('RETRY'));
  assert.deepEqual(calls, [
    'PRAGMA foreign_keys = ON', 'BEGIN IMMEDIATE',
    'PRAGMA foreign_keys = ON', 'BEGIN IMMEDIATE', 'RETRY', 'COMMIT',
  ]);
});

test('Android retains the native exclusive transaction', async () => {
  const run = load('android', async () => { throw Error('unexpected web connection'); });
  let applied = false;
  await run({ withExclusiveTransactionAsync: task => task({}) }, async () => { applied = true; });
  assert.equal(applied, true);
});
