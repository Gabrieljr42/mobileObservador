const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(fileName) {
  const file = fileName.includes('/')
    ? path.resolve(__dirname, `../src/${fileName}`)
    : path.resolve(__dirname, `../src/utils/${fileName}`);
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, Intl, Date });
  return module.exports;
}

test('real delivery payload preserves Pedrinhas periods, exam day and local event hours', (t) => {
  const payloadPath = process.env.OBSERVADOR_DELIVERY_RECEIPT
    ? path.resolve(process.env.OBSERVADOR_DELIVERY_RECEIPT)
    : path.resolve(__dirname, '../../backend/.tenderproof/product-completion/delivery-api-current-20260909T212450799438Z.json');
  if (!fs.existsSync(payloadPath)) {
    t.skip('delivery receipt unavailable; set OBSERVADOR_DELIVERY_RECEIPT for operational validation');
    return;
  }
  const payload = JSON.parse(fs.readFileSync(payloadPath, 'utf8'));
  const record = payload.catalogue.find(item => item.titulo.includes('PEDRINHAS'));
  assert.ok(record, 'Pedrinhas record must be present in the real delivery payload');

  const rawData = { tenderproof: { amendments: record.amendments } };
  const { registrationSituation } = load('registrationStatus.ts');
  const { formatPublishedTemporal, formatAmendmentEvent } = load('formatters.ts');
  const { concursoCargoNames, matchesCargo } = load('searchFilters.ts');
  const contest = { status: null, inscricao_inicio: record.inscricao_inicio, inscricao_fim: record.inscricao_fim, raw_data: rawData };

  assert.equal(registrationSituation(contest, new Date('2026-09-09T15:00:00Z')), 'open');
  const amendment = record.amendments.at(-1);
  assert.equal(formatPublishedTemporal(amendment.periods.original.start, rawData, 'inscricao_inicio'), '21/08/2026');
  assert.match(formatPublishedTemporal(amendment.periods.current.start, rawData, 'inscricao_inicio'), /09\/09\/2026 às 10:00/);
  assert.equal(formatPublishedTemporal(record.prova_data, rawData, 'prova_data'), '27/09/2026');
  assert.equal(formatAmendmentEvent(amendment.events.find(event => event.name === 'Prova objetiva')), '27/09/2026 às 08:00–11:00 (fuso não informado)');

  const realRecords = payload.catalogue.map(item => ({ ...item, status: null }));
  const byCargo = (query) => realRecords.filter(item => matchesCargo(item, query)).map(item => item.id).sort((a, b) => a - b);
  assert.deepEqual(byCargo('Arquivista'), [13]);
  assert.deepEqual(byCargo('Técnico de Enfermagem'), [10]);
  assert.deepEqual(byCargo('Analista em Sanidade'), [12]);
  assert.ok(concursoCargoNames(realRecords.find(item => item.id === 13)).some(name => name.includes('Arquivista')));
});
