const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');const vm=require('node:vm');const ts=require('typescript');
const React=require('react');const {act,create}=require('react-test-renderer');
global.IS_REACT_ACT_ENVIRONMENT=true;
test('storage failure remains recoverable without clearing remembered authentication',async()=>{
 let fail=true,current;let syncs=[];
 const storage={isSessionActive:async()=>true,getRememberedUser:async()=>({id:1,name:'Local'}),getStoredToken:async()=>null};
 const module={exports:{}};
 const source=fs.readFileSync(require.resolve('../src/providers/AuthProvider.tsx'),'utf8');
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,esModuleInterop:true}}).outputText;
 const requireMock=name=>{
  if(name==='react')return React;
  if(name==='react-native')return {Platform:{OS:'android'},AppState:{addEventListener:()=>({remove(){}})}};
  if(name==='axios')return {isAxiosError:()=>false};
  if(name==='../storage/auth')return storage;
  if(name==='../db/database')return {getDb:async()=>{if(fail)throw Error('locked')},setActiveUser:async()=>{}};
  if(name==='../db/repositories')return {localUser:{set:async()=>{}}};
  if(name==='../sync/background')return {registerBackgroundSyncAsync:async()=>false};
  if(name==='../sync/syncService')return {syncIfDue:async(force)=>{syncs.push(force)}};
  if(name==='../push/pushRegistration')return {registerPushNotifications:async()=>({status:'registered'}),revokePushNotifications:async()=>true};
  if(name==='../api/auth')return {};
  throw Error(name);
 };
 vm.runInNewContext(code,{module,exports:module.exports,require:requireMock,setInterval,clearInterval});
 const {AuthProvider,useAuth}=module.exports;
 function Child(){current=useAuth();return null;}
 let tree;
 await act(async()=>{tree=create(React.createElement(AuthProvider,null,React.createElement(Child)))});
 assert.ok(current.initializationError);assert.equal(current.isLoading,false);assert.equal(syncs.length,0);
 fail=false;
 await act(async()=>{await current.retryInitialization()});
 assert.equal(current.initializationError,null);assert.equal(current.user.id,1);assert.equal(current.isAuthenticated,true);assert.deepEqual(syncs,[true]);
 await act(async()=>tree.unmount());
});
