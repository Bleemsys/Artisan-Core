import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {prepareFieldOperation,tetFieldKeyword,quadFieldKeyword} from '../ui/field-workflow.js';
import {parseNumericJson,stringifyNumericJson} from '../ui/numeric-json.js';
import {mesherError,mesherWorkflowError,mesherDraftWorkflow,applyMesherDraft,sizeFieldView,mesherRunWorkflow,mesherReportSummary,mesherKeys} from '../ui/size-field-mesher-model.js';
function fixture(keyword=tetFieldKeyword){const p=parseNumericJson('{"mesh_file":"Solid","size_field":"CellSize","export_mesh":"MeshOut","sampling_size":0.75,"hausd":0.030}');if(keyword===quadFieldKeyword)delete p.sampling_size;prepareFieldOperation(keyword,p);const workflow={'1':{ReadMesh:{MeshID:'Solid',meshfile:'solid.inp',elem_type:'Triangle'}},'2':{Define_ScalarField_CombineGeometry:{field_id:'CellSize',default_value:1,regions:[]}},'3':{[keyword]:p},'4':{ExportMeshID:{MeshID:'MeshOut',elem_type:keyword===tetFieldKeyword?'Tet':'Quad',out_meshfile:'out.inp'}}};return {p,workflow,doc:{Setup:{res:[.25,.25,.25]},WorkFlow:workflow,ArtGUI:{keep:true}}};}

test('shared mesher validation retains the two different input contracts',()=>{
  for(const keyword of [tetFieldKeyword,quadFieldKeyword]){const {p,workflow}=fixture(keyword);assert.equal(mesherError(keyword,p,workflow,'3'),'');assert.equal(mesherWorkflowError(workflow),'');p.size_field='Future';workflow['5']={ReadGridField:{Gridfield_ID:'Future',FieldID:'Stored',inp_GridFieldFile:'future.h5'}};assert.match(mesherError(keyword,p,workflow,'3'),/before this step/);}
  assert.ok(mesherKeys(tetFieldKeyword).includes('sampling_size'));assert.ok(!mesherKeys(quadFieldKeyword).includes('sampling_size'));assert.ok(!mesherKeys(tetFieldKeyword).includes('method'));
});
test('Tet rejects invalid seed sizes, limits and surface-only output without changing the workflow',()=>{
  for(const [key,value,pattern] of [['sampling_size',0,/seed/],['sampling_size',Infinity,/seed/],['max_points',3,/Vertex/],['size_iterations',2.5,/integer/],['surface_tolerance',-1,/tolerance/],['export_mesh','out.stl',/Tet volume/]]){const {p,workflow}=fixture();p[key]=value;const before=structuredClone(workflow);assert.match(mesherError(tetFieldKeyword,p,workflow,'3'),pattern);assert.deepEqual(workflow,before);}
});
test('previewing draft export changes is atomic and committing propagates compatible references',()=>{
  const {p,workflow}=fixture(quadFieldKeyword),before=stringifyNumericJson(workflow),draft=parseNumericJson(stringifyNumericJson(p));draft.export_mesh='NewMesh';draft.split_to_triangles=true;
  const copy=mesherDraftWorkflow(workflow,'3',quadFieldKeyword,draft);assert.equal(stringifyNumericJson(workflow),before);assert.equal(copy['4'].ExportMeshID.MeshID,'NewMesh');assert.equal(copy['4'].ExportMeshID.elem_type,'Triangle');assert.equal(mesherError(quadFieldKeyword,draft,copy,'3'),'');
  applyMesherDraft(p,draft,workflow,'3',quadFieldKeyword);assert.equal(workflow['4'].ExportMeshID.elem_type,'Triangle');assert.match(stringifyNumericJson(p),/0\.030/);
});
test('Tet mesh IDs propagate to conformal definitions and exports while preserving extra parameters',()=>{
  const {p,workflow}=fixture();p.extra={value:1};workflow['5']={Define_Lattice:{la_name:'Infill',definition:{type:'ConformalLattice',definition:{meshfile:'MeshOut',la_name:'Icosahedral'}}}};
  const draft=parseNumericJson(stringifyNumericJson(p));draft.export_mesh='NewTets';applyMesherDraft(p,draft,workflow,'3',tetFieldKeyword);
  assert.equal(workflow['5'].Define_Lattice.definition.definition.meshfile,'NewTets');assert.equal(workflow['4'].ExportMeshID.elem_type,'Tet');assert.equal(p.extra.value,1);assert.match(stringifyNumericJson(p),/0\.030/);
});
test('View field resolves a ReadGridField alias to the actual stored dataset',()=>{
  const {workflow}=fixture();workflow['2']={ReadGridField:{Gridfield_ID:'CellSize',FieldID:'StoredSize',inp_GridFieldFile:'data.h5'}};
  assert.deepEqual(sizeFieldView(workflow,'3','CellSize'),{path:'data.h5',storedId:'StoredSize',fieldId:'CellSize',producerKey:'2'});assert.equal(sizeFieldView(workflow,'3','Wrong'),null);
});
test('View field only chooses an export for this field version, not an unrelated or overwritten field',()=>{
  const {workflow}=fixture();workflow['4']={Export:{outfile:'unrelated.h5',GridFieldIDs:['Other']}};workflow['5']={Export:{outfile:'mesh.stl',fieldfile:'size.h5',GridFieldIDs:['CellSize']}};
  assert.equal(sizeFieldView(workflow,'3','CellSize').path,'size.h5');workflow['4']={Define_ScalarField_CombineGeometry:{field_id:'CellSize'}};assert.equal(sizeFieldView(workflow,'3','CellSize').path,'');assert.equal(sizeFieldView(workflow,'3','CellSize',[{fieldId:'CellSize',path:'attached.h5'}]).path,'attached.h5');
});
test('Generate mesh runs only prerequisites and the selected mesher and preserves explicit field exports',()=>{
  const {doc}=fixture();doc.WorkFlow={'1':doc.WorkFlow['1'],'2':doc.WorkFlow['2'],'3':{Export:{outfile:'unrelated.stl',fieldfile:'field.h5',GridFieldIDs:['CellSize']}},'4':doc.WorkFlow['3'],'5':{Add_Lattice:{la_name:'Later'}}};
  const before=stringifyNumericJson(doc),run=mesherRunWorkflow(doc,'4',tetFieldKeyword,'preview.inp','preview-quality.json');
  assert.equal(stringifyNumericJson(doc),before);assert.equal(run.ArtGUI,undefined);assert.equal(run.WorkFlow['3'].Export.outfile,'field.h5');assert.equal(run.WorkFlow['3'].Export.fieldfile,undefined);assert.equal(run.WorkFlow['4'][tetFieldKeyword].quality_report,'preview-quality.json');assert.equal(run.WorkFlow['5'].ExportMeshID.elem_type,'Tet');assert.equal(Object.values(run.WorkFlow).some(step=>step.Add_Lattice),false);
});
test('file outputs are generated at the requested path without inventing a mesh ID',()=>{
  const {p,doc}=fixture();p.export_mesh='tet.inp';const run=mesherRunWorkflow(doc,'3',tetFieldKeyword,'tet.inp','q.json');assert.equal(Object.keys(run.WorkFlow).length,3);assert.equal(run.WorkFlow['3'][tetFieldKeyword].export_mesh,'tet.inp');
});
test('Tet quality summary uses real public-output keys including boundary_error',()=>{
  const report=JSON.parse(readFileSync(new URL('./fixtures/tet-size-field-report.json',import.meta.url),'utf8')),summary=mesherReportSummary(tetFieldKeyword,report);
  assert.equal(summary.vertices,1017);assert.equal(summary.tetrahedra,4727);assert.equal(summary.surface,report.final.boundary_error.maximum);assert.equal(summary.quality,report.final.mean_ratio_quality_percentiles[0]);assert.equal(mesherReportSummary(tetFieldKeyword,{...report,valid:false}),null);
});
