const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(fileName = 'registrationStatus.ts') {
  const file = path.resolve(__dirname, `../src/utils/${fileName}`);
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports });
  return module.exports;
}

const contest = (fields = {}) => ({
  status: null,
  inscricao_inicio: null,
  inscricao_fim: null,
  ...fields,
});

test('published date-only periods classify real catalogue records by day', () => {
  const { registrationSituation } = load();
  const now = new Date('2026-09-09T12:00:00-03:00');

  assert.equal(registrationSituation(contest({ inscricao_inicio: '2026-08-31', inscricao_fim: '2026-10-08' }), now), 'open');
  assert.equal(registrationSituation(contest({ inscricao_inicio: '2026-08-21', inscricao_fim: '2026-09-10' }), now), 'open');
  assert.equal(registrationSituation(contest({ inscricao_inicio: '2026-02-02', inscricao_fim: '2026-03-04' }), now), 'closed');
  assert.equal(registrationSituation(contest({ inscricao_inicio: '2026-11-17', inscricao_fim: '2026-12-17' }), now), 'upcoming');
});

test('the ten records in the delivery snapshot have the expected situation on 2026-09-09', () => {
  const { registrationSituation } = load();
  const now = new Date('2026-09-09T12:00:00-03:00');
  const records = [
    ['Birigui', '2026-08-31', '2026-10-08', 'open'],
    ['Ibiúna', '2026-08-25', '2026-09-08', 'closed'],
    ['Pedrinhas (versão histórica)', '2026-08-21', '2026-09-04', 'closed'],
    ['Carmo da Cachoeira', '2026-11-17', '2026-12-17', 'upcoming'],
    ['Unaí', '2026-10-30', '2026-12-01', 'upcoming'],
    ['Berizal', '2026-10-13', '2026-11-13', 'upcoming'],
    ['Garça', '2026-09-04', '2026-10-07', 'open'],
    ['Reriutaba', '2026-09-02', '2026-10-05', 'open'],
    ['Ponta Porã', '2026-08-21', '2026-09-10', 'open'],
    ['Caxambu do Sul', '2026-02-02', '2026-03-04', 'closed'],
  ];
  for (const [name, start, end, expected] of records) {
    assert.equal(
      registrationSituation(contest({ inscricao_inicio: start, inscricao_fim: end }), now),
      expected,
      name,
    );
  }
});

test('Pedrinhas exam date stays a calendar day when registration retification has an instant', () => {
  const { formatPublishedTemporal } = load('formatters.ts');
  const rawData = {
    tenderproof: {
      amendments: [{ periods: { current: { precision: 'instant', timezone: 'America/Sao_Paulo' } } }],
    },
  };
  assert.equal(formatPublishedTemporal('2026-09-27T00:00:00Z', rawData, 'prova_data'), '27/09/2026');
  assert.match(formatPublishedTemporal('2026-09-10T10:00:00-03:00', rawData, 'inscricao_fim'), /10\/09\/2026 às 10:00/);
});

test('date-only end is inclusive, while a retification instant preserves its closing hour', () => {
  const { registrationSituation } = load();
  assert.equal(registrationSituation(contest({ inscricao_inicio: '2026-09-01', inscricao_fim: '2026-09-09' }), new Date('2026-09-10T02:59:59.999Z')), 'open');
  assert.equal(registrationSituation(contest({ inscricao_inicio: '2026-09-01', inscricao_fim: '2026-09-09' }), new Date('2026-09-10T03:00:00Z')), 'closed');
  const retified = contest({ inscricao_inicio: '2026-09-09T10:00:00-03:00', inscricao_fim: '2026-09-11T10:00:00-03:00' });
  assert.equal(registrationSituation(retified, new Date('2026-09-11T09:59:59-03:00')), 'open');
  assert.equal(registrationSituation(retified, new Date('2026-09-11T10:00:00-03:00')), 'closed');
});

test('a midnight retification remains an instant when the payload carries precision metadata', () => {
  const { registrationSituation } = load();
  const retified = contest({
    inscricao_inicio: '2026-09-11T00:00:00-03:00',
    inscricao_fim: '2026-09-11T00:00:00-03:00',
    raw_data: { tenderproof: { current_period: { start_precision: 'instant', end_precision: 'instant' } } },
  });
  assert.equal(registrationSituation(retified, new Date('2026-09-11T02:59:59.999Z')), 'upcoming');
  assert.equal(registrationSituation(retified, new Date('2026-09-11T03:00:00Z')), 'closed');
});

test('precision metadata from the applied amendment ledger is honored', () => {
  const { registrationSituation } = load();
  const retified = contest({
    inscricao_inicio: '2026-09-11T00:00:00-03:00',
    inscricao_fim: '2026-09-11T00:00:00-03:00',
    raw_data: { tenderproof: { amendments: [{ periods: { current: { precision: 'instant' } } }] } },
  });
  assert.equal(registrationSituation(retified, new Date('2026-09-11T02:59:59.999Z')), 'upcoming');
  assert.equal(registrationSituation(retified, new Date('2026-09-11T03:00:00Z')), 'closed');
});

test('period dates override stale status without changing the canonical status field', () => {
  const { registrationSituation } = load();
  const historical = contest({ status: 'Inscrições abertas', inscricao_inicio: '2026-08-21', inscricao_fim: '2026-09-04' });
  assert.equal(registrationSituation(historical, new Date('2026-09-09T12:00:00-03:00')), 'closed');
  assert.equal(historical.status, 'Inscrições abertas');
});

test('generic or incomplete status never invents an open period', () => {
  const { registrationSituation } = load();
  assert.equal(registrationSituation(contest({ status: 'Em andamento' }), new Date('2026-09-09T12:00:00-03:00')), 'unknown');
  assert.equal(registrationSituation(contest({ status: 'Inscrições abertas' }), new Date('2026-09-09T12:00:00-03:00')), 'open');
  assert.equal(registrationSituation(contest({ inscricao_inicio: '2026-09-09' }), new Date('2026-09-09T12:00:00-03:00')), 'unknown');
});

test('invalid and inverted periods remain unknown', () => {
  const { registrationSituation } = load();
  const now = new Date('2026-09-09T12:00:00-03:00');
  assert.equal(registrationSituation(contest({ inscricao_inicio: '2026-09-10', inscricao_fim: '2026-09-01', status: 'Inscrições abertas' }), now), 'unknown');
  assert.equal(registrationSituation(contest({ inscricao_inicio: 'not-a-date', inscricao_fim: '2026-09-10', status: 'Em andamento' }), now), 'unknown');
});
