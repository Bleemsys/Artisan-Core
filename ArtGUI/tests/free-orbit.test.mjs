import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../ui/vendor/three.module.js';
import {FreeOrbitControls} from '../ui/free-orbit-controls.js';
import {GeometryViewer} from '../ui/viewer.js';
let JSDOM;try{({JSDOM}=await import(process.env.ARTGUI_TEST_DOM||'jsdom'));}catch{}
const skip=!JSDOM;
const near=(a,b)=>assert.ok(a.distanceTo(b)<1e-7,`${a.toArray()} != ${b.toArray()}`);
function fixture(projection='perspective'){
 const dom=new JSDOM('<canvas></canvas><select id="standard-view"><option value="">Custom</option><option>Bottom</option><option>Back</option><option>Front</option><option>Isometric</option></select><select id="projection-select"><option>perspective</option><option>orthographic</option></select><select id="navigation-mode"><option value="rotate">Orbit</option><option value="pan">Pan</option><option value="zoom">Zoom</option></select><select id="saved-view-list"><option>saved</option></select>');
 const canvas=dom.window.document.querySelector('canvas'),captures=new Set();Object.defineProperties(canvas,{clientWidth:{value:800},clientHeight:{value:600}});canvas.getBoundingClientRect=()=>({left:0,top:0,width:800,height:600});canvas.setPointerCapture=id=>captures.add(id);canvas.releasePointerCapture=id=>captures.delete(id);
 const v=Object.assign(Object.create(GeometryViewer.prototype),{canvas,camera:projection==='perspective'?new THREE.PerspectiveCamera(42,4/3,.01,1000):new THREE.OrthographicCamera(-10,10,7.5,-7.5,.01,1000),projection,aspect:4/3,span:15,origin:new THREE.Vector3(),settings:{right:'pan',sensitivity:1,invertZoom:false},$:id=>dom.window.document.getElementById(id),render(){this.camera.updateMatrixWorld(true);},radius:()=>Math.sqrt(3),bounds:()=>new THREE.Box3(new THREE.Vector3(-1,-1,-1),new THREE.Vector3(1,1,1))});
 v.camera.up.set(0,0,1);v.camera.position.set(0,-10,0);v.controls=new FreeOrbitControls(v.camera,canvas);v.rebindControls();v.render();
 const pointer=(type,x,y,{button=0,pointerType='mouse',pointerId=1}={})=>{const event=new dom.window.MouseEvent(type,{bubbles:true,cancelable:true,clientX:x,clientY:y,button});Object.defineProperties(event,{pointerId:{value:pointerId},pointerType:{value:pointerType}});(type==='pointerdown'?canvas:dom.window.document).dispatchEvent(event);};
 return {dom,v,canvas,captures,pointer,direction:()=>v.camera.position.clone().sub(v.controls.target).normalize(),close(){v.controls.dispose();dom.window.close();}};
}
for(const projection of ['perspective','orthographic']){
 test(projection+' continues around X from Bottom through Back and Top without a pole clamp',{skip},()=>{
  const f=fixture(projection);try{f.v.standardView('Bottom');const radius=f.v.camera.position.distanceTo(f.v.controls.target),target=f.v.controls.target.clone();
   for(const expected of [[0,1,0],[0,0,1],[0,-1,0],[0,0,-1]]){f.v.controls.rotateUp(Math.PI/2);near(f.direction(),new THREE.Vector3(...expected));near(f.v.controls.target,target);assert.ok(Math.abs(f.v.camera.position.distanceTo(target)-radius)<1e-7);}
   f.v.controls.rotateUp(.1);assert.ok(f.direction().y>0,'dragging must continue after a complete revolution');
  }finally{f.close();}
 });
 test(projection+' real pointer events cross the former pole with one continuous drag',{skip},()=>{
  const f=fixture(projection);try{f.v.standardView('Bottom');let starts=0,ends=0;f.v.controls.addEventListener('start',()=>starts++);f.v.controls.addEventListener('end',()=>ends++);
   f.pointer('pointerdown',400,100);f.pointer('pointermove',400,250);near(f.direction(),new THREE.Vector3(0,1,0));f.pointer('pointermove',400,400);near(f.direction(),new THREE.Vector3(0,0,1));f.pointer('pointermove',400,550);near(f.direction(),new THREE.Vector3(0,-1,0));f.pointer('pointerup',400,550);
   assert.equal(starts,1);assert.equal(ends,1);assert.equal(f.captures.size,0);assert.equal(f.v.$('standard-view').value,'');
  }finally{f.close();}
 });
 test(projection+' retains pan, wheel zoom, alternate mouse mapping and disabled overlay navigation',{skip},()=>{
  const f=fixture(projection);try{f.v.standardView('Bottom');f.v.controls.rotateUp(Math.PI);const direction=f.direction(),target=f.v.controls.target.clone(),up=f.v.camera.up.clone();
   f.pointer('pointerdown',400,300,{button:2});f.pointer('pointermove',440,320,{button:2});f.pointer('pointerup',440,320,{button:2});assert.ok(f.v.controls.target.distanceTo(target)>0);near(f.direction(),direction);near(f.v.camera.up,up);
   const distance=f.v.camera.position.distanceTo(f.v.controls.target),zoom=f.v.camera.zoom;f.canvas.dispatchEvent(new f.dom.window.WheelEvent('wheel',{deltaY:-100,bubbles:true,cancelable:true}));assert.ok(projection==='perspective'?f.v.camera.position.distanceTo(f.v.controls.target)<distance:f.v.camera.zoom>zoom);
   f.v.settings.right='rotate';f.v.applyNavigation();f.pointer('pointerdown',400,200,{button:2});f.pointer('pointermove',400,230,{button:2});f.pointer('pointerup',400,230,{button:2});assert.ok(f.direction().distanceTo(direction)>.01);
   f.v.controls.enabled=false;const locked=f.v.camera.position.clone();f.pointer('pointerdown',400,200);f.pointer('pointermove',450,250);f.pointer('pointerup',450,250);near(f.v.camera.position,locked);
  }finally{f.close();}
 });
}
test('single-finger touch rotation crosses Back and keeps pointer cancellation working',{skip},()=>{
 const f=fixture();try{f.v.standardView('Bottom');const touch={pointerType:'touch'};f.pointer('pointerdown',400,100,touch);f.pointer('pointermove',400,250,touch);near(f.direction(),new THREE.Vector3(0,1,0));f.pointer('pointermove',400,400,touch);near(f.direction(),new THREE.Vector3(0,0,1));f.canvas.dispatchEvent(Object.assign(new f.dom.window.Event('pointercancel'),{pointerId:1}));assert.equal(f.captures.size,0);}finally{f.close();}
});
test('projection changes, saved-view restore, standard directions and fit retain free rotation',{skip},()=>{
 const f=fixture();try{const v=f.v;v.standardView('Bottom');v.controls.rotateUp(1.2);v.controls.rotateLeft(.35);const snapshot=v.snapshot();v.savedViews=[{name:'saved',...snapshot}];v.setProjection('orthographic');v.controls.rotateUp(3.3);v.restoreCamera();near(v.camera.position,new THREE.Vector3(...snapshot.position));near(v.camera.up,new THREE.Vector3(...snapshot.up));near(v.controls.target,new THREE.Vector3(...snapshot.target));
  const direction=f.direction(),up=v.camera.up.clone();v.fit();near(f.direction(),direction);near(v.camera.up,up);v.controls.rotateUp(2*Math.PI);near(f.direction(),direction);v.standardView('Back');near(f.direction(),new THREE.Vector3(0,1,0));near(v.camera.up,new THREE.Vector3(0,0,1));v.controls.rotateUp(2*Math.PI);near(f.direction(),new THREE.Vector3(0,1,0));
 }finally{f.close();}
});
