import {test} from 'node:test';
import assert from 'node:assert/strict';
import {quadKeyword,earlierInputs,quadError,quadWorkflowError,updateQuadValue,meshOutput,fieldOutput,quadFingerprint,reportSummary} from '../ui/quad-mesher-model.js';
import {prepareFieldOperation} from '../ui/field-workflow.js';
import {parseNumericJson,stringifyNumericJson,numberType} from '../ui/numeric-json.js';
const fixture=()=>{
 const p=parseNumericJson('{"mesh_file":"Surface","size_field":"Size","export_mesh":"Quads","hausd":0.030}');prepareFieldOperation(quadKeyword,p);
 return {p,w:{'1':{ReadMesh:{MeshID:'Surface',meshfile:'surface.stl',elem_type:'Triangle'}},'2':{ReadGridField:{Gridfield_ID:'Size',FieldID:'StoredName',inp_GridFieldFile:'size.h5'}},'3':{[quadKeyword]:p},'4':{ExportMeshID:{MeshID:'Quads',elem_type:'Quad',out_meshfile:'quad.inp'}},'5':{Define_ScalarField_CombineGeometry:{field_id:'Future'}}}};
};
test('defaults preserve saved numeric tokens and explicit settings',()=>{
 const {p}=fixture();assert.equal(p.split_to_triangles,false);assert.equal(p.surface_tolerance,null);assert.equal(numberType(p,'size_iterations'),'integer');assert.equal(numberType(p,'feature_angle'),'float');assert.match(stringifyNumericJson(p),/0\.030/);
 p.preserve_features=false;prepareFieldOperation(quadKeyword,p);assert.equal(p.preserve_features,false);
});

test('both methods persist without changing shared inputs and invalidate saved results',()=>{
 const {p,w}=fixture(),doc={Setup:{},WorkFlow:w};assert.equal(p.method,'SimpleQuad');
 const before=quadFingerprint(doc,'3'),numeric=stringifyNumericJson(p);
 updateQuadValue(p,'method','Subdivision',w,'3');prepareFieldOperation(quadKeyword,p);
 assert.equal(p.method,'Subdivision');assert.equal(quadError(p,w,'3'),'');
 assert.equal(p.mesh_file,'Surface');assert.equal(p.size_field,'Size');assert.equal(p.export_mesh,'Quads');
 assert.notEqual(quadFingerprint(doc,'3'),before);assert.match(stringifyNumericJson(p),/0\.030/);
 assert.equal(w['4'].ExportMeshID.elem_type,'Quad');
 updateQuadValue(p,'method','Unknown',w,'3');assert.match(quadError(p,w,'3'),/SimpleQuad or Subdivision/);
 p.method=null;assert.match(quadError(p,w,'3'),/SimpleQuad or Subdivision/);
 delete p.method;assert.equal(quadError(p,w,'3'),'');prepareFieldOperation(quadKeyword,p);assert.equal(p.method,'SimpleQuad');
});

test('method labels translate while public identifiers remain stable',async()=>{
 const {translate}=await import('../ui/i18n.js');
 assert.notEqual(translate('Meshing method','zh-CN'),'Meshing method');
 assert.notEqual(translate('Choose SimpleQuad or Subdivision.','zh-CN'),'Choose SimpleQuad or Subdivision.');
 assert.equal(translate('SimpleQuad','zh-CN'),'SimpleQuad');
 assert.equal(translate('Subdivision','zh-CN'),'Subdivision');
});

test('report method names support current and older saved reports',()=>{
 const final={vertices:8,quadrilaterals:6,triangles:0};
 assert.equal(reportSummary({valid:true,final,meshing_method:'Subdivision'}).method,'Subdivision');
 assert.equal(reportSummary({valid:true,final,method:'QuadriFlow layout + conforming scalar-field quad adaptation'}).method,'SimpleQuad');
 assert.equal(reportSummary({valid:true,final,method:'Native MMGS scalar-field adaptation + conforming all-quad subdivision'}).method,'Subdivision');
});
test('selectors use earlier runtime IDs, exclude future fields and removed meshes',()=>{
 const {p,w}=fixture();assert.deepEqual(earlierInputs(w,'3').fields.map(f=>f.id),['Size']);assert.equal(quadError(p,w,'3'),'');
 p.size_field='StoredName';assert.match(quadError(p,w,'3'),/before/);p.size_field='Future';assert.match(quadError(p,w,'3'),/before/);
 w['2'].RemoveMesh={MeshID:'Surface'};assert.equal(earlierInputs(w,'3').meshes.length,0);
});
test('splitting and renaming propagate only matching later exports',()=>{
 const {p,w}=fixture();w['6']={ExportMeshID:{MeshID:'Other',elem_type:'Quad',out_meshfile:'other.inp'}};
 updateQuadValue(p,'split_to_triangles',true,w,'3');assert.equal(w['4'].ExportMeshID.elem_type,'Triangle');assert.equal(w['6'].ExportMeshID.elem_type,'Quad');
 updateQuadValue(p,'export_mesh','Triangles',w,'3');assert.equal(w['4'].ExportMeshID.MeshID,'Triangles');assert.equal(meshOutput(w,'3',p),'quad.inp');assert.equal(quadWorkflowError(w),'');
 updateQuadValue(p,'split_to_triangles',false,w,'3');assert.equal(w['4'].ExportMeshID.elem_type,'Quad');
});
test('format checks prevent quad STL and invalid imports; automatic tolerance is null',()=>{
 const {p,w}=fixture();p.export_mesh='surface.stl';assert.match(quadError(p,w,'3'),/Enable triangle/);p.split_to_triangles=true;assert.equal(quadError(p,w,'3'),'');
 updateQuadValue(p,'surface_tolerance','',w,'3');assert.equal(p.surface_tolerance,null);updateQuadValue(p,'hausd','0.05',w,'3');assert.equal(numberType(p,'hausd'),'float');
 p.max_points=2.5;assert.match(quadError(p,w,'3'),/integer/);p.max_points=10000;p.quality_report='report.txt';assert.match(quadError(p,w,'3'),/JSON/);
 p.quality_report='';p.sampling_size=1;assert.match(quadError(p,w,'3'),/Unsupported/);
});
test('field preview resolves imported file and exported HDF5 without inventing field values',()=>{
 const {w}=fixture();assert.equal(fieldOutput(w,'3','Size'),'size.h5');w['2']={Define_ScalarField_CombineGeometry:{field_id:'Size'}};w['6']={Export:{GridFieldIDs:['Size'],fieldfile:'size-export.h5'}};assert.equal(fieldOutput(w,'3','Size'),'size-export.h5');
});
test('report summary uses output-specific metrics and flags poor quality',()=>{
 const final={vertices:8,quadrilaterals:6,triangles:0,scaled_jacobian_percentiles:[.007,.1,.4,.8,1],edge_to_target_percentiles:[.2,.5,.9,1.2,2],surface_error:{maximum:.1}};
 assert.equal(reportSummary({valid:false,final}),null);let s=reportSummary({valid:true,final,surface_tolerance:.2});assert.equal(s.review,true);assert.equal(s.quality,.007);assert.equal(s.ratio,.9);
 s=reportSummary({valid:true,split_to_triangles:true,final:{...final,quadrilaterals:0,triangles:12,mean_ratio_quality_percentiles:[.2,.3,.5,.8,1]}});assert.equal(s.triangle,true);assert.equal(s.quality,.2);assert.equal(s.review,false);
});
test('report fingerprint includes setup and inputs but ignores later export edits',()=>{
 const {p,w}=fixture(),doc={Setup:{res:[1,1,1]},WorkFlow:w},f=quadFingerprint(doc,'3');w['4'].ExportMeshID.out_meshfile='new.inp';assert.equal(quadFingerprint(doc,'3'),f);p.hgrad=2;assert.notEqual(quadFingerprint(doc,'3'),f);
});

test('morphed and fitted scalar outputs can drive later meshing steps',()=>{
 const w={'1':{OP_Fit_GridField:{out_gridFieldFile:'Fit'}},'2':{Proc_Field_Morph:{output_field:'Morphed'}},'3':{Gen_QuadMesh_SizeField:{}}};
 assert.deepEqual(earlierInputs(w,'3').fields.map(f=>f.id),['Fit','Morphed']);
});
