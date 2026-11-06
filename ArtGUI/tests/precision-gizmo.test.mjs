import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../ui/vendor/three.module.js';
import {createPrecisionGizmo,precisionWorldPerPixel,precisionPlaneDelta,precisionRotationBasis} from '../ui/precision-gizmo.js';
const vector=a=>new THREE.Vector3(...a);
function viewer(orthographic=false){
 const camera=orthographic?new THREE.OrthographicCamera(-150,150,100,-100,.1,10000):new THREE.PerspectiveCamera(45,1.5,.1,10000);
 camera.position.set(120,110,150);camera.lookAt(0,0,0);camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
 return {camera,origin:new THREE.Vector3(),canvas:{getBoundingClientRect:()=>({width:900,height:600,left:0,top:0})}};
}
function screen(view,p){const n=p.clone().sub(view.origin).project(view.camera);return [(n.x+1)*450,(1-n.y)*300];}
function dispose(g){g.group.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});}

test('precision translation supplies both signed directions and three independent world-plane pads',()=>{
 const v=viewer(),g=createPrecisionGizmo(v,{center:new THREE.Vector3(),mode:'move',index:3});
 const moves=g.handles.filter(h=>h.kind==='move'),planes=g.handles.filter(h=>h.kind==='plane');
 assert.equal(moves.length,6);assert.equal(planes.length,3);assert.equal(g.group.children.filter(o=>o.geometry?.type==='ConeGeometry').length,6);
 for(let i=0;i<3;i++)for(const sign of [-1,1]){const h=moves.find(h=>h.axis===i&&h.sign===sign);assert.equal(h.direction.getComponent(i),sign);assert.equal(h.index,3);assert.ok(h.point.length()>0);}
 for(const h of planes){assert.equal(h.axes[0].dot(h.axes[1]),0);assert.ok(Math.abs(h.normal.length()-1)<1e-12);const [x,y]=screen(v,h.point);assert.equal(g.hitTest(x,y)?.kind,'plane');}
 const d=precisionPlaneDelta(vector([3,4,5]),[vector([1,0,0]),vector([0,1,0])]);assert.deepEqual(d.toArray(),[3,4,0]);dispose(g);
});

test('precision controls keep screen extent on orthographic zoom and at a shifted model origin',()=>{
 const v=viewer(true),center=vector([1e6,2e6,-3e6]);v.origin.copy(center);
 const g=createPrecisionGizmo(v,{center,mode:'move'}),h=g.handles.find(h=>h.kind==='move'&&h.axis===0&&h.sign===1);
 const first=screen(v,h.point),world=precisionWorldPerPixel(v,center);v.camera.zoom=4;v.camera.updateProjectionMatrix();g.update();
 const second=screen(v,h.point);first.forEach((n,i)=>assert.ok(Math.abs(n-second[i])<1e-6));assert.ok(Math.abs(precisionWorldPerPixel(v,center)*4-world)<1e-10);dispose(g);
});

test('precision dial exposes one operational axis, 15-degree ticks and a finite sweep for each world axis',()=>{
 const v=viewer();
 for(let axis=0;axis<3;axis++)for(const delta of [0,15,-45,180]){
  const g=createPrecisionGizmo(v,{center:new THREE.Vector3(),mode:'rotate',axis,delta});
  assert.equal(g.handles.filter(h=>h.kind==='rotate').length,1);assert.equal(g.handles.filter(h=>h.kind==='axis-selector'&&h.active).length,1);
  assert.deepEqual(g.handles.find(h=>h.kind==='rotate').normal.toArray(),[0,1,2].map(i=>i===axis?1:0));
  assert.equal(g.handles.find(h=>h.kind==='readout').label,'Δ '+delta.toFixed(1)+'°');
  g.group.traverse(o=>{if(o.geometry?.attributes.position)assert.ok(Array.from(o.geometry.attributes.position.array).every(Number.isFinite));});
  const basis=precisionRotationBasis(axis);assert.ok(new THREE.Vector3().crossVectors(basis.u,basis.v).distanceTo(basis.normal)<1e-12);dispose(g);
 }
});

test('edge-on plane pads disable pointer hits instead of producing an unstable plane intersection',()=>{
 const v=viewer();v.camera.position.set(0,0,200);v.camera.lookAt(0,0,0);v.camera.updateMatrixWorld(true);
 const g=createPrecisionGizmo(v,{center:new THREE.Vector3(),mode:'move'}),planes=g.handles.filter(h=>h.kind==='plane');
 assert.equal(planes.filter(h=>!h.disabled).length,1);assert.equal(planes.find(h=>!h.disabled).label,'XY');dispose(g);
});
