/* Component interactions with synthetic API responses; no HTTP or production writes. */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const React = require('react');
const { create, act } = require('react-test-renderer');
global.IS_REACT_ACT_ENVIRONMENT = true;
const calls = [];
const initial = { id: 'synthetic', action: 'create', concurso_id: null, proposal_hash: 'hash', state: 'proposed', stale: false, baseline: { values: {} }, proposed: { titulo: 'Concurso fixture', orgao: 'Órgão fixture', edital_numero: '01/2026' }, eligible_fields: ['titulo','orgao','edital_numero'], required_fields: ['titulo','orgao','edital_numero'], blockers: [], blocked_fields: { remuneracao: 'escopo insuficiente' }, evidences: { titulo: { items: [{ snippet: 'Concurso fixture no edital', page_number: 2 }] } }, identity: { reason: 'identidade sintética', external_id: '1', detail_url: 'https://example.invalid/1' }, approved_fields: [], result: null };
let response = initial;
let documentReview = { pending:false, documents:[] };
const api = {
  getTenderProofDocumentReview: async () => documentReview,
  getTenderProofContinuousStatus: async () => ({ operationally_enabled:false, operator_authorized:true, sources:[{source:'fixture', enabled:false, mode:'real', known_candidates:2,pending_reviews:1,browser_hold:'journal',cycles:[{status:'partial',reasons:['candidate_limit']}]}] }),
  getTenderProofObservations: async () => [{observation_id:'observation-fixture',source:'fixture',mode:'real',run_id:'failed-run',status:'pending_review',last_seen:1,summary:{title:'Edital a revisar',validation_status:'document_review_required',review_reason:'Documento ambíguo',document_bytes_verified:false,documents:[]}}],
  getTenderProofCatalogue: async () => [{number:1,source:'fixture',name:'Fonte fixture',category:'banca',listing_urls:[],adapter_implemented:true,homologation:'see_validation_matrix'}],
  createTenderProofProposal: async (...args) => { calls.push(['create', ...args]); return response; },
  actTenderProofProposal: async (p, action, fields) => { calls.push([action, fields]); if (action === 'approve') return { ...p, state: 'approved', approved_fields: fields }; throw { response: { status: 409, data: { detail: 'Catálogo alterado; compare novamente' } } }; },
  getTenderProofProposal: async () => ({ ...initial, stale: true }),
  rollbackTenderProofProposal: async (...args) => { calls.push(['rollback', ...args]); return { ...response, state: 'rolled_back', rollback_version_id: 2 }; },
};
const source = fs.readFileSync(path.join(__dirname, '../src/components/TenderProofReview.tsx'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const exportsObject = {};
vm.runInNewContext(compiled, { exports: exportsObject, require: name => name === 'react-native' ? Object.fromEntries(['View','Text','TextInput','Pressable','ActivityIndicator'].map(n => [n,n])) : name === 'expo-router' ? { useRouter: () => ({ push() {} }) } : name === '../api/tenderproof' ? api : name === '../utils/cargos' ? { resumoCargo: value => String(value?.nome ?? value) } : name === './DocumentEffectReview' ? { DocumentEffectReview: () => null } : require(name), console });
const run = { run_id: 'fixture', source: 'fixture', candidates: [] };
let screen;
const text = node => typeof node === 'string' ? node : (node.children || []).map(text).join('');
const button = label => screen.root.findAllByType('Pressable').find(n => text(n).includes(label));
const click = async label => { const b = button(label); assert.ok(b, label); assert.ok(!b.props.disabled, `${label} disabled`); await act(async () => b.props.onPress()); };
(async () => {
 await act(async () => { screen = create(React.createElement(exportsObject.PublicationReview, { styles: {}, run, onEvidence: page => calls.push(['evidence',page]) })); });
 await click('Conferir identidade');
 assert.deepEqual(calls[0], ['create','fixture',null]);
 assert.match(text(screen.toJSON()), /Novo cadastro/);
 assert.match(text(screen.toJSON()), /Publicar: Concurso fixture/);
 assert.match(text(screen.toJSON()), /Concurso fixture no edital/);
 assert.ok(button('Aprovar os').props.disabled);
 const checks = screen.root.findAllByType('Pressable').filter(n => n.props.accessibilityRole === 'checkbox');
 await act(async () => checks[0].props.onPress());
 assert.ok(button('Aprovar os').props.disabled, 'required creation fields cannot be omitted');
 await act(async () => { checks[1].props.onPress(); checks[2].props.onPress(); });
 await click('Aprovar os');
 assert.match(text(screen.toJSON()), /Aplicar irá cadastrar um concurso/);
 await click('Cadastrar concurso');
 assert.match(text(screen.toJSON()), /Catálogo alterado/);
 assert.ok(button('Cadastrar concurso').props.disabled, 'uncertain or conflicting application requires refresh');
 await click('Consultar situação');
 assert.ok(button('Aprovar os').props.disabled, 'stale proposal is not approvable');
 await act(async () => screen.unmount());
 response = { ...initial, action:'create', state:'applied', concurso_id:7, result:{diff:{},notification_status:'outbox_pending'}, version_id:1 };
 await act(async () => { screen = create(React.createElement(exportsObject.PublicationReview, { styles: {}, run, onEvidence() {} })); });
 await click('Conferir identidade');
 assert.match(text(screen.toJSON()), /arquiva o concurso e preserva o histórico/);
 assert.ok(button('Reverter e arquivar').props.disabled);
 const reason = screen.root.findAllByType('TextInput').find(n => n.props.accessibilityLabel === 'Motivo da reversão');
 await act(async () => reason.props.onChangeText('Cadastro incorreto na fixture'));
 await click('Reverter e arquivar');
 assert.match(text(screen.toJSON()), /Reversão confirmada/);
 await act(async () => screen.unmount());
 response = { ...initial, state:'approved', approved_fields:initial.required_fields };
 await act(async () => { screen = create(React.createElement(exportsObject.PublicationReview, { styles: {}, run, onEvidence() {} })); });
 await click('Conferir identidade');
 assert.ok(!button('Cadastrar concurso').props.disabled);
 documentReview = { pending:true, reason:'Retificação nova; efeitos ainda não revisados.', documents:[{ title:'Retificação de prazo (fixture)', url:'https://example.invalid/retificacao.pdf', kind:'outro' }] };
 await click('Atualizar situação dos documentos');
 assert.match(text(screen.toJSON()), /Documentos novos ou alterados aguardam revisão dos efeitos/);
 await click('Consultar lista de documentos');
 assert.match(text(screen.toJSON()), /Retificação de prazo/);
 assert.match(text(screen.toJSON()), /example.invalid\/retificacao.pdf/);
 assert.ok(button('Cadastrar concurso').props.disabled, 'new documentary pending state blocks previously approved proposal');
 assert.ok(button('Conferir identidade').props.disabled);
 documentReview = { pending:true, documents:[{ title:'Edital alterado (fixture)', url:'https://example.invalid/edital.pdf', kind:'edital', change:'bytes_changed' }] };
 await click('Atualizar situação dos documentos');
 assert.match(text(screen.toJSON()), /conteúdo deste arquivo mudou no mesmo endereço/);
 assert.ok(button('Cadastrar concurso').props.disabled, 'changed bytes also block previously approved proposal');
 await act(async () => screen.unmount());
 await act(async () => { screen = create(React.createElement(exportsObject.PublicationReview, { styles: {}, run, onEvidence() {} })); });
 assert.ok(button('Conferir identidade').props.disabled, 'new proposal also requires documentary review');
 await act(async () => screen.unmount());
 documentReview = { pending:false, documents:[] };
 response = {
   kind: 'field_amendment', id: 'amendment-fixture', run_id: 'fixture', concurso_id: 42,
   proposal_hash: 'amendment-hash', state: 'proposed', identity: { source_id: 1, external_id: '42', edital_numero: '01/2026', concurso_id: 42 },
   reason: 'Retificação oficial prorrogou as inscrições',
   base_document: { title: 'Edital original', sha256: 'base-sha' },
   amendment_document: { title: 'Retificação 01', url: 'https://example.invalid/retificacao.pdf', sha256: 'amendment-sha' },
   changes: { inscricao_fim: { field_name: 'inscricao_fim', previous: '2026-09-20', new: '2026-09-27', reason: 'Novo prazo no PDF', provenance: [{ sha256: 'amendment-sha', page: 3, snippet: 'Inscrições prorrogadas até 27/09' }] } },
   periods: { original: { start: '2026-09-01', end: '2026-09-20' }, current: { start: '2026-09-01', end: '2026-09-27' }, reopenings: [] },
   events: [{ kind: 'publication', local_time: { date: '2026-09-05', start_time: '10:00', timezone: null } }],
   authorization: { actor: 'operador.fixture' }, approved_fields: [], approved_by: null, approved_at: null, result: null,
 };
 await act(async () => { screen = create(React.createElement(exportsObject.PublicationReview, { styles: {}, run, onEvidence: page => calls.push(['evidence',page]) })); });
 await click('Conferir identidade');
 assert.match(text(screen.toJSON()), /Retificação do concurso 42/);
 assert.match(text(screen.toJSON()), /Retificação oficial prorrogou/);
 assert.match(text(screen.toJSON()), /Documento retificador/);
 assert.match(text(screen.toJSON()), /Inscrições prorrogadas até 27\/09/);
 assert.match(text(screen.toJSON()), /10:00/);
 const amendmentCheck = screen.root.findAllByType('Pressable').find(n => n.props.accessibilityRole === 'checkbox');
 await act(async () => amendmentCheck.props.onPress());
 assert.ok(button('Aprovar os 1 campos da retificação'));
 await click('Aprovar os 1 campos da retificação');
 assert.match(text(screen.toJSON()), /Aplicar irá aplicar a retificação/);
 await act(async () => screen.unmount());
 await act(async () => { screen = create(React.createElement(exportsObject.ContinuousReview, { styles: {} })); });
 assert.match(text(screen.toJSON()), /Cobertura parcial/);
 assert.match(text(screen.toJSON()), /Limite de concursos/);
 assert.match(text(screen.toJSON()), /bytes documentais não verificados/);
 assert.match(text(screen.toJSON()), /não está pronta para publicação/);
 assert.match(text(screen.toJSON()), /navegador suspensa/);
 assert.ok(button('Revisar observação'));
 await act(async () => screen.unmount());
 console.log('PASS: create consequences/evidence, required fields, approval, 409 refresh, stale guard, audited archive rollback, new documents block old approval');
})().catch(error => { console.error(error); process.exitCode=1; });
