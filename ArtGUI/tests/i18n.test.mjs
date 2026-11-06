import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {translate, setLanguage, getLanguage, LANGUAGE_KEY} from '../ui/i18n.js';

test('language selection, English fallback, whitespace and dynamic counts', () => {
  setLanguage('zh-CN');
  assert.equal(translate(' Save '),' 保存 ');
  assert.equal(translate('Expand'),'展开');
  assert.equal(translate('Collapse'),'收起');
  assert.equal(translate('Expand workflow and resources'),'展开工作流与资源');
  assert.equal(translate('1 step'),'1 个步骤');
  assert.equal(translate('12 steps'),'12 个步骤');
  assert.equal(translate('Search results · 2 operations'),'搜索结果 · 2 个操作');
  assert.equal(translate('Workflow step 03 · Add_Lattice'),'工作流步骤 03 · Add_Lattice');
  assert.equal(translate('After Step 2 — Add lattice'),'步骤 2 之后 — 添加点阵');
  assert.equal(translate('Untranslated future message'),'Untranslated future message');
  setLanguage('en');
  assert.equal(translate('Save'),'Save');
  assert.equal(translate('Expand'),'Expand');
  assert.equal(translate('Collapse'),'Collapse');
  assert.equal(translate('Expand workflow and resources'),'Expand workflow and resources');
  assert.throws(()=>setLanguage('fr'),/Unsupported language/);
  assert.equal(getLanguage(),'en');
});

test('all operation labels, descriptions and categories have Chinese translations', () => {
  const context={window:{}};
  vm.runInNewContext(fs.readFileSync(new URL('../ui/operations.js',import.meta.url),'utf8'),context);
  for(const operation of context.window.ARTISAN_OPERATIONS) {
    for(const key of ['label','description','category']) assert.notEqual(translate(operation[key],'zh-CN'),operation[key],operation[key]);
    assert.equal(translate(operation.keyword,'zh-CN'),operation.keyword);
  }
});

test('preference survives reload and unavailable storage does not break switching', async () => {
  const original=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
  const values=new Map();
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)}});
  try {
    setLanguage('zh-CN');assert.equal(values.get(LANGUAGE_KEY),'zh-CN');
    const loaded=await import('../ui/i18n.js?reload');assert.equal(loaded.getLanguage(),'zh-CN');
    Object.defineProperty(globalThis,'localStorage',{configurable:true,get(){throw Error('blocked');}});
    assert.doesNotThrow(()=>setLanguage('en'));
    const blocked=await import('../ui/i18n.js?blocked');assert.equal(blocked.getLanguage(),'en');
  } finally {
    if(original)Object.defineProperty(globalThis,'localStorage',original);else delete globalThis.localStorage;
    setLanguage('en');
  }
});

test('morph labels, units, handles and status messages translate without changing field identifiers', () => {
  setLanguage('en');
  const values=new Map([
    ['Translation (mm)','平移（mm）'],['Translation (mm) X','平移（mm） X'],
    ['Rotation center (cm)','旋转中心（cm）'],['Drag snap (model units)','拖动吸附（模型单位）'],
    ['Rotation axis Z','旋转轴 Z'],['Rotate X','旋转 X'],['Move Y','移动 Y'],
    ['Movement 3','移动区域 3'],['Step 12','步骤 12'],[' · target',' · 目标'],
    ['Moving target','移动目标'],
  ]);
  for(const [english,chinese] of values){assert.equal(translate(english,'zh-CN'),chinese);assert.equal(translate(english,'en'),english);}
  for(const message of ['Stages','Stages completed','Maximum stage gradient','Maximum stage inverse error','Remove','0 = off · Shift rotates by 15°','Active lattice field','Edit the earlier geometry mask','Insert a new geometry mask before this morph','Morph viewport tool','Preview computed · see run log','Preview stopped · previous output may be stale','Preview not updated · previous output may be stale','Preview failed · previous output may be stale','Drag to change movement. Arrow keys adjust; Esc cancels.','Pick rotation center on the original model. Esc cancels.','Guides show requested movement; compute the deformation to check it'])assert.notEqual(translate(message,'zh-CN'),message,message);
  assert.equal(translate('Use lattice for the active field and surface export. Coordinates and translations use mm.','zh-CN'),'使用 lattice 表示当前场并导出表面。坐标和平移的单位为 mm。');
  for(const data of ['MovingLugs','MorphDomain','Proc_Field_Morph','engine-bracket-quality.json','lattice'])assert.equal(translate(data,'zh-CN'),data);
});

test('morph model validation and multiple warning messages have Chinese presentation', async () => {
  const {newMorph,newMotion,morphError,morphWorkflowError,morphWarnings}=await import('../ui/morph-model.js');
  const valid=()=>({...newMorph(),domain_mask:'Domain',fixed_mask:'Fixed',moving_regions:[newMotion('Save')]});
  const errors=[null,{...valid(),extra:1},{...valid(),input_field:''},{...valid(),output_field:'file.h5'},{...valid(),domain_mask:''},{...valid(),fixed_mask:'lattice'},{...valid(),fixed_mask:'Domain'},{...valid(),moving_regions:[]},{...valid(),output_field:'Save'},{...valid(),quality_report:'bad.txt'}];
  for(const extra of [null,{mask:'lattice'},{mask:'Domain'},{mask:'Save',extra:1},{mask:'Save',translation:[1,2]},{mask:'Save',rotation_axis:[0,0,0]},{mask:'Save',rotation_degrees:NaN}])errors.push({...valid(),moving_regions:[extra]});
  for(const [key,value] of Object.entries({mask_threshold:0,max_gradient:1,max_control_points:1,inverse_tolerance:0,inverse_iterations:0,stages:0,max_grid_points:0,support_radius:-1}))errors.push({...valid(),[key]:value});
  for(const p of errors){const error=morphError(p);assert.ok(error);assert.notEqual(translate(error,'zh-CN'),error,error);}
  const workflowError=morphWorkflowError({'12':{Proc_Field_Morph:{...valid(),moving_regions:[{mask:'Save',rotation_axis:[0,0,0]}]}}});
  assert.equal(translate(workflowError,'zh-CN'),'步骤 12：移动区域 1：旋转轴不能为零向量。');
  for(const warning of morphWarnings(valid(),{},'5',{Type:'Sample',Sample:{Domain:[[-20,20],[-20,20],[-20,20]]}})){
    const translated=translate(warning,'zh-CN');assert.notEqual(translated,warning);assert.equal(translated.split('：')[0],warning.split(':')[0]);
  }
  assert.equal(translate('max_gradient must be a number greater than 0 and at most 0.99.','zh-CN'),'max_gradient 必须为大于 0 且不大于 0.99 的数值。');
});
