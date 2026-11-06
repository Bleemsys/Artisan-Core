import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../ui/vendor/three.module.js';
import {createPrimitiveMeshOverlay,primitiveMeshHandles} from '../ui/primitive-mesh-overlay.js';
import {setPrimitiveNumber,restorePrimitiveMesh,primitiveMeshError,replacePrimitiveMesh,primitiveMeshOrigin} from '../ui/primitive-mesh-model.js';
import {precisionWorldPerPixel} from '../ui/precision-gizmo.js';
import {cloneNumericJson} from '../ui/numeric-json.js';
let JSDOM;try{({JSDOM}=await import(process.env.ARTGUI_TEST_DOM||'jsdom'));}catch{}
const skip=!JSDOM?'Set ARTGUI_TEST_DOM to run overlay interaction checks':false;
function fixture({keyword='Gen_BoxMesh',setup=()=>{}}={}){
  const dom=new JSDOM('<div id="viewport"><canvas></canvas><div id="viewport-empty"></div></div>'),saved={document:globalThis.document,window:globalThis.window,AbortController:globalThis.AbortController,requestAnimationFrame:globalThis.requestAnimationFrame,cancelAnimationFrame:globalThis.cancelAnimationFrame};
  let next=0;const frames=new Map();Object.assign(globalThis,{document:dom.window.document,window:dom.window,AbortController:dom.window.AbortController,requestAnimationFrame:fn=>{frames.set(++next,fn);return next;},cancelAnimationFrame:id=>frames.delete(id)});
  const captures=new Set();dom.window.HTMLElement.prototype.setPointerCapture=function(id){captures.add(id);};dom.window.HTMLElement.prototype.hasPointerCapture=function(id){return captures.has(id);};dom.window.HTMLElement.prototype.releasePointerCapture=function(id){captures.delete(id);};
  // JSDOM 26 has MouseEvent but does not expose the browser's onpointerdown property.
  if(!('onpointerdown' in dom.window.HTMLElement.prototype))Object.defineProperty(dom.window.HTMLElement.prototype,'onpointerdown',{get(){return this._pointerDown;},set(handler){if(this._pointerDown)this.removeEventListener('pointerdown',this._pointerDown);this._pointerDown=handler;this.addEventListener('pointerdown',handler);}});
  const p={num_elem:[12,8,6],x_range:[0,60],y_range:[0,40],z_range:[0,30],ori:[0,0,0],Normal:[0,0,1],z_angle:0,Mesh_file:'Box'},canvas=document.querySelector('canvas'),camera=new THREE.PerspectiveCamera(42,800/600,.1,1000);
  if(keyword!=='Gen_BoxMesh')restorePrimitiveMesh(p,replacePrimitiveMesh('Gen_BoxMesh',keyword,p));setup(p);
  canvas.getBoundingClientRect=()=>({left:0,top:0,width:800,height:600});camera.up.set(0,0,1);camera.position.set(100,-100,100);camera.lookAt(30,20,15);camera.updateMatrixWorld();
  let overlay,baseline,commits=0,cancels=0;
  const viewer={canvas,camera,scene:new THREE.Scene(),origin:new THREE.Vector3(),controls:{enabled:true},render(){overlay?.beforeRender();overlay?.afterRender();}};
  overlay=createPrimitiveMeshOverlay(viewer,{onBegin:()=>baseline=cloneNumericJson(p),onDrag:(path,value)=>{const draft=cloneNumericJson(p);if(Array.isArray(value))value.forEach((n,i)=>setPrimitiveNumber(draft,path+'.'+i,n));else setPrimitiveNumber(draft,path,value);if(primitiveMeshError(keyword,draft))return false;restorePrimitiveMesh(p,draft);return true;},onCommit:()=>commits++,onCancel:()=>{cancels++;restorePrimitiveMesh(p,baseline);}});
  const flush=()=>{for(const [id,fn] of [...frames]){frames.delete(id);fn();}};
  let mode='shape';overlay.update(keyword,p);flush();
  const button=path=>document.querySelector(`[data-pm-handle="${path}"]`);
  const event=(type,x,y)=>{const e=new dom.window.MouseEvent(type,{button:0,clientX:x,clientY:y,bubbles:true});Object.defineProperty(e,'pointerId',{value:1});return e;};
  const start=(path='x_range.1')=>{const h=primitiveMeshHandles(keyword,p,mode).find(h=>h.path===path),v=h.point.clone().project(camera),x=(v.x+1)*400,y=(1-v.y)*300;button(path).dispatchEvent(event('pointerdown',x,y));return {x,y,button:button(path)};};
  return {p,viewer,overlay,dom,button,event,start,flush,setMode(value){mode=value;overlay.update(keyword,p,{mode});flush();},get commits(){return commits;},get cancels(){return cancels;},get captured(){return captures.size;},close(){overlay.dispose();dom.window.close();Object.assign(globalThis,saved);}};
}
test('actual pointer events move one face, keep navigation disabled during drag, and commit once',{skip},()=>{
  const f=fixture();try{const {x,y,button}=f.start();assert.equal(f.viewer.controls.enabled,false);button.dispatchEvent(f.event('pointermove',x+50,y+15));f.flush();assert.ok(f.p.x_range[1]>60);assert.equal(f.p.x_range[0],0);button.dispatchEvent(f.event('pointerup',x+50,y+15));assert.equal(f.viewer.controls.enabled,true);assert.equal(f.commits,1);assert.equal(f.captured,0);}finally{f.close();}
});
test('Escape cancels the active drag and releases navigation and pointer capture',{skip},()=>{
  const f=fixture();try{const {x,y,button}=f.start();button.dispatchEvent(f.event('pointermove',x+40,y+10));assert.notEqual(f.p.x_range[1],60);document.dispatchEvent(new f.dom.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert.equal(f.p.x_range[1],60);assert.equal(f.viewer.controls.enabled,true);assert.equal(f.cancels,1);assert.equal(f.commits,0);assert.equal(f.captured,0);}finally{f.close();}
});
test('rebuilding a guide retains focused handle nodes for repeated arrow adjustments',{skip},()=>{
  const f=fixture();try{const b=f.button('x_range.1');b.focus();for(let i=0;i<3;i++){b.dispatchEvent(new f.dom.window.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));f.flush();assert.equal(document.activeElement,b);assert.equal(f.button('x_range.1'),b);}assert.equal(f.p.x_range[1],63);assert.equal(f.commits,3);}finally{f.close();}
});
test('hiding a preview during a drag cancels it and releases the camera',{skip},()=>{
  const f=fixture();try{f.start();f.overlay.hide();assert.equal(f.viewer.controls.enabled,true);assert.equal(f.captured,0);assert.equal(document.querySelector('.pm-handles').hidden,true);assert.equal(f.overlay.getBounds().isEmpty(),true);}finally{f.close();}
});

for(const keyword of ['Gen_BoxMesh','Gen_CylindricalMesh','Gen_SphericalMesh','Gen_CappedConeMesh']){
  test(keyword+' origin drag follows the mouse in world space for a tilted mesh',{skip},()=>{
    const f=fixture({keyword,setup:p=>{p.ori=[5,6,7];p.Normal=[1,1,0];}});try{
      f.setMode('move');const originalNormal=[...f.p.Normal],start=f.start('ori');
      start.button.dispatchEvent(f.event('pointermove',start.x+35,start.y-18));f.flush();
      const position=primitiveMeshOrigin(keyword,f.p).project(f.viewer.camera);
      assert.ok(Math.abs((position.x+1)*400-(start.x+35))<1e-6);
      assert.ok(Math.abs((1-position.y)*300-(start.y-18))<1e-6);
      assert.deepEqual(f.p.Normal,originalNormal);start.button.dispatchEvent(f.event('pointerup',start.x+35,start.y-18));assert.equal(f.commits,1);
    }finally{f.close();}
  });
  test(keyword+' normal dial rotates direction while retaining origin and vector magnitude',{skip},()=>{
    const f=fixture({keyword,setup:p=>{p.ori=[5,6,7];p.Normal=[0,0,3];}});try{
      f.setMode('axis');const origin=primitiveMeshOrigin(keyword,f.p),radius=precisionWorldPerPixel(f.viewer,origin)*78;
      const project=v=>{const q=v.clone().project(f.viewer.camera);return {x:(q.x+1)*400,y:(1-q.y)*300};};
      const start=project(origin.clone().add(new THREE.Vector3(0,radius,0))),end=project(origin.clone().add(new THREE.Vector3(0,radius*Math.cos(Math.PI/6),radius*Math.sin(Math.PI/6))));
      const dial=document.querySelector('[data-pm-handle="Normal:rotate:rotate-0"]');assert.ok(dial);
      dial.dispatchEvent(f.event('pointerdown',start.x,start.y));assert.equal(f.viewer.controls.enabled,false);
      dial.dispatchEvent(f.event('pointermove',end.x,end.y));f.flush();
      assert.ok(Math.abs(f.p.Normal[1]+1.5)<1e-6);assert.ok(Math.abs(f.p.Normal[2]-3*Math.sqrt(3)/2)<1e-6);
      assert.ok(Math.abs(Math.hypot(...f.p.Normal)-3)<1e-8);assert.deepEqual(f.p.ori,[5,6,7]);
      dial.dispatchEvent(f.event('pointerup',end.x,end.y));assert.equal(f.commits,1);assert.equal(f.viewer.controls.enabled,true);
    }finally{f.close();}
  });
}
test('normal dial Escape and arrow keys retain magnitude and release navigation',{skip},()=>{
  const f=fixture({setup:p=>p.Normal=[0,0,5]});try{
    f.setMode('axis');const dial=document.querySelector('[data-pm-handle="Normal:rotate:rotate-0"]');
    dial.dispatchEvent(new f.dom.window.KeyboardEvent('keydown',{key:'ArrowRight',shiftKey:true,bubbles:true}));f.flush();
    assert.ok(Math.abs(Math.hypot(...f.p.Normal)-5)<1e-8);assert.ok(Math.abs(Math.atan2(-f.p.Normal[1],f.p.Normal[2])-Math.PI/12)<1e-8);
    const before=[...f.p.Normal],{x,y,button}=f.start('Normal');button.dispatchEvent(f.event('pointermove',x+25,y-20));
    document.dispatchEvent(new f.dom.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert.deepEqual(f.p.Normal,before);assert.equal(f.viewer.controls.enabled,true);assert.equal(f.cancels,1);
  }finally{f.close();}
});
test('dragging an origin arrow shaft on the canvas updates the matching origin component',{skip},()=>{
  const f=fixture();try{
    f.setMode('move');const h=primitiveMeshHandles('Gen_BoxMesh',f.p,'move').find(h=>h.path==='ori.0');
    const point=primitiveMeshOrigin('Gen_BoxMesh',f.p).lerp(h.point,.65).project(f.viewer.camera),x=(point.x+1)*400,y=(1-point.y)*300;
    f.viewer.canvas.dispatchEvent(f.event('pointerdown',x,y));assert.equal(f.viewer.controls.enabled,false);
    f.viewer.canvas.dispatchEvent(f.event('pointermove',x+25,y+10));assert.notEqual(f.p.ori[0],0);assert.equal(f.p.ori[1],0);assert.equal(f.p.ori[2],0);
    f.viewer.canvas.dispatchEvent(f.event('pointerup',x+25,y+10));assert.equal(f.commits,1);assert.equal(f.viewer.controls.enabled,true);
  }finally{f.close();}
});

for(const path of ['r_bottom','UB_heightRatio'])test('cone '+path+' pointer drag refreshes the visible surface before release and Escape restores it',{skip},()=>{
 const f=fixture({keyword:'Gen_CappedConeMesh'});try{
  const mesh=()=>f.viewer.scene.children.find(g=>g.visible).children.find(o=>o.isMesh),before=[...mesh().geometry.attributes.position.array],old=f.p[path];
  const d=f.start(path);d.button.dispatchEvent(f.event('pointermove',d.x+35,d.y-25));f.flush();assert.notEqual(f.p[path],old);assert.notDeepEqual([...mesh().geometry.attributes.position.array],before);assert.equal(f.viewer.controls.enabled,false);
  document.dispatchEvent(new f.dom.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));f.flush();assert.equal(f.p[path],old);assert.deepEqual([...mesh().geometry.attributes.position.array],before);assert.equal(f.viewer.controls.enabled,true);assert.equal(f.commits,0);
 }finally{f.close();}
});
test('the cone taper ring itself accepts pointer dragging and commits once',{skip},()=>{
 const f=fixture({keyword:'Gen_CappedConeMesh'});try{
  const canvas=f.viewer.canvas,h=primitiveMeshHandles('Gen_CappedConeMesh',f.p).find(h=>h.path==='UB_heightRatio'),v=h.point.clone().project(f.viewer.camera),x=(v.x+1)*400,y=(1-v.y)*300,old=f.p.UB_heightRatio;
  canvas.dispatchEvent(f.event('pointerdown',x,y));assert.equal(f.viewer.controls.enabled,false);canvas.dispatchEvent(f.event('pointermove',x,y-25));f.flush();assert.notEqual(f.p.UB_heightRatio,old);canvas.dispatchEvent(f.event('pointerup',x,y-25));assert.equal(f.commits,1);assert.equal(f.viewer.controls.enabled,true);
 }finally{f.close();}
});
