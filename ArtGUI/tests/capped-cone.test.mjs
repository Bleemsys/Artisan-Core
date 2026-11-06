import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {cappedConeRadius,primitiveMeshError,replacePrimitiveMesh,setPrimitiveNumber,displayedPrimitiveValue,primitiveMeshPreviewWorkflow} from '../ui/primitive-mesh-model.js';
import {createPrimitiveMeshGeometry} from '../ui/primitive-mesh-geometry.js';
const profiles=JSON.parse(readFileSync(new URL('./fixtures/capped-cone-profiles.json',import.meta.url),'utf8'));
const cone=()=>({num_elem:[2,8,10],r_range:[16,20],phi_range:[0,1],ori:[0,0,0],Height:40,Normal:[0,0,1],r_bottom:10,UB_heightRatio:.3,Preserve_thickness:false,Mesh_file:'ConeMesh'});
// Profiles were measured from exports of the installed Artisan executable,
// including its origin-end convention; they are independent of the guide code.
for(const name of Object.keys(profiles))test('cone guide matches native '+name+' radius profiles',()=>{
 const p=cone();p.Preserve_thickness=name==='constant';if(name==='full-taper')p.UB_heightRatio=0;
 for(const [z,inner,outer] of profiles[name])for(const [r,expected] of [[16,inner],[20,outer]])assert.ok(Math.abs(cappedConeRadius(p,r,z)-expected)<1e-6);
 const g=createPrimitiveMeshGeometry('Gen_CappedConeMesh',p);
 assert.ok([...g.surface.attributes.position.array].every(Number.isFinite));assert.equal(g.bounds.min.z,0);assert.equal(g.bounds.max.z,40);g.surface.dispose();g.grid.dispose();
});
test('cone edits preserve native fractions, booleans, and valid preview-only workflow exports',()=>{
 const p=cone();setPrimitiveNumber(p,'UB_heightRatio',45);assert.equal(p.UB_heightRatio,.45);assert.equal(displayedPrimitiveValue(p,'UB_heightRatio'),45);
 for(const mutate of [q=>q.UB_heightRatio=1,q=>q.r_bottom=-1,q=>q.Preserve_thickness='true',q=>{q.Preserve_thickness=true;q.r_bottom=2;}]){const q=cone();mutate(q);assert.ok(primitiveMeshError('Gen_CappedConeMesh',q));}
 const cylinder=replacePrimitiveMesh('Gen_CappedConeMesh','Gen_CylindricalMesh',p);assert.equal(cylinder.UB_heightRatio,undefined);assert.equal(cylinder.Preserve_thickness,undefined);assert.equal(cylinder.Height,40);
 const next=replacePrimitiveMesh('Gen_CylindricalMesh','Gen_CappedConeMesh',cylinder);assert.equal(next.Preserve_thickness,false);assert.equal(primitiveMeshError('Gen_CappedConeMesh',next),'');
 const doc={Setup:{},WorkFlow:{'1':{Gen_CappedConeMesh:p},'2':{Add_Lattice:{}}},PostProcess:{}};const preview=primitiveMeshPreviewWorkflow(doc,'1','preview.inp');assert.deepEqual(Object.keys(preview.WorkFlow),['1']);assert.equal(preview.WorkFlow['1'].Gen_CappedConeMesh.Mesh_file,'preview.inp');assert.equal(p.Mesh_file,'ConeMesh');
});
