import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {parseNumericJson, stringifyNumericJson, numberType, setNumber} from '../ui/numeric-json.js';
import {prepareFieldOperation} from '../ui/field-workflow.js';

test('plate workflow survives editor preparation and save with nested IDs and numeric tokens', () => {
  const original = fs.readFileSync(new URL('./fixtures/plate-slicing.json', import.meta.url), 'utf8');
  const doc = parseNumericJson(original);
  const before = stringifyNumericJson(doc);
  for (const step of Object.values(doc.WorkFlow)) {
    for (const [keyword, params] of Object.entries(step)) prepareFieldOperation(keyword, params);
  }
  assert.equal(stringifyNumericJson(doc), before);
  assert.deepEqual(JSON.parse(stringifyNumericJson(doc)), JSON.parse(original));
  assert.equal(Object.keys(doc.WorkFlow).length, 78);
  assert.deepEqual(doc.WorkFlow['17'].Clear_LatticeField, {});
  assert.equal(doc.WorkFlow['18'].Add_Geometry.Source.ID, 'H01');
  assert.equal(doc.WorkFlow['2'].Gen_SlotCutters.Cutters.B, 'H01_V01_cut_V');
  const box = doc.WorkFlow['1'].Proc_BoxSlices.Boxes[0];
  assert.equal(numberType(box.ori, 2), 'float');
  assert.equal(numberType(box.normal, 2), 'integer');
  setNumber(box.ori, 2, '41.0');
  const saved = parseNumericJson(stringifyNumericJson(doc));
  assert.equal(saved.WorkFlow['1'].Proc_BoxSlices.Boxes[0].ori[2], 41);
  assert.equal(numberType(saved.WorkFlow['1'].Proc_BoxSlices.Boxes[0].ori, 2), 'float');
  assert.equal(saved.WorkFlow['1'].Proc_BoxSlices.Boxes[0].FieldID, 'H01');
});

test('every operation in the supplied workflow has an Add step entry with an available icon', () => {
  const context = {window: {}};
  vm.runInNewContext(fs.readFileSync(new URL('../ui/operations.js', import.meta.url), 'utf8'), context);
  const doc = JSON.parse(fs.readFileSync(new URL('./fixtures/plate-slicing.json', import.meta.url), 'utf8'));
  const icons = fs.readFileSync(new URL('../ui/operation-icons.js', import.meta.url), 'utf8');
  for (const step of Object.values(doc.WorkFlow)) {
    for (const keyword of Object.keys(step)) {
      const operation = context.window.ARTISAN_OPERATIONS.find(op => op.keyword === keyword);
      assert.ok(operation, keyword);
      assert.ok(icons.includes('"' + operation.icon + '"'), operation.icon);
    }
  }
});
