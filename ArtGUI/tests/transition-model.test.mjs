import test from 'node:test';
import assert from 'node:assert/strict';
import {transitionError,transitionPreviewWorkflow,setTransitionNumber,setPlaneAxis,flipPlane} from '../ui/transition-model.js';
import {parseNumericJson,stringifyNumericJson} from '../ui/numeric-json.js';
const lattice=()=>parseNumericJson('{"la_name":"BCCubic","size":[1.0,1.0,1.0],"thk":0.3,"Rot":[0.1,0.2,0.3],"Trans":[4.0,5.0,6.0],"Fill":true,"Cube_Request":{}}');
test('plane edits and axis changes preserve unnormalized magnitudes, placement and numeric token types',()=>{
 const p={...lattice(),pt_01:[0,0,0],pt_02:[0,0,4],n_vec_01:[0,0,2],n_vec_02:[0,0,-3],custom:{keep:7}},before=JSON.stringify(p.Trans);
 setTransitionNumber(p,'pt_02.0','2.0');assert.deepEqual(p.pt_02,[2,0,4]);setPlaneAxis(p,'n_vec_01','Y');assert.deepEqual(p.n_vec_01,[0,2,0]);flipPlane(p,'n_vec_01');assert.deepEqual(p.n_vec_01,[0,-2,0]);assert.deepEqual(p.n_vec_02,[0,0,-3]);assert.equal(JSON.stringify(p.Trans),before);assert.equal(p.custom.keep,7);assert.match(stringifyNumericJson(p),/2\.0/);assert.equal(transitionError('Lin_Interpolate',p),'');
});
test('cell dimensions link independently of sampling; invalid values and zero normals are rejected',()=>{
 const p={...lattice(),pt:[0,0,0],n_vec:[0,0,2]};setTransitionNumber(p,'size.0','2.5',{linked:true});assert.deepEqual(p.size,[2.5,2.5,2.5]);setTransitionNumber(p,'size.1','3.0');assert.deepEqual(p.size,[2.5,3,2.5]);assert.throws(()=>setTransitionNumber(p,'thk','-1'));assert.throws(()=>setTransitionNumber(p,'n_vec.2','0'));assert.throws(()=>setTransitionNumber(p,'pt.0',''));p.size=[-1,-2,1];setTransitionNumber(p,'size.0','2');assert.equal(p.size[0],2);assert.match(transitionError('HS_Interpolate',p),/Cell size/);
});
test('workflow preview retains prerequisites and commands through the selected step without changing the original',()=>{
 const p={...lattice(),pt:[0,0,0],r:2.5,Inv:false};const doc={Setup:{res:[.2,.2,.2]},WorkFlow:{'1':{Define_Lattice:{la_name:'Custom',definition:{}}},'2':{Add_Lattice:lattice(),Export:{outfile:'keep.stl'}},'3':{Add_Attractor:p},'4':{Subtract_Geometry:{Name:'Sphere'}},'5':{Export:{outfile:'final.stl'}}},PostProcess:{CombineMeshes:true},ArtGUI:{geometry:[]}},before=stringifyNumericJson(doc);
 const copy=transitionPreviewWorkflow(doc,'3','Add_Attractor','preview.stl');assert.equal(Object.keys(copy.WorkFlow).length,4);assert.ok(copy.WorkFlow['1'].Define_Lattice);assert.ok(copy.WorkFlow['2'].Add_Lattice);assert.equal(copy.WorkFlow['2'].Export,undefined);assert.ok(copy.WorkFlow['3'].Add_Attractor);assert.deepEqual(copy.WorkFlow['4'],{Export:{outfile:'preview.stl'}});assert.equal(copy.ArtGUI,undefined);assert.equal(stringifyNumericJson(doc),before);assert.throws(()=>transitionPreviewWorkflow(doc,'4','Add_Attractor','bad.stl'));
});
test('only configured advanced requests require ID and optional Inv remains absent until chosen',()=>{
 const p={...lattice(),pt:[0,0,0],n_vec:[1,0,0]};assert.equal(transitionError('HS_Interpolate',p),'');assert.equal(Object.hasOwn(p,'Inv'),false);p.Cube_Request={ID:0,custom:9};assert.equal(transitionError('HS_Interpolate',p),'');delete p.Cube_Request.ID;assert.match(transitionError('HS_Interpolate',p),/requires ID/);
});
