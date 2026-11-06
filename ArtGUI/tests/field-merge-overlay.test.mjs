import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../ui/vendor/three.module.js';
import {createFieldMergeEditor} from '../ui/field-merge-editor.js';
import {createRegionOverlay} from '../ui/region-overlay.js';
let JSDOM;try{({JSDOM}=await import(process.env.ARTGUI_TEST_DOM||'jsdom'));}catch{}
const skip=!JSDOM;
function fixture(){
 const dom=new JSDOM('<div id="viewport"><canvas></canvas><div id="viewport-empty"></div></div><div id="host"></div>'),old={document:globalThis.document,AbortController:globalThis.AbortController};globalThis.document=dom.window.document;globalThis.AbortController=dom.window.AbortController;
 const canvas=document.querySelector('canvas');canvas.getBoundingClientRect=()=>({left:0,top:0,width:900,height:600});const captures=new Set();dom.window.HTMLElement.prototype.setPointerCapture=id=>captures.add(id);dom.window.HTMLElement.prototype.hasPointerCapture=id=>captures.has(id);dom.window.HTMLElement.prototype.releasePointerCapture=id=>captures.delete(id);
 const camera=new THREE.PerspectiveCamera(42,1.5,.1,1000);camera.up.set(0,0,1);camera.position.set(35,-45,35);camera.lookAt(4,4,4);camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
 let overlay;const viewer={canvas,camera,origin:new THREE.Vector3(1000,2000,3000),scene:new THREE.Scene(),layers:new Map(),controls:{enabled:true},fit(){},render(){overlay?.beforeRender();overlay?.afterRender();}};
 const p={la_name:'BCCubic',size:[4,4,4],thk:.4,Rot:[0,0,0],Trans:[0,0,0],Fill:true,Cube_Request:{},OP_para:{InterpType:'Attractor',pt_att:[1004,2004,3004],pt_r:3,Transition:{}}};
 const doc={Setup:{Sample:{Domain:[[1000,1008],[2000,2008],[3000,3008]]}},WorkFlow:{'1':{OP_FieldMerge:p}}},editor=createFieldMergeEditor({getContext:params=>params===p?{doc,key:'1'}:null,onChange(){},onRender(){},toast(){},latticePicker:()=>'',inspector:{renderCompact(){}},onGenerate:async()=>({success:true})});
 overlay=createRegionOverlay(viewer,{onSelect:i=>editor.select(i),onDrag:g=>editor.drag(g),onCommit:()=>editor.commitDrag(),onCancel:()=>editor.cancelDrag(),toast(){}});editor.attachOverlay(overlay);editor.show(document.getElementById('host'),p);
 const q=x=>document.querySelector(x),spheres=()=>viewer.scene.children.flatMap(g=>g.visible?g.children:[]).filter(o=>o.isMesh&&o.geometry.type==='SphereGeometry');
 function pointer(el,type,x,y){const e=new dom.window.MouseEvent(type,{bubbles:true,cancelable:true,button:0,clientX:x,clientY:y});Object.defineProperty(e,'pointerId',{value:9});el.dispatchEvent(e);}
 function start(){const b=[...document.querySelectorAll('[aria-label="Move X"]')].find(b=>!b.closest('.region-labels').hidden),x=parseFloat(b.style.left),y=parseFloat(b.style.top);pointer(b,'pointerdown',x,y);return {b,x,y};}
 return {p,doc,dom,editor,overlay,viewer,q,spheres,pointer,start,close(){editor.hide();overlay.dispose();dom.window.close();Object.assign(globalThis,old);}};
}
test('live center dragging updates the visible sphere with a shifted viewer origin and one undo',{skip},()=>{const f=fixture();try{
 const d=f.start();assert.equal(f.viewer.controls.enabled,false);f.pointer(d.b,'pointermove',d.x+50,d.y);assert.notEqual(f.p.OP_para.pt_att[0],1004);assert.equal(f.spheres()[0].position.x,f.p.OP_para.pt_att[0]);
 const world=new THREE.Vector3();f.viewer.scene.updateMatrixWorld(true);f.spheres()[0].getWorldPosition(world);assert.ok(Math.abs(world.x-(f.p.OP_para.pt_att[0]-1000))<1e-8);
 f.pointer(d.b,'pointermove',d.x+80,d.y);f.pointer(d.b,'pointerup',d.x+80,d.y);assert.equal(f.viewer.controls.enabled,true);f.q('[data-fm-undo]').click();assert.deepEqual(f.p.OP_para.pt_att,[1004,2004,3004]);assert.equal(f.q('[data-fm-undo]').disabled,true);
 }finally{f.close();}});
test('Escape cancels both native coordinates and visible guide geometry during drag',{skip},()=>{const f=fixture();try{
 const d=f.start();f.pointer(d.b,'pointermove',d.x+40,d.y);document.dispatchEvent(new f.dom.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));assert.deepEqual(f.p.OP_para.pt_att,[1004,2004,3004]);assert.equal(f.spheres()[0].position.x,1004);assert.equal(f.viewer.controls.enabled,true);assert.equal(f.q('[data-fm-undo]').disabled,true);
 }finally{f.close();}});
test('annulus resize clamps radii and changes the actual sphere, with shared centers',{skip},()=>{const f=fixture();try{
 f.q('[data-fm-mode="Annulus"]').click();f.q('[data-fm-tool="resize"]').click();const radius=[...document.querySelectorAll('[aria-label="Radius"]')].find(b=>b.closest('.region-labels')&&!b.closest('.region-labels').hidden);radius.dispatchEvent(new f.dom.window.KeyboardEvent('keydown',{key:'ArrowRight',shiftKey:true,bubbles:true}));
 assert.ok(f.p.OP_para.inner_r<f.p.OP_para.outer_r);assert.ok(f.spheres().some(o=>Math.abs(o.geometry.parameters.radius-f.p.OP_para.inner_r)<1e-10));assert.deepEqual(f.spheres()[0].position.toArray(),f.spheres()[1].position.toArray());
 }finally{f.close();}});
test('plane rotation updates native normals rather than a disconnected visual transform',{skip},()=>{const f=fixture();try{
 f.q('[data-fm-mode="Linear"]').click();f.q('[data-fm-tool="rotate"]').click();document.querySelector('[aria-label="Choose rotation axis Y"]').click();document.querySelector('[aria-label="Rotate Y"]').dispatchEvent(new f.dom.window.KeyboardEvent('keydown',{key:'ArrowRight',shiftKey:true,bubbles:true}));
 assert.ok(Math.abs(f.p.OP_para.n_vec_01[2])>.1);const before=[...f.p.OP_para.n_vec_01];f.q('[data-fm-undo]').click();assert.deepEqual(f.p.OP_para.n_vec_01,[1,0,0]);assert.notDeepEqual(before,f.p.OP_para.n_vec_01);
 }finally{f.close();}});
