import {test} from 'node:test';
import assert from 'node:assert/strict';
import {defaultGeometry,geometryError,geometryBounds,resizeGeometry,boxAxes,coverageWarning,scalarFieldError,fieldPreviewWorkflow} from '../ui/region-model.js';
import {parseNumericJson,stringifyNumericJson} from '../ui/numeric-json.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
test('all primitive defaults accept fractional domains and encode real-valued coordinates',()=>{
 for(const type of ['Box','Cylinder','Sphere']){const g=defaultGeometry(type,[[-1,4],[-1,4],[-1,4]]);assert.equal(geometryError(g),'');assert.deepEqual(g.center,[1.5,1.5,1.5]);assert.match(stringifyNumericJson(g),/1.5/);}
 assert.match(stringifyNumericJson(defaultGeometry('Box')),/20.0/);
});
test('legacy mesh files and IDs remain unchanged; typed Mesh uses source only',()=>{
 const p=parseNumericJson('{"field_id":"Mask","default_value":0.0,"overlap":"Maximum","regions":[{"geometry":"body.inp","value":1.0}]}');const before=stringifyNumericJson(p);
 assert.equal(scalarFieldError(p),'');assert.equal(stringifyNumericJson(p),before);assert.equal(geometryError('MeshID'),'');assert.equal(geometryError({type:'Mesh',source:'body.inp'}),'');assert.ok(geometryError({type:'Mesh',file:'body.inp'}));
});
test('reject invalid dimensions, nonfinite numbers, zero axes and unknown geometry keys',()=>{
 for(const g of [{type:'Sphere',center:[0,0,0],radius:0},{type:'Cylinder',center:[0,0,0],radius:2,height:3,axis:[0,0,0]},{type:'Box',center:[0,0,0],size:[1,2,-3]},{type:'Sphere',center:[0,NaN,0],radius:1},{type:'Sphere',center:[0,0,0],radius:2,rotation:1}])assert.ok(geometryError(g));
});
test('rotated box bounds match its transformed corners',()=>{
 const g={type:'Box',center:[10,20,30],size:[2,4,6],rotation_axis:[0,0,2],rotation_degrees:90},b=geometryBounds(g);
 [8,19,27].forEach((n,i)=>near(b[0][i],n));[12,21,33].forEach((n,i)=>near(b[1][i],n));
});
test('tilted capped cylinder bounds include axial and radial extents',()=>{
 const g={type:'Cylinder',center:[0,0,0],axis:[1,1,0],radius:2,height:10},b=geometryBounds(g);near(b[1][0],7/Math.sqrt(2));near(b[1][1],7/Math.sqrt(2));near(b[1][2],2);
});
test('box face and cylinder end drags preserve the opposite face, including negative handles',()=>{
 const g={type:'Box',center:[0,0,0],size:[10,20,30],rotation_axis:[0,0,1],rotation_degrees:90},axis=boxAxes(g)[0].map(v=>-v),next=resizeGeometry(g,0,-1,4,axis);
 near(next.size[0],14);near(next.center[1],-2);near(next.center[1]+next.size[0]/2,5);assert.equal(g.size[0],10);
 const cylinder={type:'Cylinder',center:[0,0,20],axis:[0,0,1],radius:3,height:10},end=resizeGeometry(cylinder,'height',1,6,[0,0,1]);near(end.height,16);near(end.center[2],23);near(end.center[2]-end.height/2,15);
});
test('radius drag and snapping retain center and dimensions stay positive',()=>{
 const g={type:'Sphere',center:[1,2,3],radius:5};const next=resizeGeometry(g,'radius',1,1.6,[1,0,0],1);assert.equal(next.radius,7);assert.deepEqual(next.center,g.center);assert.ok(resizeGeometry(g,'radius',1,-99,[1,0,0]).radius>0);
});
test('coverage warning includes outward transition and leaves sampling settings alone',()=>{
 const s={Type:'Sample',Sample:{Domain:[[-5,5],[-5,5],[-5,5]]}},before=JSON.stringify(s);assert.equal(coverageWarning({geometry:{type:'Sphere',center:[0,0,0],radius:4},transition_width:0},s),'');assert.ok(coverageWarning({geometry:{type:'Sphere',center:[0,0,0],radius:4},transition_width:2},s));assert.equal(JSON.stringify(s),before);
});
test('field preview excludes downstream morphing and all earlier mesh exports without modifying saved JSON',()=>{
 const doc={Setup:{Type:'Sample'},WorkFlow:{'1':{Read: {path:'body.inp'}},'2':{Export:{outfile:'body.stl'}},'3':{Define_ScalarField_CombineGeometry:{field_id:'Mask',default_value:0,overlap:'Maximum',regions:[{geometry:{type:'Sphere',center:[0,0,0],radius:4},value:1}]}},'4':{Proc_Field_Morph:{input_field:'Body'}}},PostProcess:{CombineMeshes:true},ArtGUI:{version:1}};
 const before=JSON.stringify(doc),preview=fieldPreviewWorkflow(doc,'3','preview.h5');assert.equal(JSON.stringify(doc),before);assert.equal(preview.ArtGUI,undefined);assert.deepEqual(Object.values(preview.WorkFlow).map(s=>Object.keys(s)[0]),['Read','Define_ScalarField_CombineGeometry','Export']);assert.deepEqual(preview.WorkFlow['3'].Export,{outfile:'preview.h5',GridFieldIDs:['Mask']});assert.equal(preview.PostProcess.CombineMeshes,false);
});
