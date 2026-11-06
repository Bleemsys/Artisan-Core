import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../ui/vendor/three.module.js';
import {spatialTargets} from '../ui/spatial-model.js';
import {transitionGuideScene} from '../ui/transition-preview.js';
import {GeometryViewer} from '../ui/viewer.js';
test('miniature contains matching selectable input guides, bounded coordinates and no synthetic result mesh',()=>{
 const p={pt_01:[1e8,0,0],n_vec_01:[0,0,2],pt_02:[1e8,0,4],n_vec_02:[0,0,-3]},targets=spatialTargets('Lin_Interpolate',p).targets,scene=transitionGuideScene(targets,'plane:2');
 try{assert.equal(scene.pickable.length,2);assert.equal(scene.pickable[1].userData.target,'plane:2');assert.equal(scene.pickable[0].material.color.getHexString(),'3989ee');assert.equal(scene.pickable[1].material.color.getHexString(),'ed6374');assert.ok(scene.bounds.getSize(new THREE.Vector3()).length()<10);assert.equal(scene.group.position.x,-1e8);assert.equal(scene.pickable[1].material.opacity,.2);}finally{scene.dispose();}
 const radial=transitionGuideScene(spatialTargets('Add_Attractor',{pt:[0,0,4],r:3.5}).targets,'attractor');try{assert.equal(radial.pickable[0].geometry.type,'SphereGeometry');assert.ok(radial.bounds.getSize(new THREE.Vector3()).x>6.9);}finally{radial.dispose();}
});
test('Fit guide frames the requested guide bounds without changing model data or using model extents',()=>{
 const guide=new THREE.Box3(new THREE.Vector3(1,2,3),new THREE.Vector3(5,6,7)),data=guide.clone(),camera=new THREE.PerspectiveCamera(42,1.5,.01,1000);camera.position.set(30,-30,30);
 const viewer={camera,controls:{target:new THREE.Vector3(),update(){}},aspect:1.5,bounds(){throw Error('Fit guide must not use unrelated model bounds.');},radius(){throw Error('Fit guide must use its own radius.');},updateCamera(){},render(){}};
 GeometryViewer.prototype.fit.call(viewer,guide);assert.deepEqual(viewer.controls.target.toArray(),[3,4,5]);assert.ok(camera.position.distanceTo(viewer.controls.target)<50);assert.ok(guide.equals(data));
});
