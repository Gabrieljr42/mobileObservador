const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load() {
  const file = path.resolve(__dirname, '../src/utils/searchFilters.ts');
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports });
  return module.exports;
}

test('cargo search includes structured names when legacy cargo is empty', () => {
  const { concursoCargoNames, matchesCargo } = load();
  const contest = {
    cargo: null,
    cargos: [{ nome: 'Arquivista' }, { nome: 'Técnico de Enfermagem' }, { nome: 'Arquivista' }],
  };
  assert.deepEqual(Array.from(concursoCargoNames(contest)), ['Arquivista', 'Técnico de Enfermagem']);
  assert.equal(matchesCargo(contest, 'arquivista'), true);
  assert.equal(matchesCargo(contest, 'enfermagem'), true);
  assert.equal(matchesCargo(contest, 'odontologia'), false);
});
