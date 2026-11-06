import {slotWorkflowError} from '../ui/slot-model.js';
import {contourWorkflowError} from '../ui/contour-model.js';
import {geometryFieldWorkflowError} from '../ui/geometry-field-model.js';
import {fieldMergeWorkflowError} from '../ui/field-merge-model.js';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {scalarWorkflowError} from '../ui/region-model.js';
import {morphWorkflowError} from '../ui/morph-model.js';
import {latticeWorkflowError as latticePanelWorkflowError} from '../ui/lattice-model.js';
import {transitionWorkflowError} from '../ui/transition-model.js';
import {mesherWorkflowError as quadWorkflowError} from '../ui/size-field-mesher-model.js';
import {primitiveMeshWorkflowError} from '../ui/primitive-mesh-model.js';

const source=readFileSync(new URL('../ui/app.js',import.meta.url),'utf8');
const save=source.slice(source.indexOf('  async function saveProject('),source.indexOf('  async function cleanScratch('));
const clean=source.slice(source.indexOf('  async function cleanScratch('),source.indexOf('  function showSettings('));
function harness(overrides={}){
  const nodes=new Map(),messages=[],calls=[];
  const context={
    runProgress:{busy:false},exportWorkflowError:()=>'',scalarWorkflowError,morphWorkflowError,transitionWorkflowError,latticePanelWorkflowError,quadWorkflowError,primitiveMeshWorkflowError,geometryFieldWorkflowError,fieldMergeWorkflowError,contourWorkflowError,slotWorkflowError,doc:{WorkFlow:{}},exportDrafts:new WeakMap(),applyLatticeDraft:null,
    workflowJson:()=>'{"Setup":{},"WorkFlow":{}}\n',currentPath:'C:/work/original.json',dirty:true,
    $:id=>{if(!nodes.has(id))nodes.set(id,{disabled:false,classList:{toggle(){}}});return nodes.get(id);},
    nameForPath:p=>p.split(/[\\/]/).pop(),toast:message=>messages.push(message),t:message=>message,
    invoke:async(command,args)=>{calls.push({command,args});return 'C:/work/copy.json';},
    cleaningScratch:false,preparingGeneration:false,scratchPreviewFolders:new Map(),isScratchPreview:path=>path==='scratch.inp',fieldInspector:{closeTemporary:async()=>{}},selected:null,refreshAll(){},loadedLayerId:'source',loadedGeometryPath:'model.stl',loadedPreviewMode:'quick',
    viewer:{layers:new Map(),fieldLayers:new Map(),render(){}},adaptivePreview:null,cancelPreview(){},
    ...overrides
  };
  vm.createContext(context);vm.runInContext(save+clean,context);
  return {context,nodes,messages,calls};
}

test('Save as sends the current name as a suggestion and subsequent Save uses the chosen file',async()=>{
  const h=harness();
  assert.equal(await h.context.saveProject(true),true);
  assert.equal(h.calls[0].args.saveAs,true);
  assert.equal(h.calls[0].args.path,'C:/work/original.json');
  assert.equal(h.context.currentPath,'C:/work/copy.json');
  assert.equal(h.context.dirty,false);
  assert.equal(h.nodes.get('project-name').textContent,'copy');
  assert.equal(h.nodes.get('project-name').translate,false);
  await h.context.saveProject();
  assert.equal(h.calls[1].args.saveAs,false);
  assert.equal(h.calls[1].args.path,'C:/work/copy.json');
});
test('cancelling Save as or failing to write keeps the current file and dirty state',async()=>{
  for(const invoke of [async()=>null,async()=>{throw Error('disk full');}]){
    const h=harness({invoke});
    assert.equal(await h.context.saveProject(true),false);
    assert.equal(h.context.currentPath,'C:/work/original.json');
    assert.equal(h.context.dirty,true);
  }
});
test('full Save rejects incomplete morph; preview Save validates only its execution prefix',async()=>{
  const h=harness({doc:{WorkFlow:{'1':{Proc_Field_Morph:{domain_mask:'Domain',moving_regions:[{mask:'Moving'}]}},'2':{Proc_Field_Morph:{}}}}});
  assert.equal(await h.context.saveProject(),false);assert.equal(h.calls.length,0);
  assert.equal(await h.context.saveProject(false,{'1':h.context.doc.WorkFlow['1']}),true);assert.equal(h.calls.length,1);
});
test('Save and Save as both apply validation and reject writes during generation',async()=>{
  for(const saveAs of [false,true])for(const overrides of [
    {runProgress:{busy:true}}, {exportWorkflowError:()=> 'Invalid export'}, {applyLatticeDraft:()=>false}, {doc:{WorkFlow:{'1':{HS_Interpolate:{la_name:''}}}}},
    {doc:{WorkFlow:{'1':{Define_ScalarField_CombineGeometry:{field_id:'Mask',default_value:0,regions:[{geometry:{type:'Sphere',center:[0,0,0],radius:-1},value:1}]}}}}}
  ]){
    const h=harness(overrides);
    assert.equal(await h.context.saveProject(saveAs),false);
    assert.equal(h.calls.length,0);
    assert.equal(h.context.dirty,true);
  }
});

test('Save blocks invalid primitive mesh parameters and prefix saves exclude later invalid meshes',async()=>{
  const valid={Gen_BoxMesh:{num_elem:[2,3,4],x_range:[0,10],y_range:[0,10],z_range:[0,10],ori:[0,0,0],Normal:[0,0,1],z_angle:0,Mesh_file:'Box'}};
  const h=harness({doc:{WorkFlow:{'1':valid,'2':{Gen_SphericalMesh:{}}}}});
  assert.equal(await h.context.saveProject(),false);assert.equal(h.calls.length,0);
  assert.equal(await h.context.saveProject(false,{'1':valid}),true);assert.equal(h.calls.length,1);
});

test('Save rejects a missing merge field and a preview prefix excludes invalid downstream merges',async()=>{
  const p={la_name:'BCCubic',size:[4,4,4],thk:.4,Rot:[0,0,0],Trans:[0,0,0],Fill:true,Cube_Request:{},OP_para:{InterpType:'Field',FieldFile:'Missing',min_cap:0,max_cap:1,Transition:{}}};
  const h=harness({doc:{WorkFlow:{'1':{OP_FieldMerge:p}}}});assert.equal(await h.context.saveProject(),false);assert.equal(h.calls.length,0);assert.match(h.messages.at(-1),/before/);
  p.OP_para.FieldFile='values.csv';h.context.doc.WorkFlow['2']={OP_FieldMerge:{}};
  assert.equal(await h.context.saveProject(),false);assert.equal(await h.context.saveProject(false,{'1':h.context.doc.WorkFlow['1']}),true);
});
test('cleanup cancels work and closes cached layers before deleting files, preserving full detail',async()=>{
  const order=[],layers=new Map([['source',{preview:{}}],['full',{mode:'full'}],['result',{mode:'full',path:'scratch.inp'}]]);
  const h=harness({
    viewer:{layers,fieldLayers:new Map(),removeLayer(id){order.push(id);layers.delete(id);},render(){}},
    fieldInspector:{closeTemporary:async()=>order.push('close-fields')},cancelPreview:()=>order.push('cancel'),adaptivePreview:{clear:()=>order.push('close')},
    invoke:async command=>{order.push(command);}
  });
  await h.context.cleanScratch();
  assert.deepEqual(order,['cancel','close-fields','source','result','close','clean_view_scratch']);
  assert.equal(layers.has('full'),true);
  assert.equal(h.context.currentPath,'C:/work/original.json');
  assert.equal(h.context.dirty,true);
  assert.equal(h.context.loadedGeometryPath,'');
  assert.equal(h.nodes.get('preview-mode').disabled,true);
  assert.equal(h.nodes.get('clean-scratch').disabled,false);
  assert.equal(h.messages.at(-1),'Scratch cleaned.');
});
test('cleanup reports errors and allows retry; repeated clicks cannot overlap',async()=>{
  const h=harness({invoke:async()=>{throw Error('locked');}});
  await h.context.cleanScratch();
  assert.match(h.messages.at(-1),/Could not clean scratch: locked/);
  assert.equal(h.context.cleaningScratch,false);
  assert.equal(h.nodes.get('clean-scratch').disabled,false);
  const busy=harness({cleaningScratch:true});
  await busy.context.cleanScratch();assert.equal(busy.calls.length,0);
});
test('browser-only cleanup explains availability without changing the viewer',async()=>{
  const h=harness({invoke:null,cancelPreview(){throw Error('Must not cancel');}});
  await h.context.cleanScratch();
  assert.match(h.messages.at(-1),/installed desktop app/);
  assert.equal(h.context.loadedGeometryPath,'model.stl');
});
