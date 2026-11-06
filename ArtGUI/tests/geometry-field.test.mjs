import test from 'node:test';
import assert from 'node:assert/strict';
import {geometryFieldError,geometryFieldPreviewWorkflow,geometryFieldFingerprint,influenceTarget,applyInfluenceGeometry} from '../ui/geometry-field-model.js';
import {parseNumericJson,stringifyNumericJson} from '../ui/numeric-json.js';
import {isosurfaceGeometry} from '../ui/field-isosurface.js';
const offset=()=>parseNumericJson('{"Name":"Cylinder","Paras":{"pa":[0.0,0.0,-10.0],"pb":[0.0,0.0,30.0],"r":10.0,"extra":4.0},"min":-5.0,"max":0.0,"min_val":0.0,"max_val":1.0,"min_max_opt":[0.0,0.0],"custom":7.0}');
test('cylinder placement round-trips derived center, height and normalized axis while preserving extras',()=>{
 const p=offset(),t=influenceTarget(p).targets[0];assert.deepEqual(t.geometry.center,[0,0,10]);assert.equal(t.geometry.height,40);
 applyInfluenceGeometry(p,t,{...t.geometry,center:[3,4,5],axis:[0,2,0],height:12,radius:6});assert.deepEqual(p.Paras.pa,[3,-2,5]);assert.deepEqual(p.Paras.pb,[3,10,5]);assert.equal(p.Paras.r,6);assert.equal(p.Paras.extra,4);assert.equal(p.custom,7);assert.equal(p.Paras.center,undefined);assert.match(stringifyNumericJson(p),/3\.0/);
});
test('validation rejects zero axes, nonfinite mappings and reversed manual ranges, retaining automatic ranges',()=>{
 const p=offset();p.Paras.pb=[...p.Paras.pa];assert.match(geometryFieldError('OP_FieldOffset_GeomField',p),/height|Axis|positive/i);
 const q=offset();q.min=q.max;assert.match(geometryFieldError('OP_FieldOffset_GeomField',q),/smaller/);q.min_max_opt=[1,1];assert.equal(geometryFieldError('OP_FieldOffset_GeomField',q),'');q.max_val=NaN;assert.match(geometryFieldError('OP_FieldOffset_GeomField',q),/finite/);
 assert.match(geometryFieldError('OP_GeomSDF_GridField',{inp_meshfile:'',out_gridfieldFile:'SDF'}),/mesh/);
});
test('preview exports only its execution prefix and correct field, without changing the document',()=>{
 const doc={Setup:{res:[1,1,1]},WorkFlow:{'1':{Add_Geometry:{Name:'Sphere'}},'2':{OP_GeomSDF_GridField:{inp_meshfile:'bracket.stl',out_gridfieldFile:'SDF'}},'3':{Export:{outfile:'do-not-write.stl'}},'4':{OP_FieldOffset_GeomField:offset()}},ArtGUI:{files:[]},PostProcess:{CombineMeshes:true}},before=stringifyNumericJson(doc);
 const preview=geometryFieldPreviewWorkflow(doc,'2','preview.h5');assert.deepEqual(preview.workflow.WorkFlow['3'],{Export:{outfile:'preview.h5',GridFieldIDs:['SDF']}});assert.equal(Object.keys(preview.workflow.WorkFlow).length,3);assert.equal(preview.workflow.ArtGUI,undefined);assert.equal(preview.field,'SDF');assert.equal(stringifyNumericJson(doc),before);
 const second=geometryFieldPreviewWorkflow(doc,'4','offset.h5');assert.deepEqual(second.workflow.WorkFlow['4'],{Export:{outfile:'offset.h5'}});assert.equal(second.field,'lattice');
 const signature=geometryFieldFingerprint(doc,'2');doc.Setup.res=[2,2,2];assert.notEqual(signature,geometryFieldFingerprint(doc,'2'));
});
function planes(f){return [-1,0,1].map(z=>({axis:2,position:z,shape:[3,3],varying:[0,1],coordinates:[[-1,0,1],[-1,0,1]],transform:[1,0,0,3,0,1,0,4,0,0,1,5,0,0,0,1],values:Float64Array.from([-1,0,1].flatMap(x=>[-1,0,1].map(y=>f(x,y,z))))}));}
test('inspection isosurfaces honor the scalar level and model transform, with finite triangles',()=>{
 const surface=isosurfaceGeometry(planes((x,y,z)=>x+2*y+3*z),.25);assert.ok(surface.positions.length>0);for(let i=0;i<surface.positions.length;i+=3){const [x,y,z]=surface.positions.slice(i,i+3).map((n,j)=>n+surface.center[j]);assert.ok(Math.abs((x-3)+2*(y-4)+3*(z-5)-.25)<1e-5);}assert.ok([...surface.positions].every(Number.isFinite));
 assert.equal(isosurfaceGeometry(planes(()=>1),0).positions.length,0);assert.throws(()=>isosurfaceGeometry(planes(x=>x),.5,{maxTriangles:1}),/limit/);
});
test('nonfinite cells become gaps and exact grid-plane levels stay finite',()=>{const a=planes(x=>x);a[0].values[0]=NaN;const s=isosurfaceGeometry(a,0);assert.ok([...s.positions].every(Number.isFinite));});
