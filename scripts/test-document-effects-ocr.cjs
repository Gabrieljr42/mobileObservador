/* Synthetic review responses: verify OCR labels and explicit review controls. */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const React = require('react');
const {create,act} = require('react-test-renderer');
global.IS_REACT_ACT_ENVIRONMENT = true;
const text = node => typeof node === 'string' ? node : (node?.children || []).map(text).join('');
const compile = filename => ts.transpileModule(fs.readFileSync(path.join(__dirname,filename),'utf8'),
  {compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const utils = {};
vm.runInNewContext(compile('../src/utils/registrationLists.ts'),{exports:utils,require});
const native = Object.fromEntries(['View','Text','TextInput','Pressable','ActivityIndicator'].map(n=>[n,n]));
const fixture = {id:'synthetic',documents:[{document:{title:'Diário oficial',url:'https://example.invalid/doc.pdf'},
  artifact:{sha256:'a'.repeat(64)},ocr_review_required:true,fields:[],
  scope:{classification:'research_scholarship',reason:'Bolsa sem vínculo empregatício.',review_required:true,
    evidence:[{page_number:1,snippet:'Chamada pública de bolsas',document_sha256:'a'.repeat(64),extraction_method:'ocr_tesseract'}]},pages:[
    {page_number:1,text:'Texto reconhecido em colunas para conferência.',extraction_method:'ocr_tesseract',extractor_version:'tenderproof-ocr-v1'},
    {page_number:2,text:'Texto nativo.',extraction_method:'pdf_text'}]}]};
let approvals=0;
const region={id:'ocr-region-'+'b'.repeat(64),document_sha256:'a'.repeat(64),page_number:1,
  text:'Inscrições FACEPE\n16/08/2024 30/08/2024',bounds:[0,0,5000,10000],word_indices:[3,0,1],
  boundary_words_excluded:1,method_version:'tenderproof-ocr-region/1',review_required:true,preview_fields:[],
  preview_role_details:{method_version:'fixture',review_required:true,nome:'Enfermeiro',remuneracao:'6780.90',moeda:'BRL',
    requisitos:'Diploma em Enfermagem e registro no conselho.',jornada:'36 horas semanais',association_status:'matched'},
  preview_vacancies:{method_version:'fixture',review_required:true,total_vagas:7,total_pcd:1,notice:'Salários e requisitos pendentes.',
    rows:[{nome:'Enfermeiro',cidade:'Olinda',jornada:'36 horas semanais',vagas_imediatas:5,vagas_ampla_concorrencia:4,vagas_pcd:1},
      {nome:'Técnico Laboratorial',cidade:'Olinda',jornada:'20 horas semanais',vagas_imediatas:2,vagas_ampla_concorrencia:2,vagas_pcd:null}]},
  preview_effects:[{kind:'registration_reopening',scope:{name:'Analista em Comércio Exterior',exclusive:true},
    act:{issuer:'SAD/FACEPE',number:'121',date:'2024-08-15'},original_act:{number:'104',date:'2024-07-23'},
    annulled_period:{start:'2024-07-29',end:'2024-08-12'},new_period:{start:'2024-08-16',end:'2024-08-30',end_time:'23:59'}}]};
const api={currentDocumentEffects:async()=>fixture,approveDocumentEffects:async()=>{approvals++;},
  compareRegistrationTargets:async()=>({status:'missing_contest',message:'Este concurso ainda não possui cadastro correspondente no catálogo.',published:false,review_required:true}),
  prepareOCRRegion:async(...args)=>{assert.deepEqual(Array.from(args[4]),[0,0,5000,10000]);return region;}};
const regionExports={};
vm.runInNewContext(compile('../src/components/OCRRegionReview.tsx'),{exports:regionExports,console,
  require:n=>n==='react-native'?native:n==='../api/tenderproof'?api:require(n)});
const exportsObject={};
vm.runInNewContext(compile('../src/components/DocumentEffectReview.tsx'),{exports:exportsObject,console,
  require:n=>n==='react-native'?native:n==='expo-router'?{useRouter:()=>({})}:n==='../api/tenderproof'?api:n==='../utils/registrationLists'?utils:n==='./OCRRegionReview'?regionExports:require(n)});
(async()=>{
  let screen;
  await act(async()=>{screen=create(React.createElement(exportsObject.DocumentEffectReview,{runId:'fixture',styles:{},onApproved:async()=>{}}));});
  assert.match(text(screen.toJSON()),/Página física 1 de 2 · texto reconhecido por OCR/);
  assert.match(text(screen.toJSON()),/misturar colunas e atos diferentes/);
  assert.match(text(screen.toJSON()),/extração automática de campos dessas páginas continua pendente/);
  const buttons=()=>screen.root.findAllByType('Pressable');
  assert.ok(buttons().find(n=>text(n).includes('Registrar revisão')).props.disabled);
  await act(async()=>buttons().find(n=>text(n).includes('Conferir região do OCR')).props.onPress());
  assert.match(text(screen.toJSON()),/Inscrições FACEPE/);
  assert.match(text(screen.toJSON()),/palavras cortadas pelo limite foram excluídas/);
  assert.match(text(screen.toJSON()),/Exclusivamente para Analista em Comércio Exterior/);
  assert.match(text(screen.toJSON()),/Inscrições anteriores anuladas: de 29\/07\/2024 a 12\/08\/2024/);
  assert.match(text(screen.toJSON()),/Novo período: de 16\/08\/2024 a 30\/08\/2024, até 23:59/);
  assert.match(text(screen.toJSON()),/não define o prazo dos demais cargos/);
  assert.match(text(screen.toJSON()),/2 funções · 7 vagas no total, incluindo 1/);
  assert.match(text(screen.toJSON()),/Olinda · 36 horas semanais/);
  assert.match(text(screen.toJSON()),/pessoas com deficiência: conferência pendente/);
  assert.match(text(screen.toJSON()),/Ela não indica cadastro de reserva/);
  assert.match(text(screen.toJSON()),/Remuneração e requisitos · Enfermeiro/);
  assert.match(text(screen.toJSON()),/6\.780,90/);
  assert.match(text(screen.toJSON()),/Nome e jornada correspondem à função no quadro de vagas/);
  await act(async()=>buttons().find(n=>text(n).includes('Conferir cargo no catálogo')).props.onPress());
  assert.match(text(screen.toJSON()),/ainda não possui cadastro correspondente no catálogo/);
  assert.match(text(screen.toJSON()),/Consulta sem alteração de dados/);
  await act(async()=>buttons().find(n=>text(n).includes('Usar esta região na decisão')).props.onPress());
  assert.match(text(screen.toJSON()),/A decisão usa um recorte OCR preservado/);
  assert.ok(buttons().find(n=>text(n).includes('Registrar revisão')).props.disabled);
  await act(async()=>buttons().find(n=>text(n).includes('Próxima página')).props.onPress());
  assert.match(text(screen.toJSON()),/Página física 2 de 2 · texto do PDF preservado/);
  assert.doesNotMatch(text(screen.toJSON()),/misturar colunas e atos diferentes/);
  assert.equal(approvals,0);
  assert.match(text(screen.toJSON()),/Natureza da seleção: bolsa de pesquisa/);
  assert.match(text(screen.toJSON()),/não aprova a revisão nem exclui outros editais/);
  await act(async()=>screen.unmount());
  console.log('PASS: OCR provenance labels, pending fields, physical pages and human approval gate');
})().catch(e=>{console.error(e);process.exitCode=1;});
