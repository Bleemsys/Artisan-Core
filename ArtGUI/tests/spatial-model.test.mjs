import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../ui/vendor/three.module.js';
import {spatialTargets,applySpatialGeometry,normalFrame,axisQuaternion,quaternionGeometry,newSpatialBox,replaceSpatialShape,spatialKeywords} from '../ui/spatial-model.js';
import {cloneNumericJson,parseNumericJson,stringifyNumericJson} from '../ui/numeric-json.js';
const near=(a,b,e=1e-7)=>assert.ok(Math.abs(a-b)<e,`${a} != ${b}`);
const context={domain:[[-100,100],[-80,80],[-60,60]],meshBounds:()=>[[10,20,30],[30,60,90]]};
const target=(k,p)=>spatialTargets(k,p,context).targets[0];
const box=()=>parseNumericJson('{"Name":"Box","Paras":{"ori":[3.0,4.0,5.0],"normal":[1.0,2.0,3.0],"length":[8.0,10.0,12.0],"z_angle":0.7},"k_factor":0.6,"push2GeomField":true,"custom":{"keep":7}}');
test('all supported keywords expose input guides without modifying the workflow',()=>{
 for(const k of spatialKeywords){const p=k==='Add_Lattice'?{size:[2,2,2],Rot:[0,0,0],Trans:[0,0,0]}:k==='Proc_BoxSlices'?{Boxes:[box().Paras]}:k==='HS_Interpolate'?{pt:[1,2,3],n_vec:[0,0,2]}:k==='Lin_Interpolate'?{pt_01:[0,0,0],n_vec_01:[0,0,1],pt_02:[0,0,20],n_vec_02:[0,0,-1]}:k==='Add_Attractor'?{pt:[0,0,0],r:20}:box();const before=stringifyNumericJson(p);assert.ok(target(k,p));assert.equal(stringifyNumericJson(p),before);}
});
test('Boolean box resize encodes HALF lengths and preserves unrelated options',()=>{
 for(const k of spatialKeywords.slice(0,3)){const p=box(),t=target(k,p);assert.deepEqual(t.geometry.size,[16,20,24]);const g=cloneNumericJson(t.geometry);g.size[0]=30;g.center=[8,9,10];applySpatialGeometry(k,p,t,g,'resize');assert.deepEqual(p.Paras.length,[15,10,12]);assert.deepEqual(p.Paras.ori,[8,9,10]);assert.equal(p.k_factor,.6);assert.deepEqual(p.custom,{keep:7});assert.ok(stringifyNumericJson(p).includes('15.0'));}
});
test('rotated normal/spin boxes round-trip full orientation for primitives and slices',()=>{
 for(const slices of [false,true])for(const n of [[1,2,3],[0,0,1],[0,0,-1],[1e-8,0,-1],[-2,1,.1]])for(const angle of [0,.8,3,6.2]){
  const p=slices?{Boxes:[{ori:[0,0,0],normal:n,length:[2,3,4],z_angle:angle}]}:{Name:'Box',Paras:{ori:[0,0,0],normal:n,length:[2,3,4],z_angle:angle}},k=slices?'Proc_BoxSlices':'Add_Geometry',t=target(k,p),g=cloneNumericJson(t.geometry),q=new T.Quaternion().setFromAxisAngle(new T.Vector3(1,1,0).normalize(),.3).multiply(axisQuaternion(g));Object.assign(g,quaternionGeometry(q));applySpatialGeometry(k,p,t,g,'rotate');const result=axisQuaternion(target(k,p).geometry);near(q.angleTo(result),0,2e-6);
 }
});
test('slice metadata, target selection and sibling boxes survive edits',()=>{
 const p={Source:'Geometry',Target:'FieldContainer',Boxes:[{FieldID:'A',...box().Paras},{FieldID:'B',...box().Paras,keep:'yes'}]},t=spatialTargets('Proc_BoxSlices',p,context).targets[1],first=JSON.stringify(p.Boxes[0]),g=cloneNumericJson(t.geometry);g.center[2]+=12;applySpatialGeometry('Proc_BoxSlices',p,t,g,'move');assert.equal(JSON.stringify(p.Boxes[0]),first);assert.equal(p.Boxes[1].FieldID,'B');assert.equal(p.Boxes[1].keep,'yes');assert.equal(p.Boxes[1].ori[2],17);assert.equal(p.Target,'FieldContainer');
});
test('cylinder endpoint mapping supports translation, world rotation and one-sided resize',()=>{
 const p={Name:'Cylinder',Paras:{pa:[2,3,4],pb:[2,3,14],r:6}},t=target('Subtract_Geometry',p),g=cloneNumericJson(t.geometry);g.center[0]+=10;applySpatialGeometry('Subtract_Geometry',p,t,g,'move');assert.deepEqual(p.Paras.pa,[12,3,4]);assert.deepEqual(p.Paras.pb,[12,3,14]);g.axis=[0,1,0];applySpatialGeometry('Subtract_Geometry',p,t,g,'rotate');assert.deepEqual(p.Paras.pa,[12,-2,9]);assert.deepEqual(p.Paras.pb,[12,8,9]);g.height=20;g.center[1]+=5;g.radius=8;applySpatialGeometry('Subtract_Geometry',p,t,g,'resize');assert.deepEqual(p.Paras.pa,[12,-2,9]);assert.deepEqual(p.Paras.pb,[12,18,9]);assert.equal(p.Paras.r,8);
});
test('transition planes update points and normals separately, preserving normal length and lattice parameters',()=>{
 const p={pt_01:[0,0,0],n_vec_01:[0,0,2],pt_02:[0,0,20],n_vec_02:[0,0,-3],Rot:[.1,.2,.3],Trans:[4,5,6],size:[8,9,10]},t=target('Lin_Interpolate',p),g=cloneNumericJson(t.geometry);g.center=[9,8,7];applySpatialGeometry('Lin_Interpolate',p,t,g,'move');assert.deepEqual(p.pt_01,g.center);assert.deepEqual(p.n_vec_01,[0,0,2]);Object.assign(g,quaternionGeometry(new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),Math.PI/2)));applySpatialGeometry('Lin_Interpolate',p,t,g,'rotate');near(p.n_vec_01[1],-2);near(Math.hypot(...p.n_vec_01),2);assert.deepEqual(p.pt_02,[0,0,20]);assert.deepEqual(p.n_vec_02,[0,0,-3]);assert.deepEqual(p.Rot,[.1,.2,.3]);assert.deepEqual(p.Trans,[4,5,6]);assert.throws(()=>applySpatialGeometry('Lin_Interpolate',p,t,g,'resize'));
});
test('attractor handles edit only pt/r and keep lattice placement unchanged',()=>{
 const p={pt:[2,3,4],r:12,Rot:[.2,.3,.4],Trans:[10,20,30],Inv:true,thk:.7},t=target('Add_Attractor',p),g={...t.geometry,center:[8,9,10],radius:18};applySpatialGeometry('Add_Attractor',p,t,g,'move');assert.equal(p.r,12);applySpatialGeometry('Add_Attractor',p,t,g,'resize');assert.deepEqual(p.pt,[8,9,10]);assert.equal(p.r,18);assert.deepEqual(p.Trans,[10,20,30]);assert.equal(p.thk,.7);assert.equal(p.Inv,true);
});
test('mesh transform uses scale about source minimum and radians XYZ rotation about scaled centre',()=>{
 const p={Name:'part.stl',Paras:{Scale:[2,3,4],Trans:[5,6,7],Rot:[.2,.3,.4]},keep:9},t=target('Add_Geometry',p);assert.deepEqual(t.geometry.center,[35,86,157]);assert.deepEqual(t.geometry.size,[40,120,240]);near(axisQuaternion(t.geometry).angleTo(new T.Quaternion().setFromEuler(new T.Euler(.2,.3,.4,'XYZ'))),0);const g=cloneNumericJson(t.geometry);g.size[0]=60;g.center[0]+=10;applySpatialGeometry('Add_Geometry',p,t,g,'resize');assert.deepEqual(p.Paras.Scale,[3,3,4]);assert.deepEqual(p.Paras.Trans,[5,6,7]);Object.assign(g,quaternionGeometry(new T.Quaternion().setFromEuler(new T.Euler(.6,.9,-.7,'XYZ'))));applySpatialGeometry('Add_Geometry',p,t,g,'rotate');const r=p.Paras.Rot;near(new T.Quaternion().setFromEuler(new T.Euler(...r,'XYZ')).angleTo(axisQuaternion(g)),0,1e-6);assert.equal(p.keep,9);
});
test('field references and unsupported/invalid geometry remain unmodified with an explanation',()=>{
 for(const p of [{Source:{Type:'Field',ID:'Plate'},Paras:{keep:1}},{Name:'Torus',Paras:{}},{Name:'Sphere',Paras:{ori:[0,0,0],r:-1}},{Name:'part.stl',Paras:{Scale:[0,1,1]}}]){const before=JSON.stringify(p),r=spatialTargets('Intersect_Geometry',p,{domain:context.domain});assert.equal(r.targets.length,0);assert.ok(r.messages.length);assert.equal(JSON.stringify(p),before);}
});
test('new shapes use a valid domain and preserve Boolean options',()=>{
 const b=newSpatialBox(context.domain);assert.deepEqual(b.ori,[0,0,0]);assert.deepEqual(b.length,[25,20,15]);for(const type of ['Box','Sphere','Cylinder']){const p={Source:{Type:'Field',ID:'X'},k_factor:.3};replaceSpatialShape(p,type,context.domain);assert.equal(p.Source,undefined);assert.ok(target('Add_Geometry',p));assert.equal(p.k_factor,.3);}
});
