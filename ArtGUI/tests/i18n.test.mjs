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
