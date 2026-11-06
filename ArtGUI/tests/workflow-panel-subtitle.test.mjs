import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {workflowPanelSubtitle} from '../ui/workflow-panel-subtitle.js';

test('all 80 catalog keywords use the requested exact workflow subtitle format',()=>{
  const context={window:{}};vm.runInNewContext(fs.readFileSync(new URL('../ui/operations.js',import.meta.url),'utf8'),context);
  const ops=context.window.ARTISAN_OPERATIONS;assert.equal(ops.length,80);
  const workflow=Object.fromEntries(ops.map((op,i)=>[String(i+1),{[op.keyword]:{}}]));
  for(const [i,op] of ops.entries())assert.equal(workflowPanelSubtitle(workflow,String(i+1)),`Workflow step ${String(i+1).padStart(2,'0')} - ${op.keyword}`);
});

test('subtitle positions follow timeline order and update after deleting or reordering steps',()=>{
  const doc={'4':{Define_Lattice:{}},'20':{Gen_TetMesh_SizeField:{}},'80':{Gen_QuadMesh_SizeField:{}}};
  assert.equal(workflowPanelSubtitle(doc,'20'),'Workflow step 02 - Gen_TetMesh_SizeField');
  delete doc['4'];assert.equal(workflowPanelSubtitle(doc,'20'),'Workflow step 01 - Gen_TetMesh_SizeField');
  const moved={'1':doc['80'],'7':doc['20']};assert.equal(workflowPanelSubtitle(moved,'1'),'Workflow step 01 - Gen_QuadMesh_SizeField');
  assert.equal(workflowPanelSubtitle(moved,'7'),'Workflow step 02 - Gen_TetMesh_SizeField');
});

test('multi-keyword steps retain exact command names and large positions are not truncated',()=>{
  assert.equal(workflowPanelSubtitle({'7':{ReadMesh:{},ExportMeshID:{}}},'7'),'Workflow step 01 - ReadMesh / ExportMeshID');
  const workflow=Object.fromEntries(Array.from({length:101},(_,i)=>[i+1,{ReadMesh:{}}]));
  assert.equal(workflowPanelSubtitle(workflow,101),'Workflow step 101 - ReadMesh');
});

test('non-workflow selections never receive an invented step number',()=>{
  for(const key of [undefined,null,'setup','field:x','geometry','2'])assert.equal(workflowPanelSubtitle({'1':{ReadMesh:{}}},key),'');
  assert.equal(workflowPanelSubtitle(null,'1'),'');assert.equal(workflowPanelSubtitle({'1':{}},'1'),'');
});
