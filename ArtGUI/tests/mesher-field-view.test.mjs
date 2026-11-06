import test from 'node:test';
import assert from 'node:assert/strict';
import {createFieldInspector} from '../ui/field-inspector.js';
import {sizeFieldView} from '../ui/size-field-mesher-model.js';

test('strict field loading closes a mismatched HDF5 file and never falls back to another dataset',async()=>{
  const old=globalThis.document;globalThis.document={getElementById:()=>null};const calls=[],selected=[];
  const inspector=createFieldInspector({invoke:async(name,args)=>{calls.push([name,args]);if(name==='open_field_file')return{handle:17,path:'size.h5',fields:[{id:'Unrelated',blocks:[]}]};},getViewer:()=>null,getReferences:()=>[],addReference:()=>{throw Error('Should not add a mismatched reference');},onSelect:id=>selected.push(id),onChange:()=>{},toast:()=>{}});
  try{await assert.rejects(inspector.load('size.h5',null,'CellSize',{strictField:true}),/not stored/);assert.deepEqual(calls.map(([name])=>name),['open_field_file','close_field_file']);assert.deepEqual(selected,[]);assert.equal(inspector.describe('size.h5','CellSize'),null);}finally{globalThis.document=old;}
});
test('ReadGridField uses its stored FieldID while the mesher keeps its workflow alias',()=>{
  const workflow={'1':{ReadGridField:{Gridfield_ID:'CellSize',FieldID:'OriginalSize',inp_GridFieldFile:'size.h5'}},'2':{Gen_TetMesh_SizeField:{size_field:'CellSize'}}};
  const result=sizeFieldView(workflow,'2','CellSize');assert.equal(result.fieldId,'CellSize');assert.equal(result.storedId,'OriginalSize');assert.equal(result.path,'size.h5');
});
