import {test} from 'node:test';
import assert from 'node:assert/strict';
import {newMorph,newMotion,morphError,morphWorkflowError,transformPoint,upstreamFields,newMaskDefinition,morphPreviewWorkflow,morphWarnings} from '../ui/morph-model.js';
import {cloneNumericJson,stringifyNumericJson,parseNumericJson} from '../ui/numeric-json.js';
const valid=()=>({...newMorph(),input_field:'Body',domain_mask:'Domain',fixed_mask:'Fixed',moving_regions:[newMotion('Moving')]});
const mask=(id,center=[0,0,0])=>({Define_ScalarField_CombineGeometry:{field_id:id,default_value:0,overlap:'Maximum',regions:[{geometry:{type:'Box',center,size:[10,10,10]},value:1,transition_width:0}]}});
const doc=()=>({Setup:{Type:'Sample',Sample:{Domain:[[-50,50],[-50,50],[-50,50]]}},WorkFlow:{'1':{OP_GeomSDF_GridField:{inp_meshfile:'body.inp',out_gridfieldFile:'Body'}},'2':mask('Domain'),'3':mask('Fixed',[0,0,-25]),'4':mask('Moving',[0,0,25]),'5':{Proc_Field_Morph:valid()},'6':{Export:{outfile:'production.stl'}},'7':{Proc_Field_Morph:{}}},PostProcess:{CombineMeshes:true},ArtGUI:{version:1}});
test('morph defaults agree with optional backend defaults, without adding unsupported operations',()=>{
  assert.equal(Object.hasOwn(newMorph(),'threads'),false);assert.equal(morphError(valid()),'');assert.equal(morphError({domain_mask:'Domain',moving_regions:[{mask:'Moving'}]}),'');
  for(const key of ['bending','twisting','scale','compression','threads'])assert.match(morphError({...valid(),[key]:1}),/Unsupported/);
  assert.match(morphError(newMorph()),/domain mask/);
});
test('rejects conflicting masks, output mask overwrite and malformed motion',()=>{
  const p=valid();for(const id of ['Domain','Fixed','lattice','']){p.moving_regions[0].mask=id;assert.notEqual(morphError(p),'');}
  assert.match(morphError({...valid(),output_field:'Moving'}),/overwrite/);
  assert.match(morphError({...valid(),output_field:'file.h5'}),/filename/);
  assert.match(morphError({...valid(),moving_regions:[newMotion('Moving'),newMotion('Moving')]}),/each moving mask/);
  for(const motion of [{rotation_axis:[0,0,0]},{translation:[1,2]},{rotation_center:[NaN,0,0]},{rotation_degrees:Infinity},{scale:2}])assert.notEqual(morphError({...valid(),moving_regions:[{...newMotion('Moving'),...motion}]}),'');
  assert.match(morphWorkflowError({'2':{Proc_Field_Morph:{}}}),/Step 2/);
});
test('solver validation keeps backend bounds and integer controls',()=>{
  for(const [key,values] of Object.entries({mask_threshold:[0,1.01],max_gradient:[0,1],max_control_points:[15,2049,20.5],support_radius:[-1],inverse_tolerance:[0],inverse_iterations:[0,1001,1.2],max_grid_points:[26,27.5],quality_report:['result.txt']}))for(const value of values)assert.notEqual(morphError({...valid(),[key]:value}),'',`${key}=${value}`);
  assert.equal(morphError({...valid(),mask_threshold:1,max_gradient:.99}),'');
});

test('stages defaults to one, validates positive integers and survives preview serialization',()=>{
  assert.equal(newMorph().stages,1);
  for(const stages of [0,-1,1.5,true,'3',null,Infinity])assert.match(morphError({...valid(),stages}),/stages/);
  assert.equal(morphError({...valid(),stages:12}),'');
  const d=doc();d.WorkFlow['5'].Proc_Field_Morph.stages=12;
  const preview=morphPreviewWorkflow(d,'5','out.h5');
  const saved=parseNumericJson(stringifyNumericJson(preview.workflow));
  assert.equal(saved.WorkFlow['5'].Proc_Field_Morph.stages,12);
  assert.equal(d.WorkFlow['5'].Proc_Field_Morph.stages,12);
});
test('rigid target rotates around original pivot, then translates, including nonunit axes',()=>{
  const r={mask:'Moving',rotation_center:[10,0,0],rotation_axis:[0,0,5],rotation_degrees:90,translation:[2,3,4]};
  const out=transformPoint([12,0,0],r);out.forEach((n,i)=>assert.ok(Math.abs(n-[12,5,4][i])<1e-12));
  assert.deepEqual(transformPoint([1,2,3],newMotion('Moving')),[1,2,3]);
});
test('field suggestions use earlier definitions and the most recent producer',()=>{
  const d=doc();d.WorkFlow['4']=mask('Domain',[1,2,3]);const fields=upstreamFields(d.WorkFlow,'5');
  assert.deepEqual(fields.map(f=>f.id),['Body','Domain','Fixed']);assert.equal(fields.find(f=>f.id==='Domain').key,'4');
});
test('new mask names avoid collisions and separate fixed and moving default locations',()=>{
  const d=doc(),domain=newMaskDefinition('domain_mask',d.Setup,d.WorkFlow),fixed=newMaskDefinition('fixed_mask',d.Setup,d.WorkFlow),moving=newMaskDefinition('moving',d.Setup,d.WorkFlow);
  assert.equal(domain.overlap,'Maximum');assert.equal(domain.default_value,0);assert.equal(domain.regions[0].value,1);
  assert.ok(fixed.regions[0].geometry.center[2]<moving.regions[0].geometry.center[2]);
  d.WorkFlow['8']=mask('MovingRegion');assert.equal(newMaskDefinition('moving',d.Setup,d.WorkFlow).field_id,'MovingRegion2');
});
test('preview runs through selected morph, isolates report and exports, and leaves original JSON intact',()=>{
  const d=doc(),before=stringifyNumericJson(d),preview=morphPreviewWorkflow(d,'5','C:/preview/result.h5',{surface:true}),steps=Object.values(preview.workflow.WorkFlow);
  assert.equal(steps.length,6);assert.equal(preview.mesh,'C:/preview/result.stl');assert.equal(preview.report,'C:/preview/result-quality.json');
  assert.deepEqual(steps.at(-1).Export.GridFieldIDs,['Body','Domain','Fixed','Moving']);assert.equal(steps[4].Proc_Field_Morph.quality_report,preview.report);
  assert.equal(preview.workflow.ArtGUI,undefined);assert.equal(preview.workflow.PostProcess.RemoveIsolatedParts,false);assert.equal(stringifyNumericJson(d),before);
});
test('named-output preview exports that field and does not force it into lattice',()=>{
  const d=doc();d.WorkFlow['5'].Proc_Field_Morph.output_field='Morphed';const preview=morphPreviewWorkflow(d,'5','out.hdf5',{surface:true});
  assert.equal(preview.mesh,null);assert.equal(preview.field,'Morphed');assert.equal(preview.workflow.PostProcess.CombineMeshes,false);
  assert.equal(preview.workflow.WorkFlow['5'].Proc_Field_Morph.output_field,'Morphed');assert.ok(preview.workflow.WorkFlow['6'].Export.GridFieldIDs.includes('Morphed'));
});
test('preview validates upstream commands, accepts incomplete downstream and keeps decimal motion values',()=>{
  const d=doc();d.WorkFlow['5'].Proc_Field_Morph.moving_regions[0].translation=[.125,0,0];
  const p=morphPreviewWorkflow(d,'5','out.h5');assert.equal(parseNumericJson(stringifyNumericJson(p.workflow)).WorkFlow['5'].Proc_Field_Morph.moving_regions[0].translation[0],.125);
  d.WorkFlow['3'].Define_ScalarField_CombineGeometry.regions[0].geometry.size=[-1,1,1];assert.throws(()=>morphPreviewWorkflow(d,'5','out.h5'),/box dimensions/);
  assert.throws(()=>morphPreviewWorkflow(doc(),'5','out.stl'),/HDF5/);
});
test('target extent and non-mask scalar values surface as warnings without silently changing settings',()=>{
  const d=doc(),p=d.WorkFlow['5'].Proc_Field_Morph;p.moving_regions[0].translation=[100,0,0];d.WorkFlow['3'].Define_ScalarField_CombineGeometry.regions[0].value=2;
  const warnings=morphWarnings(p,d.WorkFlow,'5',d.Setup);assert.ok(warnings.some(s=>s.includes('sampling box')));assert.ok(warnings.some(s=>s.includes('0 and 1')));
});
