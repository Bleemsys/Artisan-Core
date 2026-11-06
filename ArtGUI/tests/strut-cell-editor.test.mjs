import test from 'node:test';
import assert from 'node:assert/strict';
import {openStrutCellEditor} from '../ui/strut-cell-editor.js';
import {blankStrutDefinition} from '../ui/strut-cell-model.js';
import {stringifyNumericJson,parseNumericJson} from '../ui/numeric-json.js';
let JSDOM;try{({JSDOM}=await import(process.env.ARTGUI_TEST_DOM||'jsdom'));}catch{}
const skip=!JSDOM?'Set ARTGUI_TEST_DOM for DOM checks':false;
async function fixture(options={}){
 const dom=new JSDOM('<button id="origin">Edit cell</button>'),old={document:globalThis.document,window:globalThis.window,Option:globalThis.Option};Object.assign(globalThis,{document:dom.window.document,window:dom.window,Option:dom.window.Option});
 dom.window.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};dom.window.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};
 const applications=[],calls={disposed:0};let callbacks;document.querySelector('#origin').focus();
 const editor=openStrutCellEditor({name:'CustomCell',definition:blankStrutDefinition(),onApply:d=>applications.push(d),viewportFactory:c=>{callbacks=c;return{update(){},fit(){},cancel(){callbacks.onCancelDrag();},dispose(){calls.disposed++;}};},...options});await new Promise(r=>setTimeout(r,0));
 const q=s=>editor.dialog.querySelector(s),click=id=>q(`[data-sc="${id}"]`).click(),input=(key,value)=>{q(key).value=value;q(key).dispatchEvent(new dom.window.Event('change',{bubbles:true}));};
 return{dom,editor,q,click,input,applications,calls,callbacks,close(){editor.close();dom.window.close();Object.assign(globalThis,old);}};
}
test('new-cell cancel discards the draft and never calls the project writer',{skip},async()=>{
 const f=await fixture();try{f.click('corners');f.click('cancel');assert.equal(f.q('[data-discard]').hidden,false);assert.deepEqual(f.applications,[]);f.click('keep');assert.equal(f.q('[data-discard]').hidden,true);f.click('cancel');f.click('discard');assert.equal(f.editor.dialog.isConnected,false);assert.equal(document.activeElement.id,'origin');assert.equal(f.calls.disposed,1);}finally{f.close();}
});
test('creates a hub cell, edits a coordinate and applies only engine-compatible definition data',{skip},async()=>{
 const f=await fixture();try{f.click('apply');assert.match(f.q('[data-status]').textContent,/two nodes/);f.click('corners');f.click('centre');f.click('hub');f.input('[data-coordinate="2"]','.65');f.click('update-node');f.click('apply');assert.equal(f.applications.length,1);const result=f.applications[0];assert.equal(result.name,'CustomCell');assert.deepEqual(Object.keys(result.definition).sort(),['definition','type']);assert.equal(result.definition.definition.pts.length,9);assert.equal(result.definition.definition.cnnt.length,8);assert.equal(result.definition.definition.pts[8][2],.65);assert.equal(f.editor.dialog.isConnected,false);}finally{f.close();}
});
test('one drag is one undo action and cancellation restores the original coordinates',{skip},async()=>{
 const f=await fixture();try{f.click('corners');f.click('centre');const before=f.editor.getDraft();f.callbacks.onSelect({kind:'node',id:9});f.callbacks.onBeginDrag();f.callbacks.onDrag(9,[.5,.5,.6]);f.callbacks.onDrag(9,[.5,.5,.8]);f.callbacks.onCommitDrag();assert.equal(f.editor.getDraft().definition.definition.pts[8][2],.8);f.click('undo');assert.deepEqual(f.editor.getDraft(),before);f.click('redo');assert.equal(f.editor.getDraft().definition.definition.pts[8][2],.8);f.callbacks.onBeginDrag();f.callbacks.onDrag(9,[.5,.5,.2]);f.callbacks.onCancelDrag();assert.equal(f.editor.getDraft().definition.definition.pts[8][2],.8);}finally{f.close();}
});
test('imports preserve extras and numeric tokens; failed imports preserve the current draft',{skip},async()=>{
 const raw='{"type":"strut","extra":"keep","definition":{"pts":[[0.0,0.0,0.0],[1.00,1e0,1.0]],"cnnt":[[0,1]],"ladomain":"Hex","custom":5.00}}';
 const f=await fixture();try{f.click('json');f.q('[data-json-text]').value=raw;f.click('import-json');assert.equal(stringifyNumericJson(f.editor.getDraft().definition),stringifyNumericJson(parseNumericJson(raw)));const before=f.editor.getDraft();f.click('json');f.q('[data-json-text]').value='{"type":"strut"}';f.click('import-json');assert.deepEqual(f.editor.getDraft(),before);assert.equal(f.q('[data-json]').hidden,false);f.click('undo');assert.equal(f.editor.getDraft().definition.definition.pts.length,0);}finally{f.close();}
});
test('rename validation and save shortcut protect the unapplied draft',{skip},async()=>{
 const f=await fixture({validateName:n=>n==='Taken'?'Name already used.':''});try{f.click('corners');f.click('centre');f.click('hub');f.input('[data-name]','Taken');f.click('apply');assert.equal(f.applications.length,0);assert.match(f.q('[data-status]').textContent,/already used/);let bubbled=false;document.addEventListener('keydown',()=>bubbled=true);f.q('[data-name]').dispatchEvent(new f.dom.window.KeyboardEvent('keydown',{key:'s',ctrlKey:true,bubbles:true,cancelable:true}));assert.equal(bubbled,false);assert.match(f.q('[data-status]').textContent,/before saving/);}finally{f.close();}
});
test('reconnect by picking a node changes only the selected edge',{skip},async()=>{
 const f=await fixture();try{f.click('corners');f.callbacks.onConnect(1,2);f.callbacks.onConnectionClick(1);f.click('pick-end');f.callbacks.onNodeClick(3);assert.deepEqual(f.editor.getDraft().definition.definition.cnnt,[[0,2]]);f.click('undo');assert.deepEqual(f.editor.getDraft().definition.definition.cnnt,[[0,1]]);}finally{f.close();}
});

test('Tet setup offers four corners and the tetrahedron centre, enforces its limits and applies the selected domain',{skip},async()=>{
 const f=await fixture();try{f.input('[data-domain]','Tet');assert.equal(f.editor.getDraft().definition.definition.ladomain,'Tet');assert.deepEqual([...f.editor.dialog.querySelectorAll('[data-coordinate]')].map(el=>Number(el.value)),[.25,.25,.25]);assert.equal(f.q('[data-sc="neighbours"]').disabled,true);assert.match(f.q('[data-domain-help]').textContent,/X \+ Y \+ Z ≤ 1/);
  f.click('corners');f.click('centre');f.click('hub');assert.equal(f.editor.getDraft().definition.definition.pts.length,5);assert.equal(f.editor.getDraft().definition.definition.cnnt.length,4);
  for(const axis of ['0','1','2'])f.input('[data-coordinate="'+axis+'"]','.6');const before=f.editor.getDraft();f.click('update-node');assert.deepEqual(f.editor.getDraft(),before);assert.match(f.q('[data-status]').textContent,/X \+ Y \+ Z/);
  f.click('apply');assert.equal(f.applications[0].definition.definition.ladomain,'Tet');assert.deepEqual(f.applications[0].definition.definition.pts[4],[.25,.25,.25]);
 }finally{f.close();}
});

test('domain switching preserves the draft, flags outside nodes, supports Undo/Redo and allows repair',{skip},async()=>{
 const definition={type:'strut',definition:{pts:[[0,0,0],[.5,.5,.5]],cnnt:[[0,1]],ladomain:'Hex'}};const f=await fixture({definition});try{
  f.input('[data-domain]','Tet');const draft=f.editor.getDraft();assert.deepEqual(draft.definition.definition.pts,definition.definition.pts);assert.deepEqual(draft.definition.definition.cnnt,[[0,1]]);assert.equal(f.q('[data-sc="apply"]').disabled,true);assert.equal(f.editor.dialog.querySelectorAll('.sc-invalid').length,1);assert.equal(f.q('[data-domain-issue]').hidden,false);
  f.click('undo');assert.equal(f.q('[data-domain]').value,'Hex');assert.equal(f.q('[data-sc="apply"]').disabled,false);f.click('redo');assert.equal(f.q('[data-domain]').value,'Tet');
  f.q('[data-node-select="2"]').click();for(const axis of ['0','1','2'])f.input('[data-coordinate="'+axis+'"]','.25');f.click('update-node');assert.equal(f.q('[data-domain-issue]').hidden,true);assert.equal(f.q('[data-sc="apply"]').disabled,false);f.click('apply');assert.deepEqual(f.applications[0].definition.definition.cnnt,[[0,1]]);
 }finally{f.close();}
});

test('Tet JSON imports select the matching domain and preserve extra fields and numeric spelling',{skip},async()=>{
 const raw='{"type":"strut","meta":2.00,"definition":{"pts":[[0.0,0.0,0.0],[0.25,0.25,0.25]],"cnnt":[[0,1]],"ladomain":"Tet","custom":5.00}}';const f=await fixture();try{
  f.click('json');f.q('[data-json-text]').value=raw;f.click('import-json');assert.equal(f.q('[data-domain]').value,'Tet');assert.equal(stringifyNumericJson(f.editor.getDraft().definition),stringifyNumericJson(parseNumericJson(raw)));f.click('apply');assert.equal(f.applications[0].definition.definition.ladomain,'Tet');
 }finally{f.close();}
});
