import test from 'node:test';
import assert from 'node:assert/strict';
import {createSpatialEditor} from '../ui/spatial-editor.js';
import {parseNumericJson,stringifyNumericJson} from '../ui/numeric-json.js';
let JSDOM;try{({JSDOM}=await import(process.env.ARTGUI_TEST_DOM||'jsdom'));}catch{}
const skip=!JSDOM?'Set ARTGUI_TEST_DOM to run DOM integration checks':false;
const sphere=()=>parseNumericJson('{"Name":"Sphere","Paras":{"ori":[-2.0,0.0,0.0],"r":1.5},"k_factor":0.0,"push2GeomField":false,"custom":{"keep":7}}');
function fixture(p=sphere()){
 const dom=new JSDOM('<div id="host"></div><div id="viewport-empty"></div>');
 const saved={document:globalThis.document,AbortController:globalThis.AbortController};globalThis.document=dom.window.document;globalThis.AbortController=dom.window.AbortController;
 const host=document.getElementById('host'),errors=[],calls=[];let keyword='Subtract_Geometry';
 const overlay={update(){},hide(){},frame(){},pickCenter(){calls.push('pick');}};
 const editor=createSpatialEditor({getViewer:()=>null,getSetup:()=>({Sample:{Domain:[[-10,10],[-10,10],[-10,10]]}}),getGeometries:()=>[{path:'part.stl'}],onChange(){calls.push('change');},onRefresh:()=>editor.show(host,keyword,p),toast:e=>errors.push(e),onOperationChange:(old,next,params)=>{assert.equal(params,p);keyword=next;editor.show(host,keyword,p);},browseMesh:async()=>null,loadMesh:async()=>{},onPreview:async()=>({success:true})});
 editor.attachOverlay(overlay);editor.show(host,keyword,p);
 const query=s=>host.querySelector(s),change=(selector,value)=>{const el=query(selector);el.value=value;el.dispatchEvent(new dom.window.Event('change',{bubbles:true}));};
 return {host,p,editor,query,change,errors,calls,close(){editor.hide();dom.window.close();Object.assign(globalThis,saved);}};
}
test('guided numeric controls and viewport edits update the same legacy geometry parameters',{skip},()=>{
 const f=fixture();try{
 assert.equal(f.query('[role=tab][aria-selected=true]').textContent,'Primitive');assert.equal(f.host.querySelectorAll('[data-geometry-section][open]').length,1);
 f.change('[data-spatial-number=radius]','2.75');assert.equal(f.p.Paras.r,2.75);assert.equal(f.p.custom.keep,7);
 f.editor.drag({type:'Sphere',center:[6,7,8],radius:2.75});f.editor.commit();assert.deepEqual(f.p.Paras.ori,[6,7,8]);
 f.change('[data-spatial-number=radius]','-1');assert.equal(f.p.Paras.r,2.75);assert.ok(f.errors.length);
 assert.match(stringifyNumericJson(f.p),/2\.75/);
 }finally{f.close();}
});
test('operation switching preserves parameters and smoothing has no maximum of one',{skip},()=>{
 const f=fixture();try{const before=stringifyNumericJson(f.p);f.query('[data-geometry-operation=Intersect_Geometry]').click();assert.equal(stringifyNumericJson(f.p),before);assert.match(f.host.textContent,/Define overlap shape/);
 f.change('[data-geometry-number=k_factor]','1.7');assert.equal(f.p.k_factor,1.7);f.query('[data-geometry-transition=sharp]').click();assert.equal(f.p.k_factor,0);f.query('[data-geometry-transition=smooth]').click();assert.equal(f.p.k_factor,1.7);
 f.change('[data-geometry-field]','geometry');assert.equal(f.p.push2GeomField,true);assert.match(f.query('[data-geometry-preview]').textContent,/Generate model/);
 }finally{f.close();}
});
test('Mesh tab does not replace geometry until a mesh is selected; transforms and shape drafts survive',{skip},()=>{
 const f=fixture();try{const before=stringifyNumericJson(f.p);f.query('[data-geometry-tab=Mesh]').click();assert.equal(stringifyNumericJson(f.p),before);
 f.change('[data-geometry-mesh]','part.stl');assert.equal(f.p.Name,'part.stl');f.change('[data-geometry-number="Paras.Scale.0"]','2.5');assert.equal(f.p.Paras.Scale[0],2.5);
 f.query('[data-geometry-tab=Primitive]').click();f.change('[data-geometry-shape]','Sphere');assert.equal(f.p.Paras.r,1.5);
 f.query('[data-geometry-tab=Mesh]').click();f.change('[data-geometry-project-mesh]','part.stl');assert.equal(f.p.Paras.Scale[0],2.5);assert.equal(f.p.custom.keep,7);
 }finally{f.close();}
});
test('existing field sources stay intact until explicitly replaced and undo restores them',{skip},()=>{
 const p={Source:{Type:'Field',ID:'cut_H'},k_factor:0,push2GeomField:false},f=fixture(p);try{
 assert.equal(f.query('[role=tab][aria-selected=true]').textContent,'Field');assert.equal(p.Name,undefined);
 f.query('[data-geometry-tab=Primitive]').click();f.change('[data-geometry-shape]','Box');assert.equal(p.Source,undefined);assert.equal(p.Name,'Box');
 f.query('[data-spatial-undo]').click();assert.deepEqual(p.Source,{Type:'Field',ID:'cut_H'});assert.equal(p.Name,undefined);
 }finally{f.close();}
});
test('successful preview becomes stale after numeric edits and undo',{skip},async()=>{
 const f=fixture();try{
 f.query('[data-geometry-preview]').click();await new Promise(resolve=>setTimeout(resolve,0));
 assert.match(f.query('[data-geometry-status]').textContent,/Preview updated/);
 f.change('[data-spatial-number=radius]','2.0');assert.match(f.query('[data-geometry-status]').textContent,/preview needs update/);
 f.query('[data-geometry-preview]').click();await new Promise(resolve=>setTimeout(resolve,0));
 f.query('[data-spatial-undo]').click();assert.match(f.query('[data-geometry-status]').textContent,/preview needs update/);
 }finally{f.close();}
});
