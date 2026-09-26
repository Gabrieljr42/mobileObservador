const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load() {
  const file = path.resolve(__dirname, '../src/utils/formatters.ts');
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports });
  return module.exports;
}

test('workload amendment shows only affected jobs and does not hide salary changes', () => {
  const { workloadChanges } = load();
  const before = [{nome: 'Professor', jornada: 'Até 20 horas semanais', remuneracao: '3197.21'},
    {nome: 'Secretário de Escola', jornada: '20 horas semanais', remuneracao: '2682.07'}];
  const after = [before[0], {...before[1], jornada: '40 horas semanais'}];
  const result = workloadChanges(before, after);
  assert.equal(result.length, 1);
  assert.equal(result[0].name, 'Secretário de Escola');
  assert.equal(result[0].previous, '20 horas semanais');
  assert.equal(result[0].current, '40 horas semanais');
  const both = workloadChanges(before, [after[0], {...after[1], remuneracao: '3000.00'}]);
  assert.equal(both.length, 2);
  assert.equal(both[1].field, 'remuneracao');
  assert.equal(both[1].previous, '2682.07');
  assert.equal(both[1].current, '3000.00');
});

test('ELO changes keep field values readable and preserve supplied instant precision', () => {
  const { formatChangedValue, formatAmendmentEvent, formatTemporal } = load();

  assert.equal(formatChangedValue('Objetiva de Múltipla Escolha e Títulos'), 'Objetiva de Múltipla Escolha e Títulos');
  assert.equal(formatChangedValue('2026-11-30'), '30/11/2026');
  assert.match(formatChangedValue('2026-11-30T10:00:00-03:00'), /30\/11\/2026 às 10:00 \(UTC-03:00\)/);
  assert.equal(
    formatAmendmentEvent({ name: 'etapas_prova', value: 'Objetiva de Múltipla Escolha e Títulos' }),
    'Objetiva de Múltipla Escolha e Títulos',
  );
  assert.match(
    formatAmendmentEvent({ name: 'resultado_final_prazo', date: '2026-11-30', precision: 'day' }),
    /30\/11\/2026/,
  );
  assert.equal(formatAmendmentEvent({ name: 'Resultado final', date: '2026-11-30',
    end_time: '23:59', precision: 'local_time', timezone: null }),
    '30/11/2026 até 23:59 (fuso não informado)');
  assert.equal(formatTemporal('2026-10-09T02:59:00', null, 'instant'), '09/10/2026 às 02:59 (fuso não informado)');
  assert.equal(formatChangedValue({ date: '2026-10-08', precision: 'day' }), '08/10/2026');
  assert.equal(formatChangedValue({ date: '2026-10-08T23:59:00', precision: 'instant', timezone: 'America/Sao_Paulo' }), '08/10/2026 às 23:59 (America/Sao_Paulo)');
  assert.equal(formatChangedValue({ sha256: 'secret', provenance: [{ page: 2 }] }), 'Valor estruturado atualizado');
});
