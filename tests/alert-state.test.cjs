const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load() {
  const file = path.resolve(__dirname, '../src/utils/alertState.ts');
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports });
  return module.exports;
}

test('empty read retains only alerts with pending local create/update', () => {
  const { mergePendingAlerts } = load();
  const pending = [{ op: 'alert_create', entity_key: -10 }];
  assert.equal(JSON.stringify(mergePendingAlerts([], [{ id: -10, name: 'offline' }, { id: 20, name: 'server' }], pending)), JSON.stringify([{ id: -10, name: 'offline' }]));
  assert.equal(JSON.stringify(mergePendingAlerts([], [{ id: 20, name: 'server' }], [])), '[]');
});

test('server rows win once the same alert is present in the checkpoint', () => {
  const { mergePendingAlerts } = load();
  assert.equal(JSON.stringify(mergePendingAlerts([{ id: 20, name: 'server' }], [{ id: 20, name: 'old' }], [{ op: 'alert_update', entity_key: 20 }])), JSON.stringify([{ id: 20, name: 'server' }]));
});
