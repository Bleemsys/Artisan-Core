import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../ui/vendor/three.module.js';
import {GeometryViewer} from '../ui/viewer.js';

function viewer() {
  const instance = Object.create(GeometryViewer.prototype);
  Object.assign(instance, {settings:{sourceColor:'#ededed'},layers:new Map(),scene:new THREE.Scene(),origin:new THREE.Vector3(),hasOrigin:false,measurements:[],pending:[]});
  for (const method of ['setOpacity','setDisplay','setActiveLayer','refreshLayers','refreshHelpers','updateSection','redrawMeasurements','fit','validateUpload']) instance[method]=()=>{};
  return instance;
}
test('adaptive beam and OBJ line previews render line segments without full FE topology', () => {
  const v=viewer();
  v.setLayer('result',new Float32Array(),{center:[0,0,0],mode:'quick',lines:new Float32Array([0,0,0,1,0,0]),bounds:[[0,0,0],[1,0,0]]});
  assert.equal(v.layers.get('result').mesh.children.length,1);
  assert.equal(v.layers.get('result').mesh.children[0].isLineSegments,true);
  assert.equal(v.geometryBytes(),24);
});
test('failed graphics upload retains the old layer and its adaptive controller', () => {
  const v=viewer(), p=new Float32Array([0,0,0,1,0,0,0,1,0]);
  v.setLayer('result',p,{center:[0,0,0],mode:'quick'});const original=v.layers.get('result');let disposed=false;
  v.onLayerDisposed=()=>{disposed=true;};v.validateUpload=()=>{throw Error('out of graphics memory');};
  assert.throws(()=>v.setLayer('result',p,{mode:'full'}),/out of graphics memory/);
  assert.equal(v.layers.get('result'),original);assert.equal(original.mesh.parent,v.scene);assert.equal(disposed,false);
});

 test('indexed full-detail chunks keep statistics and preserve the previous model on failed upload', () => {
  const v=viewer(),positions=new Float32Array([0,0,0,1,0,0,0,1,0]);
  v.setLayer('result',positions,{center:[0,0,0],mode:'quick'});const old=v.layers.get('result');
  const chunks=[{positions,indices:new Uint16Array([0,1,2]),center:[0,0,0]}];
  v.validateUpload=()=>{throw Error('upload failed');};
  assert.throws(()=>v.setLayer('result',new Float32Array(),{chunks,center:[0,0,0],bounds:[[0,0,0],[1,1,0]],total:1}),/upload failed/);
  assert.equal(v.layers.get('result'),old);
  v.validateUpload=()=>{};
  v.setLayer('result',new Float32Array(),{chunks,center:[0,0,0],bounds:[[0,0,0],[1,1,0]],total:1});
  assert.equal(v.layers.get('result').shown,1);assert.equal(v.geometryBytes(),42);
});

test('staged uploads retain the displayed preview until commit and share color uniforms',async()=>{
 const v=viewer(),p=new Float32Array([0,0,0,1,0,0,0,1,0]);
 v.setLayer('result',p,{center:[0,0,0],mode:'quick'});const previous=v.layers.get('result');
 const stage=v.beginFullDetail('result','test.stl');
 stage.append({positions:p,indices:new Uint16Array([0,1,2]),center:[0,0,0]});
 assert.equal(v.layers.get('result'),previous);assert.equal(stage.bytes,42);
 await stage.commit({center:[0,0,0],bounds:[[0,0,0],[1,1,0]],totalTriangles:1});
 const layer=v.layers.get('result');assert.notEqual(layer,previous);assert.equal(layer.shown,1);
 const batch=layer.mesh.children[0].children[0];assert.equal(batch.children[0].material.uniforms,layer.material.uniforms);
 stage.dispose();assert.equal(v.geometryBytes(),42);
});
test('a cancelled stage releases buffers and leaves the prior layer intact',()=>{
 const v=viewer(),p=new Float32Array([0,0,0,1,0,0,0,1,0]);v.setLayer('result',p,{center:[0,0,0],mode:'quick'});
 const previous=v.layers.get('result'),stage=v.beginFullDetail('result','test.stl');
 stage.append({positions:p,indices:new Uint16Array([0,1,2]),center:[0,0,0]});stage.dispose();
 assert.equal(stage.bytes,0);assert.equal(v.layers.get('result'),previous);
 assert.throws(()=>stage.append({}),{name:'AbortError'});
});
test('display-mode changes are uploaded batch by batch before committing',async()=>{
 const v=viewer(),p=new Float32Array([0,0,0,1,0,0,0,1,0]);v.display='solid';let uploads=0,checks=0;v.validateUpload=()=>uploads++;
 const stage=v.beginFullDetail('result','test.stl');
 for(let i=0;i<3;i++)stage.append({positions:p.slice(),indices:new Uint16Array([0,1,2]),center:[i,0,0]});
 v.display='edges';await stage.commit({center:[1,0,0],bounds:[[0,0,0],[3,1,0]],totalTriangles:3},{beforeAllocate:async()=>checks++});
 assert.equal(checks,3);assert.equal(uploads,6);assert.equal(v.layers.get('result').shown,3);
});
test('validation uploads offscreen and restores the render target even on allocation failure',()=>{
 const v=viewer(),root=new THREE.Group(),previous={name:'original-target'};let target=previous,error=0;
 const gl={NO_ERROR:0,isContextLost:()=>false,getError:()=>{const value=error;error=0;return value;}};
 v.camera={};v.renderer={getContext:()=>gl,getRenderTarget:()=>target,setRenderTarget:value=>target=value,
 render(){assert.notEqual(target,previous);assert.equal(target.width,1);error=1285;}};
 assert.throws(()=>GeometryViewer.prototype.validateUpload.call(v,root),/Graphics memory/);assert.equal(target,previous);
});
