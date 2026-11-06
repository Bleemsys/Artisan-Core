import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../ui/vendor/three.module.js';
import {parseNumericJson,stringifyNumericJson} from '../ui/numeric-json.js';
import {primitiveMeshError,primitiveMeshWorkflowError,primitiveMeshPoint,displayedPrimitiveValue,setPrimitiveNumber,replacePrimitiveMesh,primitiveMeshPreviewWorkflow} from '../ui/primitive-mesh-model.js';
import {createPrimitiveMeshGeometry} from '../ui/primitive-mesh-geometry.js';
import {primitiveMeshHandles} from '../ui/primitive-mesh-overlay.js';
import {GeometryViewer} from '../ui/viewer.js';

const box=()=>parseNumericJson('{"num_elem":[12,8,6],"x_range":[0.0,60.0],"y_range":[0.0,40.0],"z_range":[0.0,30.0],"ori":[0.0,0.0,0.0],"Normal":[0.0,0.0,1.0],"z_angle":0.0,"Mesh_file":"Box","custom":{"keep":3.0}}');
const cylinder=()=>replacePrimitiveMesh('Gen_BoxMesh','Gen_CylindricalMesh',box());
const sphere=()=>replacePrimitiveMesh('Gen_BoxMesh','Gen_SphericalMesh',box());
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);

test('shared viewport display commands update the primitive guide too',()=>{
  const modes=[],viewer={layers:new Map(),primitiveMeshOverlay:{setDisplay:mode=>modes.push(mode)},render(){}};
  for(const mode of ['solid','wireframe','edges'])GeometryViewer.prototype.setDisplay.call(viewer,mode);
  assert.deepEqual(modes,['solid','wireframe','edges']);assert.equal(viewer.display,'edges');
});

test('degree entry converts to native fractions/radians and preserves integer element counts',()=>{
  const p=cylinder();setPrimitiveNumber(p,'phi_range.1',270);close(p.phi_range[1],.75);assert.equal(displayedPrimitiveValue(p,'phi_range.1'),270);
  const s=sphere();setPrimitiveNumber(s,'theta_range.0',30);close(s.theta_range[0],1/6);assert.equal(displayedPrimitiveValue(s,'theta_range.0'),30);
  const b=box();setPrimitiveNumber(b,'z_angle',90);close(b.z_angle,Math.PI/2);setPrimitiveNumber(b,'num_elem.0',15);
  assert.match(stringifyNumericJson(b),/"num_elem": \[\s*15,/);assert.match(stringifyNumericJson(b),/"ori": \[\s*0\.0,/);assert.throws(()=>setPrimitiveNumber(b,'num_elem.0',1.5));
});
test('validation rejects degenerate ranges, nonfinite numbers, zero normals and invalid counts',()=>{
  for(const mutate of [p=>p.x_range=[3,3],p=>p.Normal=[0,0,0],p=>p.num_elem[1]=0,p=>p.num_elem[2]=1.1,p=>p.ori[0]=Infinity,p=>p.Mesh_file='']){const p=box();mutate(p);assert.ok(primitiveMeshError('Gen_BoxMesh',p));}
  const p=cylinder();p.phi_range=[0,1.1];assert.match(primitiveMeshError('Gen_CylindricalMesh',p),/360/);p.phi_range=[0,.75];p.Height=-1;assert.match(primitiveMeshError('Gen_CylindricalMesh',p),/Height/);
  const s=sphere();s.theta_range=[-.1,.7];assert.match(primitiveMeshError('Gen_SphericalMesh',s),/180/);
  assert.match(primitiveMeshWorkflowError({'7':{Gen_BoxMesh:{}}}),/Step 7/);
});
test('shape changes retain common inputs and unknown parameters without leaking incompatible keys',()=>{
  const p=box(),next=replacePrimitiveMesh('Gen_BoxMesh','Gen_CylindricalMesh',p);
  assert.deepEqual(next.ori,p.ori);assert.deepEqual(next.num_elem,p.num_elem);assert.equal(next.Mesh_file,'Box');assert.deepEqual(next.custom,{keep:3});assert.equal(next.x_range,undefined);assert.equal(next.z_angle,undefined);
  const last=replacePrimitiveMesh('Gen_CylindricalMesh','Gen_SphericalMesh',next);assert.equal(last.Height,undefined);assert.deepEqual(last.phi_range,next.phi_range);assert.deepEqual(last.r_range,next.r_range);
});
test('preview uses local ranges, native rotations, and translated origins',()=>{
  const p=box();p.ori=[5,6,7];setPrimitiveNumber(p,'z_angle',90);
  const point=primitiveMeshPoint('Gen_BoxMesh',p,[2,0,0]);close(point.x,-6);close(point.y,7);close(point.z,7);
  const c=cylinder();assert.deepEqual(primitiveMeshPoint('Gen_CylindricalMesh',c,[10,0,5]).toArray(),[10,0,5]);
  const s=sphere(),v=primitiveMeshPoint('Gen_SphericalMesh',s,[20,Math.PI/2,Math.PI/2]);close(v.x,0);close(v.y,20);close(v.z,0);
});
test('guide surfaces have finite bounds and no diagonal grid edges; large counts are bounded',()=>{
  const p=box(),g=createPrimitiveMeshGeometry('Gen_BoxMesh',p);assert.deepEqual(g.bounds.min.toArray(),[0,0,0]);assert.deepEqual(g.bounds.max.toArray(),[60,40,30]);
  const lines=g.grid.attributes.position.array;for(let i=0;i<lines.length;i+=6){const differences=[0,1,2].filter(j=>Math.abs(lines[i+j]-lines[i+3+j])>1e-5);assert.equal(differences.length,1);}
  p.num_elem=[1000000,1000000,1000000];const large=createPrimitiveMeshGeometry('Gen_BoxMesh',p);assert.equal(large.simplified,true);assert.ok(large.surface.attributes.position.count<=6*48*48*6);assert.deepEqual(p.num_elem,[1000000,1000000,1000000]);
  for(const mesh of [g,large]){mesh.surface.dispose();mesh.grid.dispose();}
});
test('curved sector boundaries and handle paths correspond to editable parameters',()=>{
  for(const [k,p] of [['Gen_CylindricalMesh',cylinder()],['Gen_SphericalMesh',sphere()]]){
    const g=createPrimitiveMeshGeometry(k,p);assert.equal(g.bounds.isEmpty(),false);assert.ok([...g.surface.attributes.position.array].every(Number.isFinite));
    const paths=primitiveMeshHandles(k,p).map(h=>h.path);for(const path of ['r_range.0','r_range.1','phi_range.0','phi_range.1'])assert.ok(paths.includes(path));
    assert.ok(paths.includes(k==='Gen_CylindricalMesh'?'Height':'theta_range.1'));
    p.phi_range=[0,1];const full=createPrimitiveMeshGeometry(k,p);assert.ok(!full.faces.some(f=>f.path.startsWith('phi_range')));g.surface.dispose();g.grid.dispose();full.surface.dispose();full.grid.dispose();
  }
  assert.equal(primitiveMeshHandles('Gen_BoxMesh',box()).length,7);assert.equal(primitiveMeshHandles('Gen_BoxMesh',box(),'move').length,4);
});
test('preview export truncates later steps without changing the saved workflow or output ID',()=>{
  const doc={Setup:{},WorkFlow:{'1':{Define_Lattice:{name:'unit'}},'5':{Gen_BoxMesh:box()},'9':{Add_Lattice:{}}},PostProcess:{}},before=stringifyNumericJson(doc);
  const preview=primitiveMeshPreviewWorkflow(doc,'5','preview.inp');assert.deepEqual(Object.keys(preview.WorkFlow),['1','5']);assert.equal(preview.WorkFlow['5'].Gen_BoxMesh.Mesh_file,'preview.inp');assert.equal(stringifyNumericJson(doc),before);
});
