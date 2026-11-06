import test from 'node:test';
import assert from 'node:assert/strict';
import {fieldMergeError,fieldMergeModeParameters,switchFieldMergeMode,earlierMergeFields,fieldMergePreviewWorkflow,fieldMergeTargets,applyFieldMergeGeometry} from '../ui/field-merge-model.js';
import {parseNumericJson,stringifyNumericJson,cloneNumericJson} from '../ui/numeric-json.js';
const base=()=>parseNumericJson('{"la_name":"BCCubic","size":[4.0,4.0,4.0],"thk":0.4,"Rot":[0.0,0.0,0.0],"Trans":[0.0,0.0,0.0],"Fill":true,"Cube_Request":{},"OP_para":{"InterpType":"Attractor","pt_att":[4.0,4.0,4.0],"pt_r":3.0,"Transition":{}},"custom":{"keep":7.0}}');
test('merge modes retain foreign parameters, bridge data and float representation',()=>{
  const p=base();p.OP_para.custom_mode={preserve:3};p.OP_para.Transition={la_name:'Cubic',size:[4,4,4],thk:.3,Weight:.2,f_trans:.5,extra:2};const old=cloneNumericJson(p.OP_para);
  switchFieldMergeMode(p,'Linear',null,[[0,8],[0,8],[0,8]]);assert.equal(fieldMergeError(p),'');assert.equal(p.OP_para.custom_mode.preserve,3);assert.equal(p.OP_para.Transition.extra,2);assert.equal(p.OP_para.pt_r,undefined);
  switchFieldMergeMode(p,'Attractor',old);assert.deepEqual(p.OP_para.pt_att,[4,4,4]);assert.equal(p.OP_para.pt_r,3);assert.equal(p.custom.keep,7);assert.match(stringifyNumericJson(p),/"pt_r": 3\.0/);
});
test('field references are upstream names while file outputs and future names are excluded',()=>{
  const w={'1':{ReadGridField:{Gridfield_ID:'Loaded',FieldID:'SavedName'}},'2':{OP_ExprOperation_GridField:{out_gridFieldFile:'Expr'}},'3':{OP_GeomSDF_GridField:{out_gridfieldFile:'Distance'}},'4':{OP_Fit_GridField:{out_gridFieldFile:'./out.csv'}},'5':{Define_ScalarField_CombineGeometry:{field_id:'Future'}}};
  assert.deepEqual(earlierMergeFields(w,'5').map(f=>f.id),['Loaded','Expr','Distance']);
  const p=base();p.OP_para={InterpType:'Field',FieldFile:'Loaded',min_cap:0,max_cap:1,Transition:{}};assert.equal(fieldMergeError(p,w,'5'),'');p.OP_para.FieldFile='Future';assert.match(fieldMergeError(p,w,'5'),/before/);p.OP_para.FieldFile='./sample.csv';assert.equal(fieldMergeError(p,w,'5'),'');
});
test('zero normals, reversed radii and thresholds block generation without inventing bridge bounds',()=>{
  const p=base();p.OP_para=fieldMergeModeParameters('Linear');p.OP_para.n_vec_01=[0,0,0];assert.match(fieldMergeError(p),/zero/);
  p.OP_para=fieldMergeModeParameters('Annulus');p.OP_para.inner_r=p.OP_para.outer_r;assert.match(fieldMergeError(p),/Outer/);
  p.OP_para={InterpType:'Field',FieldFile:'Values',min_cap:5,max_cap:4,Transition:{}};assert.match(fieldMergeError(p),/threshold/);
  p.OP_para.min_cap=0;p.OP_para.Transition={la_name:'BC',size:[2,2,2],thk:1,Weight:3,f_trans:-1};assert.equal(fieldMergeError(p),'');
});
test('annulus movement shares a center and resizing preserves ordered native radii',()=>{
  const p=base();p.OP_para={InterpType:'Annulus',pt_att:[4,4,4],inner_r:2,outer_r:3,Transition:{}};let targets=fieldMergeTargets(p);
  applyFieldMergeGeometry(p,targets[0],{...targets[0].geometry,center:[1,2,3]},'move');assert.deepEqual(p.OP_para.pt_att,[1,2,3]);assert.deepEqual(fieldMergeTargets(p).map(t=>t.geometry.center),[[1,2,3],[1,2,3]]);
  targets=fieldMergeTargets(p);applyFieldMergeGeometry(p,targets[0],{...targets[0].geometry,radius:9},'resize');assert.ok(p.OP_para.inner_r<p.OP_para.outer_r);
  applyFieldMergeGeometry(p,targets[1],{...targets[1].geometry,radius:.1},'resize');assert.ok(p.OP_para.inner_r<p.OP_para.outer_r);assert.equal(fieldMergeError(p),'');
});
test('preview runs a prefix, retains required field exports and leaves the project unchanged',()=>{
  const p=base(),doc={Setup:{},ArtGUI:{keep:'project'},WorkFlow:{'1':{OP_ExprOperation_GridField:{out_gridFieldFile:'Original'}},'2':{Export:{outfile:'unrelated.stl',fieldfile:'saved.h5',GridFieldIDs:['Original']}},'3':{ReadGridField:{inp_GridFieldFile:'saved.h5',Gridfield_ID:'Loaded'}},'4':{OP_FieldMerge:p},'5':{Export:{outfile:'do-not-run.stl'}}},PostProcess:{CombineMeshes:true,RemovePartitionMeshFile:true,RemoveIsolatedParts:true}},before=stringifyNumericJson(doc);
  const preview=fieldMergePreviewWorkflow(doc,'4','preview.h5');assert.equal(stringifyNumericJson(doc),before);assert.equal(preview.ArtGUI,undefined);assert.deepEqual(preview.WorkFlow['2'],{Export:{outfile:'saved.h5',GridFieldIDs:['Original']}});assert.equal(preview.WorkFlow['5'].Export.outfile,'preview.h5');assert.equal(JSON.stringify(preview).includes('do-not-run'),false);assert.equal(preview.PostProcess.RemovePartitionMeshFile,false);
});
