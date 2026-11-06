import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../ui/vendor/three.module.js';
import {createSetupOverlay} from '../ui/setup-overlay.js';
import {domainGeometry} from '../ui/setup-model.js';
let JSDOM;try{({JSDOM}=await import(process.env.ARTGUI_TEST_DOM||'jsdom'));}catch{}
const skip=!JSDOM?'Set ARTGUI_TEST_DOM to run DOM integration checks':false;
test('sampling overlay supports keyboard face resize, padding bounds and read-only mesh mode',{skip},()=>{
 const dom=new JSDOM('<div><canvas></canvas></div>'),saved={document:globalThis.document,AbortController:globalThis.AbortController};globalThis.document=dom.window.document;globalThis.AbortController=dom.window.AbortController;
 const canvas=document.querySelector('canvas');canvas.getBoundingClientRect=()=>({width:640,height:480,left:0,top:0});
 const camera=new THREE.PerspectiveCamera(45,640/480,.1,1000);camera.position.set(20,20,20);camera.lookAt(0,0,0);camera.updateMatrixWorld();
 const viewer={scene:new THREE.Scene(),camera,canvas,origin:new THREE.Vector3(),layers:new Map(),controls:{enabled:true},section:{enabled:false},render(){},fit(){}};
 const changes=[],g=domainGeometry([[-5,5],[-5,5],[-5,5]]),overlay=createSetupOverlay(viewer,{onDrag:x=>changes.push(x),onCommit(){},onCancel(){},onTool(){},toast(){}});
 try{overlay.update(g,{editable:true,mode:'resize',visible:true,res:[.2,.2,.2],padding:1});overlay.beforeRender();overlay.afterRender();assert.equal(document.querySelectorAll('.precision-resize').length,6);
 const face=document.querySelector('[aria-label="X + face"]');assert.ok(face);face.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));assert.equal(changes.at(-1).size[0],11);assert.equal(changes.at(-1).center[0],.5);
 const bounds=overlay.getBounds();assert.ok(bounds.min.x< -5);assert.ok(bounds.max.x>5);
 overlay.update(g,{editable:false,mode:'resize',visible:true,res:[.2,.2,.2],padding:1});assert.equal(document.querySelectorAll('.precision-resize').length,0);assert.equal(document.querySelector('[data-domain-mode="move"]').hidden,true);assert.equal(document.querySelector('.region-legend').textContent,'Sampling domain · Read-only source bounds');
 overlay.update(g,{editable:false,passive:true,visible:true,res:[.2,.2,.2],padding:1});overlay.beforeRender();overlay.afterRender();
 const grid=viewer.scene.getObjectByName('Sampling grid guide');assert.equal(grid.visible,true);assert.ok(grid.children.length>=3);assert.equal(document.querySelector('.setup-viewport-tools').hidden,true);assert.equal(document.querySelector('.region-legend').hidden,true);assert.equal(document.querySelectorAll('.precision-resize').length,0);assert.ok(overlay.getBounds().max.x>5);
 viewer.origin.set(1000,2000,3000);overlay.beforeRender();assert.deepEqual(grid.position.toArray(),[-1000,-2000,-3000]);assert.ok(overlay.getBounds().min.x< -1005);
 overlay.update(g,{editable:false,passive:true,visible:false,res:[.2,.2,.2],padding:1});assert.equal(grid.visible,false);assert.equal(grid.children.length,0);assert.ok(overlay.getBounds().isEmpty());
 overlay.hide();assert.ok(overlay.getBounds().isEmpty());assert.equal(document.querySelector('.setup-viewport-tools').hidden,true);
 }finally{overlay.dispose();dom.window.close();Object.assign(globalThis,saved);}
});
