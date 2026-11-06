import test from 'node:test';
import assert from 'node:assert/strict';
import {slotInputs,pairDirection,slotError,slotPreviewWorkflow,renameSlotFields,suggestedCutters} from '../ui/slot-model.js';

const horizontal={FieldID:'H01',normal:[0,0,1]},vertical={FieldID:'V01',normal:[0,1,0]};
const params={A:'H01',B:'V01',direction:[1,0,0],open_A:'Negative',open_B:'Positive',Cutters:{A:'CutA',B:'CutB'}};
test('slot selectors use earlier plate fields and keep exact values and engine defaults',()=>{
  const workflow={1:{Proc_BoxSlices:{Target:'FieldContainer',Boxes:[horizontal,vertical]}},2:{Gen_SlotCutters:params},3:{Proc_BoxSlices:{Boxes:[{FieldID:'Future'}]}}};
  const inputs=slotInputs(workflow,'2');
  assert.deepEqual([...inputs.plates.keys()],['H01','V01']);
  assert.deepEqual(pairDirection(horizontal,vertical),[1,0,0]);
  assert.equal(pairDirection(horizontal,horizontal),null);
  assert.equal(slotError(params,inputs),'');
  assert.match(slotError({...params,direction:[0,0,1]},inputs),/intersection/);
  assert.match(slotError({...params,split_ratio:1},inputs),/100%/);
  assert.match(slotError({...params,open_B:'Negative'},inputs),/opposite/);
  assert.match(slotError({...params,Cutters:{A:'H01',B:'CutB'}},inputs),/existing fields/);
  assert.deepEqual(suggestedCutters('H01','V01',new Set(['H01_V01_cut_A'])),{A:'H01_V01_cut_A_2',B:'H01_V01_cut_B'});
});

test('slot preview computes two scratch meshes without modifying the saved workflow or running downstream steps',()=>{
  const doc={Setup:{},WorkFlow:{1:{Proc_BoxSlices:{Boxes:[horizontal,vertical]}},2:{Export:{outfile:'keep.stl'}},
    3:{Gen_SlotCutters:params},4:{Subtract_Geometry:{Source:{Type:'Field',ID:'CutA'}}}},PostProcess:{CombineMeshes:true}};
  const before=JSON.stringify(doc),path='C:/ViewScratch/Workflow_03_plate_a.stl';
  const {workflow,outputs}=slotPreviewWorkflow(doc,'3',path);
  assert.equal(outputs.B,'C:/ViewScratch/Workflow_03_plate_b.stl');
  assert.equal(JSON.stringify(doc),before);
  assert.equal(Object.keys(workflow.WorkFlow).length,10);
  const steps=Object.values(workflow.WorkFlow);
  assert.deepEqual(steps.filter(s=>s.Load_LatticeField).map(s=>s.Load_LatticeField.Source.ID),['H01','V01']);
  assert.deepEqual(steps.filter(s=>s.Subtract_Geometry).map(s=>s.Subtract_Geometry.Source.ID),['CutA','CutB']);
  assert.deepEqual(steps.filter(s=>s.ExportMeshID).map(s=>s.ExportMeshID.out_meshfile),[outputs.A,outputs.B]);
  assert.equal(steps.some(s=>s.Export),false);
});

test('renaming cutter fields updates known downstream references and preserves earlier steps',()=>{
  const before={Source:{Type:'Field',ID:'CutA'}};
  const workflow={1:{Subtract_Geometry:before},2:{Gen_SlotCutters:params},
    3:{Subtract_Geometry:{Source:{Type:'Field',ID:'CutA'}}},
    4:{Export:{GridFieldIDs:['CutB','Other']}}};
  renameSlotFields(workflow,'2',params.Cutters,{A:'NewA',B:'NewB'});
  assert.equal(before.Source.ID,'CutA');
  assert.equal(workflow[3].Subtract_Geometry.Source.ID,'NewA');
  assert.deepEqual(workflow[4].Export.GridFieldIDs,['NewB','Other']);
});
