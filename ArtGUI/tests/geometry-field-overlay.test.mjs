import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../ui/vendor/three.module.js';
import {createGeometryFieldEditor} from '../ui/geometry-field-editor.js';
import {createRegionOverlay} from '../ui/region-overlay.js';
import {parseNumericJson} from '../ui/numeric-json.js';
let JSDOM;try{({JSDOM}=await import(process.env.ARTGUI_TEST_DOM||'jsdom'));}catch{}
const skip=!JSDOM;
function fixture(){
 const dom=new JSDOM('<div id="viewport"><canvas></canvas><div id="viewport-empty"></div></div><div id="host"></div>'),previous={document:globalThis.document,AbortController:globalThis.AbortController};
 globalThis.document=dom.window.document;globalThis.AbortController=dom.window.AbortController;dom.window.HTMLCanvasElement.prototype.getContext=()=>null;
 const canvas=document.querySelector('canvas');canvas.getBoundingClientRect=()=>({left:0,top:0,width:900,height:600});
 const captures=new Set();for(const element of [canvas,dom.window.HTMLElement.prototype]){element.setPointerCapture=id=>captures.add(id);element.hasPointerCapture=id=>captures.has(id);element.releasePointerCapture=id=>captures.delete(id);}
 const camera=new THREE.PerspectiveCamera(42,1.5,.1,1000);camera.up.set(0,0,1);camera.position.set(65,-75,65);camera.lookAt(0,0,10);camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
 let overlay;const viewer={canvas,camera,origin:new THREE.Vector3(),scene:new THREE.Scene(),layers:new Map(),controls:{enabled:true},fit(){},render(){overlay?.beforeRender();overlay?.afterRender();}};
 const p=parseNumericJson('{"Name":"Cylinder","Paras":{"pa":[0.0,0.0,-10.0],"pb":[0.0,0.0,30.0],"r":10.0},"min":-5.0,"max":0.0,"min_val":0.0,"max_val":1.0,"min_max_opt":[0.0,0.0]}'),doc={Setup:{},WorkFlow:{'1':{OP_FieldOffset_GeomField:p}}};
 // A previously selected editor leaves hidden labels in the shared viewport.
 const other=createRegionOverlay(viewer,{onSelect(){},onDrag(){},onCommit(){},onCancel(){},toast(){}});other.update([{name:'Lattice frame',geometry:{type:'Box',center:[0,0,0],size:[10,10,10]}}],0);other.hide();
 const editor=createGeometryFieldEditor({getContext:params=>params===p?{doc,key:'1',keyword:'OP_FieldOffset_GeomField'}:null,onChange(){},toast(){},inspector:{renderCompact(){}},onGenerate:async()=>({success:true,fieldPath:'preview.h5',field:'lattice'})});
 overlay=createRegionOverlay(viewer,{onSelect(){},onDrag:g=>editor.drag(g),onCommit:g=>editor.commitDrag(g),onCancel:g=>editor.cancelDrag(g),toast(){}});editor.attachOverlay(overlay);editor.show(document.getElementById('host'),'OP_FieldOffset_GeomField',p);
 const q=s=>document.querySelector(s),body=()=>viewer.scene.children.find(g=>g.visible&&g.children.some(o=>o.geometry?.type==='CylinderGeometry')).children.find(o=>o.isMesh&&o.geometry?.type==='CylinderGeometry');
 const pointer=(element,type,x,y)=>{const event=new dom.window.MouseEvent(type,{bubbles:true,cancelable:true,button:0,clientX:x,clientY:y});Object.defineProperty(event,'pointerId',{value:7});element.dispatchEvent(event);};
 function dragStart(){const button=[...document.querySelectorAll('[aria-label="Move X"]')].find(el=>!el.closest('.region-labels').hidden),x=parseFloat(button.style.left),y=parseFloat(button.style.top);assert.ok(Number.isFinite(x)&&Number.isFinite(y));pointer(button,'pointerdown',x,y);return {button,x,y};}
 return {p,dom,editor,overlay,viewer,q,body,pointer,dragStart,close(){editor.hide();overlay.dispose();other.dispose();dom.window.close();Object.assign(globalThis,previous);}};
}
test('pointer movement updates the rendered cylinder before release and preserves a single undo transaction',{skip},()=>{
 const f=fixture();try{const d=f.dragStart();assert.equal(f.viewer.controls.enabled,false);f.pointer(d.button,'pointermove',d.x+45,d.y);const first=f.p.Paras.pa[0];assert.ok(Math.abs(first)>1e-6);assert.ok(Math.abs(f.body().position.x-first)<1e-8,'visible cylinder must follow the parameter while dragging');
 f.pointer(d.button,'pointermove',d.x+70,d.y);assert.notEqual(f.p.Paras.pa[0],first);assert.ok(Math.abs(f.body().position.x-f.p.Paras.pa[0])<1e-8);f.pointer(d.button,'pointerup',d.x+70,d.y);assert.equal(f.viewer.controls.enabled,true);
 f.q('[data-gf-undo]').click();assert.deepEqual(f.p.Paras.pa,[0,0,-10]);assert.equal(f.body().position.x,0);assert.equal(f.q('[data-gf-undo]').disabled,true);
 f.q('[data-gf-redo]').click();assert.ok(Math.abs(f.body().position.x)>1e-6);
 }finally{f.close();}
});
test('Escape restores both workflow coordinates and rendered geometry during an active pointer drag',{skip},()=>{
 const f=fixture();try{const d=f.dragStart();f.pointer(d.button,'pointermove',d.x+60,d.y);assert.notEqual(f.body().position.x,0);document.dispatchEvent(new f.dom.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));assert.equal(f.viewer.controls.enabled,true);assert.deepEqual(f.p.Paras.pa,[0,0,-10]);assert.equal(f.body().position.x,0);assert.equal(f.q('[data-gf-undo]').disabled,true);}finally{f.close();}
});
test('rotation and resize handles update the actual mesh and use labels from the active editor',{skip},()=>{
 const f=fixture();try{const pivot=[...document.querySelectorAll('.precision-pivot-handle')].find(el=>!el.closest('.region-labels').hidden);assert.equal(document.getElementById(pivot.getAttribute('aria-labelledby')).textContent,'Influence geometry');
 f.q('[data-gf-mode="rotate"]').click();[...document.querySelectorAll('[aria-label="Choose rotation axis X"]')].find(el=>!el.closest('.region-labels').hidden).click();const rotate=[...document.querySelectorAll('[aria-label="Rotate X"]')].find(el=>!el.closest('.region-labels').hidden);rotate.dispatchEvent(new f.dom.window.KeyboardEvent('keydown',{key:'ArrowRight',shiftKey:true,bubbles:true}));
 const direction=new THREE.Vector3(0,1,0).applyQuaternion(f.body().quaternion);assert.ok(Math.abs(direction.y+Math.sin(Math.PI/12))<1e-8);assert.ok(Math.abs(direction.z-Math.cos(Math.PI/12))<1e-8);
 f.q('[data-gf-mode="resize"]').click();const radius=[...document.querySelectorAll('[aria-label="Radius"]')].find(el=>el.classList.contains('region-handle')&&!el.closest('.region-labels').hidden);radius.dispatchEvent(new f.dom.window.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));assert.equal(f.p.Paras.r,11);assert.equal(f.body().geometry.parameters.radiusTop,11);
 }finally{f.close();}
});
