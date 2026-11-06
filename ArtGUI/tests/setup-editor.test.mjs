import test from 'node:test';
import assert from 'node:assert/strict';
import {createSetupEditor} from '../ui/setup-editor.js';
import {parseNumericJson,stringifyNumericJson} from '../ui/numeric-json.js';
let JSDOM;try{({JSDOM}=await import(process.env.ARTGUI_TEST_DOM||'jsdom'));}catch{}
const skip=!JSDOM?'Set ARTGUI_TEST_DOM to run DOM integration checks':false;
const initial=()=>parseNumericJson('{"Type":"Sample","Sample":{"Shape":"Box","Domain":[[-5.0,5.0],[-5.0,5.0],[-5.0,5.0]]},"Geomfile":"part.stl","Rot":[0.0,0.0,0.0],"res":[0.2,0.2,0.2],"Padding":1,"onGPU":false,"memorylimit":1073741824,"JsonWorkDir":true,"extra":"keep"}');
function fixture(s=initial()){
 const dom=new JSDOM('<div id="host"></div><div id="viewport-empty"></div>');const saved={document:globalThis.document};globalThis.document=dom.window.document;
 const host=document.getElementById('host'),post={CombineMeshes:true,CleanExportedMesh:false,RemovePartitionMeshFile:false,RemoveIsolatedParts:false,ExportLazPts:false,extra:7},errors=[],updates=[];
 const editor=createSetupEditor({getViewer:()=>null,getMeshBounds:()=>[[0,10],[0,20],[0,30]],onChange(){},browseMesh:async()=>null,loadMesh:async()=>{},toast:e=>errors.push(e)});
 editor.attachOverlay({update:(...args)=>updates.push(args),hide(){},frame(){updates.push('fit');}});editor.show(host,s,post);
 const q=sel=>host.querySelector(sel),change=(sel,value)=>{const el=q(sel);el.value=value;el.dispatchEvent(new dom.window.Event('change',{bubbles:true}));};
 return {s,post,host,q,change,editor,errors,updates,close(){editor.hide();dom.window.close();Object.assign(globalThis,saved);}};
}
test('numeric bounds and viewport geometry are synchronized; cancel and undo restore exact JSON',{skip},()=>{
 const f=fixture();try{const before=stringifyNumericJson(f.s);f.change('[data-setup-bound="0.1"]','7.5');assert.equal(f.s.Sample.Domain[0][1],7.5);assert.equal(f.updates.at(-1)[0].size[0],12.5);
 f.q('[data-setup-undo]').click();assert.equal(stringifyNumericJson(f.s),before);
 f.editor.drag({center:[2,3,4],size:[10,12,14]});assert.deepEqual(f.s.Sample.Domain,[[-3,7],[-3,9],[-3,11]]);f.editor.cancel();assert.equal(stringifyNumericJson(f.s),before);
 f.editor.drag({center:[2,3,4],size:[10,12,14]});f.editor.commit();f.q('[data-setup-undo]').click();assert.equal(stringifyNumericJson(f.s),before);
 assert.equal(f.s.extra,'keep');assert.equal(f.post.extra,7);
 }finally{f.close();}
});
test('linked sampling edits affect all axes; independent edits and invalid bounds behave correctly',{skip},()=>{
 const f=fixture();try{f.change('[data-setup-number="res.0"]','0.5');assert.deepEqual(f.s.res,[.5,.5,.5]);f.q('[data-setup-link]').click();f.change('[data-setup-number="res.1"]','0.75');assert.deepEqual(f.s.res,[.5,.75,.5]);
 f.change('[data-setup-bound="0.0"]','9');assert.equal(f.s.Sample.Domain[0][0],-5);assert.ok(f.errors.length);
 f.change('[data-setup-number="Padding"]','1.5');assert.equal(f.s.Padding,1);f.change('[data-setup-number="res.0"]','0');assert.equal(f.s.res[0],.5);
 }finally{f.close();}
});
test('Mesh mode is read-only and retains source paths, custom folders and existing flags',{skip},()=>{
 const f=fixture();try{const domain=stringifyNumericJson(f.s.Sample.Domain);f.q('[data-setup-source="Geometry"]').click();assert.equal(f.host.querySelectorAll('[data-setup-bound]').length,0);assert.equal(f.updates.at(-1)[1].editable,false);
 f.editor.drag({center:[9,9,9],size:[10,10,10]});assert.equal(stringifyNumericJson(f.s.Sample.Domain),domain);
 f.q('[data-setup-source="Sample"]').click();assert.equal(f.s.Geomfile,'part.stl');assert.equal(stringifyNumericJson(f.s.Sample.Domain),domain);
 f.q('[data-setup-number="memorylimit"]').focus();f.host.scrollTop=300;f.change('[data-setup-number="memorylimit"]','1.5');assert.equal(f.s.memorylimit,1610612736);assert.equal(document.activeElement,f.q('[data-setup-number="memorylimit"]'));assert.equal(f.host.scrollTop,300);f.change('[data-setup-path-mode]','custom');f.change('[data-setup-workdir]','C:/project/work');assert.equal(f.s.JsonWorkDir,'C:/project/work');
 const input=f.q('[data-setup-post="CleanExportedMesh"]');input.checked=true;input.dispatchEvent(new input.ownerDocument.defaultView.Event('change'));assert.equal(f.post.CleanExportedMesh,true);assert.equal(f.post.extra,7);
 }finally{f.close();}
});
test('leaving Project Settings clears the keyboard handler before the inspector is reused',{skip},()=>{
 const f=fixture();try{assert.equal(typeof f.host.onkeydown,'function');f.editor.hide();assert.equal(f.host.onkeydown,null);f.host.innerHTML='<input type="number">';f.host.querySelector('input').dispatchEvent(new f.host.ownerDocument.defaultView.KeyboardEvent('keydown',{key:'Tab',bubbles:true}));}finally{f.close();}
});

test('checked domain guides remain visible without editing controls outside Project Settings',{skip},()=>{
 const f=fixture();try{
  const before=stringifyNumericJson(f.s),frames=f.updates.filter(x=>x==='fit').length;
  f.editor.showGuides(f.s,f.post);
  assert.equal(f.host.onkeydown,null);assert.equal(f.updates.at(-1)[1].visible,true);assert.equal(f.updates.at(-1)[1].passive,true);assert.equal(f.updates.at(-1)[1].editable,false);
  f.host.innerHTML='<p>Another property panel</p>';f.editor.refresh();assert.equal(f.host.textContent,'Another property panel');
  f.editor.drag({center:[99,99,99],size:[20,20,20]});assert.equal(stringifyNumericJson(f.s),before);
  f.s.Sample.Domain[0][1]=15;f.editor.refresh();assert.equal(f.updates.at(-1)[0].size[0],20);
  assert.equal(f.updates.filter(x=>x==='fit').length,frames);
  f.editor.show(f.host,f.s,f.post);assert.equal(f.updates.at(-1)[1].editable,true);assert.equal(f.updates.at(-1)[1].passive,false);assert.equal(f.q('[data-setup-guides]').checked,true);
  const checkbox=f.q('[data-setup-guides]');checkbox.checked=false;checkbox.dispatchEvent(new f.host.ownerDocument.defaultView.Event('change'));
  f.editor.showGuides(f.s,f.post);f.editor.refresh();assert.equal(f.updates.at(-1)[1].visible,false);
  f.editor.show(f.host,f.s,f.post);assert.equal(f.q('[data-setup-guides]').checked,false);
 }finally{f.close();}
});

test('generation keeps domain guides visible and switching workflows binds the new domain',{skip},()=>{
 const f=fixture();try{
  f.editor.suspend(true);assert.equal(f.updates.at(-1)[1].visible,true);assert.equal(f.updates.at(-1)[1].passive,true);
  f.editor.suspend(false);assert.equal(f.updates.at(-1)[1].editable,true);
  const next=initial();next.Sample.Domain=[[100,120],[200,240],[300,360]];
  f.editor.showGuides(next,f.post);assert.deepEqual(f.updates.at(-1)[0].center,[110,220,330]);assert.equal(f.updates.at(-1)[1].passive,true);
  f.editor.suspend(true);f.editor.suspend(false);assert.equal(f.updates.at(-1)[1].passive,true);assert.equal(f.updates.at(-1)[1].visible,true);
 }finally{f.close();}
});
