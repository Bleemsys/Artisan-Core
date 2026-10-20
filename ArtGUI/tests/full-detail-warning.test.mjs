import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {admitFullDetail} from '../ui/preview-policy.mjs';

const source=readFileSync(new URL('../ui/app.js',import.meta.url),'utf8');
const warning=source.slice(source.indexOf('  function fullDetailWarning('),source.indexOf('  function pauseFullDetailMemory('));
// Exercise the actual admission and retry code, stopping before mesh allocation.
const loader=source.slice(source.indexOf('  async function loadPreview('),source.indexOf('    const request=++previewRequest;'))+
  "    started.push({path,mode,layerId,skipResourceCheck});\n  }";
function setup(){
  const elements=new Map();let checks=0,closed=0,html='';
  const context=vm.createContext({admitFullDetail,viewerReady:Promise.resolve(),viewer:{geometryBytes:()=>0},
    previewRequest:7,checkingFullDetail:false,cleaningScratch:false,currentPath:null,started:[],
    invoke:async()=>{checks++;return {allowed:false,reason:'Graphics budget exceeded. Continue using Preview.'};},
    esc:s=>String(s).replaceAll('<','&lt;'),
    $:id=>{if(!elements.has(id))elements.set(id,{focus(){this.focused=true;}});return elements.get(id);},
    showModal:s=>{html=s;},closeModal:()=>{closed++;},toast:()=>assert.fail('unexpected toast')});
  vm.runInContext(warning+loader,context);
  return {context,elements,get html(){return html;},get checks(){return checks;},get closed(){return closed;}};
}
test('resource warning offers both choices and defaults focus to preview',async()=>{
  const s=setup();await s.context.loadPreview('large.obj','full','result');
  assert.match(s.html,/>Continue in preview</);assert.match(s.html,/>Load full geometry</);
  assert.match(s.html,/could make the viewer unresponsive/);
  assert.doesNotMatch(s.html,/Continue using Preview\./);
  assert.equal(s.elements.get('continue-preview').focused,true);
  assert.equal(s.context.started.length,0);
  s.context.closeModal();assert.equal(s.context.started.length,0);
});
test('explicit load retries the same model once without repeating the resource check',async()=>{
  const s=setup();await s.context.loadPreview('large.obj','full','result');
  s.elements.get('load-full-geometry').onclick();await new Promise(setImmediate);
  assert.equal(s.closed,1);assert.equal(s.checks,1);assert.equal(s.context.started.length,1);
  assert.deepEqual(JSON.parse(JSON.stringify(s.context.started[0])),{path:'large.obj',mode:'full',layerId:'result',skipResourceCheck:true});
});
test('a stale warning cannot load geometry after another preview request',async()=>{
  const s=setup();await s.context.loadPreview('old.obj','full','source');
  s.context.previewRequest++;s.elements.get('load-full-geometry').onclick();await new Promise(setImmediate);
  assert.equal(s.context.started.length,0);
});
test('actual loading failures do not offer an endless retry override',()=>{
  const s=setup();s.context.fullDetailWarning('<upload failed>');
  assert.doesNotMatch(s.html,/id="load-full-geometry"/);
  assert.match(s.html,/&lt;upload failed>/);
});

test('streamed STL bypasses the fixed preflight budget in favor of runtime checks',async()=>{
 const s=setup();await s.context.loadPreview('large.stl','full','result');
 assert.equal(s.checks,0);assert.equal(s.context.started.length,1);assert.equal(s.html,'');
});

const pauseSource=source.slice(source.indexOf('  function pauseFullDetailMemory('),source.indexOf('  function cancelPreview('));
function pauseSetup(){
 const elements=new Map(),context=vm.createContext({previewRequest:7,modalCleanup:null,setPreviewProgress(){},esc:String,formatBytes:String,
  $:id=>{if(!elements.has(id))elements.set(id,{focus(){}});return elements.get(id);},showModal(){}});
 context.closeModal=()=>{context.modalCleanup?.();};vm.runInContext(pauseSource,context);return {context,elements};
}
test('paused-memory dialog resolves resume once, and closing chooses preview',async()=>{
 const {context,elements}=pauseSetup(),controller=new AbortController();
 const resumed=context.pauseFullDetailMemory({reason:'low memory',geometryBytes:42},7,controller.signal);
 elements.get('memory-continue-loading').onclick();assert.equal(await resumed,true);
 const cancelled=context.pauseFullDetailMemory({reason:'low memory',geometryBytes:42},7,controller.signal);
 context.closeModal();assert.equal(await cancelled,false);
});
test('cancelling the load closes a pending memory dialog',async()=>{
 const {context}=pauseSetup(),controller=new AbortController();
 const pending=context.pauseFullDetailMemory({reason:'low memory',geometryBytes:42},7,controller.signal);
 controller.abort();assert.equal(await pending,false);assert.equal(context.modalCleanup,null);
});
