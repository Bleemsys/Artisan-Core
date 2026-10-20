import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../ui/vendor/three.module.js';
import {decodeSurfaceNode,createSurfacePool} from '../ui/surface-lod.js';
import {selectSurfaceCut,readySurfaceCut,selectPreviewTileGroups} from '../ui/preview-policy.mjs';
import {prepareHierarchy} from '../ui/adaptive-hierarchy.js';
import {createAdaptivePreview} from '../ui/adaptive-preview.js';
import {GeometryViewer} from '../ui/viewer.js';

const nodes=[
  {id:0,parent:null,children:[1,2],level:0,count:2},
  {id:1,parent:0,children:[3,4],level:1,count:2},
  {id:2,parent:0,children:[],level:1,count:2},
  {id:3,parent:1,children:[],level:2,count:2},
  {id:4,parent:1,children:[],level:2,count:2}
];
test('an overview always keeps complete parent coverage until children are ready',()=>{
  const required=new Set([0,1,2,3,4]);
  assert.deepEqual(readySurfaceCut(nodes,[0],required,new Set([0])),[0]);
  assert.deepEqual(readySurfaceCut(nodes,[0],required,new Set([0,1])),[0]);
  assert.deepEqual(readySurfaceCut(nodes,[0],required,new Set([0,1,2,3])),[1,2]);
  assert.deepEqual(readySurfaceCut(nodes,[0],required,new Set([0,1,2,3,4])),[3,4,2]);
});
test('screen error refines the whole visible tree within a budget, including fallback parents',()=>{
  const far=nodes.map(()=>({visible:true,spacingPixels:1}));
  assert.deepEqual([...selectSurfaceCut(nodes,[0],far,10).cut],[0]);
  const near=nodes.map(n=>({visible:true,spacingPixels:16/(n.level+1)}));
  const cut=selectSurfaceCut(nodes,[0],near,10);assert.deepEqual([...cut.cut].sort(),[2,3,4]);assert.equal(cut.points,10);
  const limited=selectSurfaceCut(nodes,[0],near,6);assert.deepEqual([...limited.cut],[1,2]);assert.equal(limited.points,6);
});
test('regions outside the view return to a ready ancestor immediately after a pan',()=>{
  const required=new Set([0,1]);assert.deepEqual(readySurfaceCut(nodes,[0],required,new Set([0,2])),[0]);
});
test('exact mesh blocks are loaded as a complete spatial group before replacing samples',()=>{
  const tiles=[{id:0,cell:4,count:100,vertices:3,visible:true,pixels:100,score:4},{id:1,cell:4,count:100,vertices:3,visible:false,pixels:90,score:3}];
  assert.deepEqual(selectPreviewTileGroups(tiles,new Set(),3600),[]);
  assert.deepEqual(selectPreviewTileGroups(tiles,new Set(),7200),[0,1]);
});
test('binary sample validation catches truncation, invalid radii and nonfinite coordinates',()=>{
  const record=new Float32Array([1,2,3,0,0,1,.5]);assert.equal(decodeSurfaceNode(record.buffer,1).radii[0],.5);
  assert.throws(()=>decodeSurfaceNode(record.buffer,2),/size/);
  record[6]=-1;assert.throws(()=>decodeSurfaceNode(record.buffer,1),/radius/);
  record[6]=1;record[0]=Infinity;assert.throws(()=>decodeSurfaceNode(record.buffer,1),/coordinates/);
});
test('one bounded GPU batch supports node replacement and reclaims visibility when a slot is reused',()=>{
  const viewer={camera:new THREE.PerspectiveCamera(),canvas:{height:800}},base={uniforms:{opacity:{value:1},tint:{value:new THREE.Color('white')}}};
  const pool=createSurfacePool(base,viewer,{nodes:[{id:0},{id:1}]},new THREE.Box3(new THREE.Vector3(0,0,0),new THREE.Vector3(1,1,1)));
  const data={positions:new Float32Array([0,0,0]),normals:new Float32Array([0,0,1]),radii:new Float32Array([.1])};
  try{
    pool.add(0,data);pool.add(1,data);pool.show([1]);assert.equal(pool.object.material.uniforms.uNodeVisibility.value.image.data[4],255);
    pool.remove(1);assert.equal(pool.object.material.uniforms.uNodeVisibility.value.image.data[4],0);
    pool.add(1,data);pool.show([0,1]);assert.equal(pool.slots.size,2);assert.equal(pool.object.geometry.drawRange.count,1024);
    assert.equal(pool.object.geometry.attributes.position.data.array.length,2*512*8);
    pool.exactCells([15]);assert.equal(pool.object.material.uniforms.uExactCells.value.image.data[15*4],255);
    assert.equal(pool.material.uniforms.uHasExactCells.value,true);pool.exactCells([]);assert.equal(pool.material.uniforms.uHasExactCells.value,false);
  }finally{pool.dispose();}
});

test('native hierarchy loading retains coverage, masks only complete exact groups, and releases late requests',async()=>{
  const camera=new THREE.PerspectiveCamera(42,1,.01,1000);camera.position.set(.5,.5,5);camera.lookAt(.5,.5,0);camera.updateMatrixWorld();
  const viewer={camera,canvas:{height:800},origin:new THREE.Vector3(),section:{enabled:false}};
  const info={handle:'test-session',roots:[0],tileCells:[1,1],nodes:[
    {id:0,parent:null,children:[1,2],level:0,count:1,min:[0,0,0],max:[1,1,1],spacing:1},
    {id:1,parent:0,children:[],level:1,count:1,min:[0,0,0],max:[.5,1,1],spacing:.5},
    {id:2,parent:0,children:[],level:1,count:1,min:[.5,0,0],max:[1,1,1],spacing:.5}
  ]};
  let finishLate,delay=false,closed=0;
  const record=()=>new Float32Array([.5,.5,.5,0,0,1,.1]).buffer;
  const invoke=async(name,args)=>{if(name==='close_preview_lod'){closed++;return;}if(delay)return new Promise(resolve=>{finishLate=()=>resolve(record());});return record();};
  const hierarchy=await prepareHierarchy({manifest:{lod:info,boundsMin:[0,0,0],boundsMax:[1,1,1]},viewer,invoke,current:()=>true,onDirty(){},toast:assert.fail});
  const base={uniforms:{opacity:{value:1},tint:{value:new THREE.Color('white')}}},mesh=new THREE.Mesh(new THREE.BufferGeometry(),base);
  mesh.add(hierarchy.factory(base));hierarchy.attach({mesh,material:base});
  const frustum=new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
  hierarchy.update(frustum,800);assert.deepEqual(hierarchy.visibleCut,[0]);
  await hierarchy.load(1);assert.deepEqual(hierarchy.visibleCut,[0]);
  await hierarchy.load(2);assert.deepEqual(hierarchy.visibleCut,[1,2]);
  hierarchy.exact(new Map([[0,{}]]));assert.equal(hierarchy.pool.material.uniforms.uHasExactCells.value,false);
  hierarchy.exact(new Map([[0,{}],[1,{}]]));assert.equal(hierarchy.pool.material.uniforms.uHasExactCells.value,true);
  hierarchy.contextLost();assert.deepEqual(hierarchy.visibleCut,[0]);assert.equal(hierarchy.pool.slots.size,1);
  hierarchy.update(frustum,800);delay=true;const loading=hierarchy.load(1);hierarchy.close();finishLate();await loading;
  assert.equal(closed,1);assert.equal(hierarchy.pool.slots.size,0);hierarchy.close();assert.equal(closed,1);
});

test('a rejected preview allocation closes its native reader before touching the viewer',async()=>{
  const calls=[],viewer={camera:new THREE.PerspectiveCamera(),canvas:{},geometryBytes:()=>512*1024**2,setLayer:assert.fail};
  const controller=createAdaptivePreview({viewer,fileUrl:p=>p,invoke:async(name,args)=>calls.push([name,args])});
  await assert.rejects(controller.open({lod:{handle:'reader',nodes:[{}]}},{id:'result'}),/budget/);
  assert.deepEqual(calls,[['close_preview_lod',{handle:'reader'}]]);controller.clear();
});

test('depth range follows the camera without clipping tiny nearby detail',()=>{
  const box=new THREE.Box3(new THREE.Vector3(-50,-50,-50),new THREE.Vector3(50,50,50)),camera=new THREE.PerspectiveCamera();
  const viewer={camera,bounds:()=>box};camera.position.set(0,-300,0);GeometryViewer.prototype.updateDepthRange.call(viewer);
  assert.equal(camera.near,12.5);assert(camera.far>350);
  camera.position.set(0,-50.01,0);GeometryViewer.prototype.updateDepthRange.call(viewer);assert(camera.near<.001);
  camera.position.set(0,0,0);GeometryViewer.prototype.updateDepthRange.call(viewer);assert(camera.near>0&&camera.near<.001);
});
