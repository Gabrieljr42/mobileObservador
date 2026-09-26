const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load() {
  const file = path.resolve(__dirname, '../src/utils/cargos.ts');
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, Intl });
  return module.exports;
}

const cargo = (fields = {}) => ({
  nome: 'Agente Comunitário de Saúde',
  vagas_imediatas: 41,
  cadastro_reserva: true,
  remuneracao: '2800',
  moeda: 'BRL',
  jornada: '40h',
  requisitos: 'Ensino médio',
  taxa_inscricao: null,
  ...fields,
});

test('salary supplements stay separate and immediate quotas never imply reserve', () => {
  const { resumoCargo } = load();
  const summary = resumoCargo(cargo({
    vagas_imediatas: 2, cadastro_reserva: null, remuneracao: '2500.00',
    remuneracao_observacao: 'GPF variável de até R$ 3.750,00.',
    vagas_ampla_concorrencia: 1, vagas_pcd: 1, vagas_ppp: 0,
    prova_data: '2026-11-29', prova_inicio: '16:10',
    prova_horario_observacao: 'Horário de Brasília; duração de 4 horas.',
  }));
  assert.match(summary, /Remuneração: R\$\s*2\.500,00/);
  assert.match(summary, /GPF variável de até R\$ 3\.750,00/);
  assert.match(summary, /Distribuição das vagas imediatas: Ampla concorrência: 1; PcD: 1/);
  assert.doesNotMatch(summary, /PPP: 0/);
  assert.match(summary, /Cadastro de reserva: ainda não confirmado/);
  assert.match(summary, /Prova: 29\/11\/2026 às 16:10 — Horário de Brasília/);
  assert.doesNotMatch(summary, /6\.250|\+ cadastro de reserva/);
});

test('cargo summary shows known reserve quantity separately from immediate vacancies', () => {
  const { resumoCargo } = load();
  const known = resumoCargo(cargo({ vagas_cadastro_reserva: 280 }));
  assert.match(known, /41 vaga\(s\) imediata\(s\)/);
  assert.match(known, /280 vaga\(s\) de cadastro de reserva/);

  const legacy = resumoCargo(cargo());
  assert.match(legacy, /41 vaga\(s\) imediata\(s\) \+ cadastro de reserva/);
  assert.doesNotMatch(legacy, /undefined/);

  const unknown = resumoCargo(cargo({ cadastro_reserva: null, vagas_cadastro_reserva: null }));
  assert.match(unknown, /Cadastro de reserva: ainda não confirmado/);

  const observed = resumoCargo(cargo({
    cadastro_reserva: null,
    vagas_cadastro_reserva: null,
    cadastro_reserva_observacao: 'coluna PcD 10%',
  }));
  assert.match(observed, /Observação do cadastro de reserva: coluna PcD 10%/);
  assert.doesNotMatch(observed, /Cadastro de reserva: ainda não confirmado/);
});

test('ACCESS Birigui contract preserves hourly unit, quotas, workload and requirements', () => {
  const { resumoCargo } = load();
  const summary = resumoCargo({
    nome: 'Professor Auxiliar',
    vagas_imediatas: 10,
    cadastro_reserva: null,
    vagas_ampla_concorrencia: 9,
    vagas_pcd: 1,
    remuneracao: '30.53',
    moeda: 'BRL',
    remuneracao_observacao: 'por hora-aula',
    jornada: 'até 40 horas semanais',
    requisitos: 'Licenciatura Plena em Pedagogia ou Normal Superior',
    taxa_inscricao: null,
  });
  assert.match(summary, /Professor Auxiliar/);
  assert.match(summary, /10 vaga\(s\) imediata\(s\)/);
  assert.match(summary, /Ampla concorrência: 9; PcD: 1/);
  assert.match(summary, /Remuneração: R\$\s*30,53/);
  assert.match(summary, /por hora-aula/);
  assert.match(summary, /até 40 horas semanais/);
  assert.doesNotMatch(summary, /undefined|null/);
});

test('benefits formatter renders valid UTF-8 arrays and ignores legacy invalid payloads', () => {
  const { beneficiosCargo } = load();
  assert.deepEqual(Array.from(beneficiosCargo({ beneficios: [' auxílio alimentação R$ 680,00 ', 'vale-transporte', 7, null, ''] })), [
    'auxílio alimentação R$ 680,00', 'vale-transporte',
  ]);
  assert.deepEqual(Array.from(beneficiosCargo({ beneficios: [] })), []);
  assert.deepEqual(Array.from(beneficiosCargo({ beneficios: null })), []);
  assert.deepEqual(Array.from(beneficiosCargo({ beneficios: 'vale-transporte' })), []);
  assert.deepEqual(Array.from(beneficiosCargo(undefined)), []);
});

test('benefits formatter is independent for multiple cargos', () => {
  const { beneficiosCargo } = load();
  const cargos = [
    { nome: 'Professor Auxiliar', beneficios: ['auxílio alimentação R$ 680,00'] },
    { nome: 'Analista', beneficios: ['vale-transporte', 'plano de saúde'] },
    { nome: 'Técnico', beneficios: [] },
  ];
  assert.deepEqual(cargos.map(beneficiosCargo), [
    ['auxílio alimentação R$ 680,00'],
    ['vale-transporte', 'plano de saúde'],
    [],
  ]);
});

test('ID8 Guarda Civil Municipal preserves AC, PcD and PPP immediate quotas without CR aggregation', () => {
  const { cotasCargo, resumoCargo } = load();
  const id8 = cargo({
    nome: 'Guarda Civil Municipal',
    vagas_imediatas: 9,
    vagas_ampla_concorrencia: 6,
    vagas_pcd: 1,
    vagas_ppp: 2,
    cadastro_reserva: true,
    vagas_cadastro_reserva: 11,
  });
  assert.deepEqual(Array.from(cotasCargo(id8), ([label, count]) => [label, count]), [
    ['Ampla concorrência', 6], ['PcD', 1], ['PPP', 2],
  ]);
  const summary = resumoCargo(id8);
  assert.match(summary, /9 vaga\(s\) imediata\(s\)/);
  assert.match(summary, /6 vaga\(s\) de cadastro de reserva|\+ 11 vaga\(s\) de cadastro de reserva/);
  assert.match(summary, /Distribuição das vagas imediatas: Ampla concorrência: 6; PcD: 1; PPP: 2/);
  assert.doesNotMatch(summary, /11.*Ampla|11.*PPP/);
});

test('quota formatter omits zero, absent and legacy invalid categories', () => {
  const { cotasCargo } = load();
  assert.deepEqual(Array.from(cotasCargo(cargo({
    vagas_ampla_concorrencia: 0, vagas_pcd: null, vagas_ppp: undefined,
    vagas_indigenas: '1', vagas_quilombolas: -1, vagas_trans: 0,
  }))), []);
  assert.deepEqual(Array.from(cotasCargo(cargo({ vagas_ampla_concorrencia: 2 })), ([label, count]) => [label, count]), [['Ampla concorrência', 2]]);
});

test('ID14 keeps unknown immediate vacancies human-readable and preserves zero', () => {
  const { resumoCargo, textoVagasImediatas } = load();
  const pf = (name, fields) => ({
    nome: name,
    vagas_imediatas: null,
    cadastro_reserva: null,
    remuneracao: '30.53',
    moeda: 'BRL',
    remuneracao_observacao: 'honorários por hora/etapa',
    jornada: null,
    requisitos: 'Licenciatura',
    taxa_inscricao: null,
    ...fields,
  });
  const functions = [
    pf('Professor de Física — hora', { vagas_imediatas: null }),
    pf('Professor de Física — etapa', { vagas_imediatas: undefined }),
  ];
  functions.forEach(role => {
    const summary = resumoCargo(role);
    assert.match(summary, /Quantidade de vagas imediatas: ainda não confirmada/);
    assert.match(summary, /honorários por hora\/etapa/);
    assert.match(summary, /Jornada: ainda não confirmada/);
    assert.doesNotMatch(summary, /null|undefined|NaN/);
  });
  const unknown = resumoCargo(pf('Professor de Física', { vagas_imediatas: null }));
  assert.match(unknown, /Quantidade de vagas imediatas: ainda não confirmada/);
  assert.doesNotMatch(unknown, /null|undefined|NaN/);
  assert.equal(textoVagasImediatas(pf('Professor de Física', { vagas_imediatas: undefined })), 'Quantidade de vagas imediatas: ainda não confirmada');
  assert.equal(textoVagasImediatas(pf('Professor de Física', { vagas_imediatas: 0 })), '0 vaga(s) imediata(s)');
  const invalid = resumoCargo(pf('Professor de Física', { vagas_imediatas: Number.NaN, prova_inicio: 'etapa' }));
  assert.doesNotMatch(invalid, /NaN|null|undefined/);
  assert.match(invalid, /Jornada: ainda não confirmada/);
});

test('SHDias/legacy cargo aliases are normalized without undefined fields', () => {
  const { normalizarCargo, resumoCargo } = load();
  const feminino = normalizarCargo({
    codigo: '301', nome: 'Guarda Municipal – 4ª Classe (Feminino)', vagas: 12,
    remuneracao: '3971.37', requisito: '', jornada: null,
  }, 63.25);
  const masculino = normalizarCargo({
    codigo: 302, nome: 'Guarda Municipal – 4ª Classe (Masculino)', vagas: '28',
    remuneracao: 3971.37, requisitos: 'Ensino médio completo',
  }, '63.25');
  assert.equal(feminino.vagas_imediatas, 12);
  assert.equal(masculino.vagas_imediatas, 28);
  assert.equal(feminino.taxa_inscricao, '63.25');
  assert.match(resumoCargo(feminino), /301 .*Guarda Municipal/);
  assert.match(resumoCargo(feminino), /12 vaga\(s\) imediata\(s\)/);
  assert.match(resumoCargo(feminino), /R\$\s*63,25/);
  assert.match(resumoCargo(feminino), /Requisitos ainda não confirmados/);
  assert.doesNotMatch(resumoCargo(feminino), /undefined|null|NaN/);
  assert.match(resumoCargo(masculino), /302 .*Guarda Municipal/);
  assert.match(resumoCargo(masculino), /28 vaga\(s\) imediata\(s\)/);
});
