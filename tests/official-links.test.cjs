const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load() {
  const file = path.resolve(__dirname, '../src/utils/officialLinks.ts');
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports });
  return module.exports;
}

test('detail actions use official page when registration or edital links are unavailable/temporary', () => {
  const { concursoActionLinks, isTemporarySignedUrl } = load();
  const signed = 'https://storage.example/edital.pdf?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Signature=expired';
  const plain = value => JSON.parse(JSON.stringify(value));
  assert.equal(isTemporarySignedUrl(signed), true);
  assert.deepEqual(plain(concursoActionLinks({ link_inscricao: null, link_edital: null, link_pagina: 'https://portal.example/concurso' })), {
    primary: { label: 'Página oficial', url: 'https://portal.example/concurso' },
    edital: null,
  });
  assert.deepEqual(plain(concursoActionLinks({ link_inscricao: null, link_edital: signed, link_pagina: 'https://portal.example/concurso' })), {
    primary: { label: 'Página oficial', url: 'https://portal.example/concurso' },
    edital: { label: 'Edital na página oficial', url: 'https://portal.example/concurso' },
  });
  assert.deepEqual(plain(concursoActionLinks({ link_inscricao: 'https://inscricao.example', link_edital: 'https://portal.example/edital.pdf', link_pagina: 'https://portal.example/concurso' })), {
    primary: { label: 'Inscrever-se', url: 'https://inscricao.example' },
    edital: { label: 'Abrir edital', url: 'https://portal.example/edital.pdf' },
  });
});
