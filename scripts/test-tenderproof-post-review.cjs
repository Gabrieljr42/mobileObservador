/* Synthetic UI responses; authenticated artifact authorization is tested in backend. */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const React = require('react');
const { create, act } = require('react-test-renderer');
global.IS_REACT_ACT_ENVIRONMENT = true;
const calls = [];
const page = 'https://example.invalid/official/notice';
let proposal = { id:'post-fixture', state:'proposed', action:'update', concurso_id:1, identity:{detail_url:page},
  eligible_fields:[], required_fields:[], blockers:[], blocked_fields:{}, evidences:{}, baseline:{values:{}}, proposed:{},
  document_access:{ mode:'preserved_pdf', official_page_url:page, artifact_download_path:'/tenderproof/runs/fixture/artifacts/pdf', requires_authentication:true } };
const api = { getTenderProofDocumentReview:async () => ({pending:false,documents:[]}), createTenderProofProposal:async () => proposal };
const compiled = ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src/components/TenderProofReview.tsx'),'utf8'),
  {compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const exportsObject = {};
const native = {...Object.fromEntries(['View','Text','TextInput','Pressable','ActivityIndicator'].map(n=>[n,n])),
  Linking:{openURL:async url => calls.push(['official',url])}};
vm.runInNewContext(compiled,{exports:exportsObject,require:name=>name==='react-native'?native:name==='expo-router'?{useRouter:()=>({})}:name==='../api/tenderproof'?api:require(name),console});
const text=node=>typeof node==='string'?node:(node.children||[]).map(text).join('');
(async()=>{
 for (const action of ['update','create']) {
  proposal={...proposal,action,creation_metadata:action==='create'?{banca:'Fixture',link_edital:page}:null};
  let screen;
  await act(async()=>{screen=create(React.createElement(exportsObject.PublicationReview,{styles:{},run:{run_id:'fixture',candidates:[]},onEvidence:p=>calls.push(['authenticated-pdf',p])}));});
  const click=async label=>{const node=screen.root.findAllByType('Pressable').find(n=>text(n).includes(label));assert.ok(node,label);await act(async()=>node.props.onPress());};
  await click('Conferir identidade');
  await click('Conferir e baixar PDF autenticado');
  await click('Abrir página oficial do edital');
  assert.deepEqual(calls.slice(-2),[['authenticated-pdf',1],['official',page]]);
  assert.doesNotMatch(text(screen.toJSON()),/exportarEditalPdf/);
  if(action==='create')assert.match(text(screen.toJSON()),/Página oficial que será vinculada/);
  await act(async()=>screen.unmount());
 }
 console.log('PASS: POST create/update review uses authenticated PDF handler and official page, never endpoint GET');
})().catch(error=>{console.error(error);process.exitCode=1;});
