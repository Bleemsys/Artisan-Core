import test from 'node:test';
import assert from 'node:assert/strict';
import {openMeshCellEditor} from '../ui/mesh-cell-editor.js';
import {blankMeshDefinition,exampleFrameMesh,cellMeshObj} from '../ui/mesh-cell-model.js';
import {parseNumericJson,stringifyNumericJson} from '../ui/numeric-json.js';
let JSDOM;try{({JSDOM}=await import(process.env.ARTGUI_TEST_DOM||'jsdom'));}catch{}
const skip=!JSDOM?'Set ARTGUI_TEST_DOM for DOM checks':false;
const bytes=text=>new TextEncoder().encode(text).buffer;
async function fixture(options={}){
 const {deferLoad=false,...editorOptions}=options;
 const dom=new JSDOM('<button id="origin">Edit mesh cell</button>'),old={document:globalThis.document,window:globalThis.window,Option:globalThis.Option};Object.assign(globalThis,{document:dom.window.document,window:dom.window,Option:dom.window.Option});dom.window.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};dom.window.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};document.querySelector('#origin').focus();
 const applications=[],saved=[],views=[],calls={disposed:0};let callbacks;
 const editor=openMeshCellEditor({name:'CustomPlate',definition:blankMeshDefinition('Geom-Plate'),onApply:d=>applications.push(d),onSaveAsset:async p=>{saved.push(p);return'C:/cells/prepared.obj';},viewportFactory:c=>{callbacks=c;return{update:s=>views.push(s),fit(){},cancel(){callbacks.onCancelDrag();},dispose(){calls.disposed++;}};},...editorOptions});if(!deferLoad)await editor.loaded();await new Promise(r=>setTimeout(r,0));
 const q=s=>editor.dialog.querySelector(s),click=a=>q('[data-mc="'+a+'"]').click(),input=(selector,value,event='change')=>{q(selector).value=value;q(selector).dispatchEvent(new dom.window.Event(event,{bubbles:true}));};
 return{dom,editor,q,click,input,applications,saved,views,calls,callbacks,async flush(){await new Promise(r=>setTimeout(r,0));},close(){editor.close();dom.window.close();Object.assign(globalThis,old);}};
}
test('plate builder creates editable faces and saves an engine-compatible mesh reference only on Apply',{skip},async()=>{
 const f=await fixture();try{assert.equal(f.q('[data-mc="apply"]').disabled,true);f.click('add-preset');f.input('[data-new-plane]','XZ');f.click('add-preset');f.input('[data-new-plane]','YZ');f.click('add-preset');assert.equal(f.editor.getMesh().faces.length,3);assert.equal(f.saved.length,0);assert.equal(f.q('[data-mc="apply"]').disabled,false);f.click('apply');await f.flush();assert.equal(f.saved.length,1);assert.equal(f.saved[0].faces.length,3);assert.equal(f.saved[0].kind,'Geom-Plate');assert.deepEqual(f.applications[0].definition,{type:'Geom-Plate',definition:{file:'C:/cells/prepared.obj',ladomain:'Hex'}});assert.equal(f.editor.dialog.isConnected,false);assert.equal(f.calls.disposed,1);}finally{f.close();}
});
test('face dragging is one undo action and range edits, reverse normal and deletion restore correctly',{skip},async()=>{
 const f=await fixture();try{f.click('add-preset');const before=f.editor.getMesh();f.callbacks.onBeginDrag();f.callbacks.onDrag({kind:'vertex',index:0,position:[.1,0,.5]});f.callbacks.onDrag({kind:'vertex',index:0,position:[.2,0,.5]});f.callbacks.onCommitDrag();assert.equal(f.editor.getMesh().vertices[0][0],.2);f.click('undo');assert.deepEqual(f.editor.getMesh(),before);f.click('redo');assert.equal(f.editor.getMesh().vertices[0][0],.2);f.callbacks.onBeginDrag();f.callbacks.onDrag({kind:'vertex',index:0,position:[.3,0,.5]});f.callbacks.onCancelDrag();assert.equal(f.editor.getMesh().vertices[0][0],.2);
  f.input('[data-face-position]','.7','input');f.input('[data-face-position]','.8','input');f.input('[data-face-position]','.8');assert.equal(f.editor.getMesh().vertices[0][2],.8);f.click('undo');assert.equal(f.editor.getMesh().vertices[0][2],.5);const order=f.editor.getMesh().faces[0].indices;f.click('reverse');assert.deepEqual(f.editor.getMesh().faces[0].indices,[...order].reverse());f.click('delete-face');assert.equal(f.editor.getMesh().faces.length,0);f.click('undo');assert.equal(f.editor.getMesh().faces.length,1);
 }finally{f.close();}
});
test('domain/type switching preserves the mesh and blocks Geometry or Tet when its requirements fail',{skip},async()=>{
 const f=await fixture();try{f.click('add-preset');const before=f.editor.getMesh();f.click('type-solid');assert.equal(f.q('[data-mc="apply"]').disabled,true);assert.match(f.q('[data-validation]').textContent,/closed/);f.click('undo');assert.equal(f.q('[data-mc="apply"]').disabled,false);f.input('[data-domain]','Tet');assert.deepEqual(f.editor.getMesh(),before);assert.equal(f.q('[data-mc="apply"]').disabled,true);f.click('normalize');assert.equal(f.q('[data-mc="apply"]').disabled,false);f.click('apply');await f.flush();assert.equal(f.applications[0].definition.definition.ladomain,'Tet');}finally{f.close();}
});
test('existing sources retain relative file paths, extra properties and number tokens when applied unchanged',{skip},async()=>{
 const definition=parseNumericJson('{"type":"Geom","extra":1.00,"definition":{"file":"cells/frame.obj","ladomain":"Hex","custom":2.00}}');const f=await fixture({definition,onLoadMesh:async()=>({path:'C:/project/cells/frame.obj',name:'frame.obj',buffer:bytes(cellMeshObj(exampleFrameMesh()))})});try{assert.deepEqual(f.editor.getState().analysis.errors,[]);f.click('apply');await f.flush();assert.equal(f.saved.length,0);assert.equal(stringifyNumericJson(f.applications[0].definition),stringifyNumericJson(definition));}finally{f.close();}
});
test('failed imports preserve the draft and Cancel writes no prepared assets',{skip},async()=>{
 const f=await fixture({onImportMesh:async()=>({name:'bad.obj',buffer:bytes('v 0 0 0\nf 1 2 3')})});try{f.click('add-preset');const before=f.editor.getMesh();f.click('import');await f.flush();await f.editor.loaded();assert.deepEqual(f.editor.getMesh(),before);assert.match(f.q('[data-status]').textContent,/missing vertex/);f.click('cancel');assert.equal(f.q('[data-discard]').hidden,false);f.click('discard');assert.equal(f.editor.dialog.isConnected,false);assert.equal(f.saved.length,0);assert.equal(f.applications.length,0);}finally{f.close();}
});
test('saving cancellation retains the draft; name conflicts are checked before writing an asset',{skip},async()=>{
 let attempts=0;const f=await fixture({validateName:n=>n==='Taken'?'Name already used.':'',onSaveAsset:async()=>++attempts===1?null:'C:/cells/new.obj'});try{f.click('add-preset');f.input('[data-name]','Taken');f.click('apply');await f.flush();assert.equal(attempts,0);f.input('[data-name]','Available');f.click('apply');await f.flush();assert.equal(f.editor.dialog.isConnected,true);assert.equal(f.applications.length,0);assert.match(f.q('[data-status]').textContent,/cancelled/);f.click('apply');await f.flush();assert.equal(f.applications[0].name,'Available');}finally{f.close();}
});
test('the save transaction blocks cancellation and commits only after the mesh is saved',{skip},async()=>{
 let finish;const f=await fixture({onSaveAsset:()=>new Promise(resolve=>finish=resolve)});try{f.click('add-preset');f.click('apply');await f.flush();assert.equal(f.q('[data-mc="cancel"]').disabled,true);document.dispatchEvent(new f.dom.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));assert.equal(f.editor.dialog.isConnected,true);assert.equal(f.applications.length,0);finish('C:/cells/saved.obj');await f.flush();assert.equal(f.applications[0].definition.definition.file,'C:/cells/saved.obj');}finally{f.close();}
});
test('late initial source loads cannot revive a closed editor',{skip},async()=>{
 let finish;const pending=new Promise(resolve=>finish=resolve);const definition=blankMeshDefinition('Geom');definition.definition.file='frame.obj';const f=await fixture({definition,deferLoad:true,onLoadMesh:()=>pending});try{f.editor.close();finish({buffer:bytes(cellMeshObj(exampleFrameMesh())),name:'frame.obj'});await f.flush();assert.equal(f.editor.dialog.isConnected,false);assert.equal(f.editor.getMesh().faces.length,0);assert.equal(f.applications.length,0);}finally{f.close();}
});
