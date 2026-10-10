import assert from 'node:assert/strict';
import {test} from 'node:test';
import {exportMode, setExportMode, exportError, exportWorkflowError, parseGridFieldIds, meshExtensions} from '../ui/export-options.js';
import {parseNumericJson, stringifyNumericJson} from '../ui/numeric-json.js';

test('legacy outfile-only JSON remains unchanged on inspection and roundtrip', () => {
  const original = '{"Export":{"outfile":".//Test_results/part.stl"},"scale":5.0}';
  const doc = parseNumericJson(original), before = stringifyNumericJson(doc);
  assert.equal(exportMode(doc.Export), 'mesh');
  assert.equal(exportError(doc.Export), '');
  assert.equal(stringifyNumericJson(doc), before);
  assert.deepEqual(Object.keys(doc.Export), ['outfile']);
  assert.match(before, /5\.0/);
});

test('all backend mesh extensions and case-insensitive HDF5 extensions work', () => {
  for (const ext of [...meshExtensions, 'h5', 'hdf5']) assert.equal(exportError({outfile:`C:\\project.with.dots\\part.${ext.toUpperCase()}`}), '');
  assert.equal(exportMode({outfile:'part.HDF5'}), 'field');
  assert.equal(exportMode({outfile:'part.stl', fieldfile:'part.h5'}), 'both');
});

test('changing modes assembles exactly the supported JSON keywords', () => {
  const params = {outfile:'./folder.with.dots/part.obj'};
  setExportMode(params, 'both');
  assert.deepEqual(params, {outfile:'./folder.with.dots/part.obj', fieldfile:'./folder.with.dots/part.h5'});
  params.GridFieldIDs = ['SizeField'];
  setExportMode(params, 'field');
  assert.deepEqual(params, {outfile:'./folder.with.dots/part.h5', GridFieldIDs:['SizeField']});
  setExportMode(params, 'both');
  assert.deepEqual(params, {outfile:'./folder.with.dots/part.stl', fieldfile:'./folder.with.dots/part.h5', GridFieldIDs:['SizeField']});
  setExportMode(params, 'mesh');
  assert.deepEqual(params, {outfile:'./folder.with.dots/part.stl'});
  assert.throws(() => setExportMode(params, 'unsupported'));
  const custom = {outfile:'mesh.stl', fieldfile:'./fields/fitted.HDF5', GridFieldIDs:['SizeField']};
  setExportMode(custom, 'field');
  assert.deepEqual(custom, {outfile:'./fields/fitted.HDF5', GridFieldIDs:['SizeField']});
});

test('selected field names retain exact spelling, Unicode and path-like IDs', () => {
  assert.deepEqual(parseGridFieldIds('["SizeField", "stress/σ", "a.b"]'), ['SizeField','stress/σ','a.b']);
  assert.deepEqual(parseGridFieldIds('[]'), []);
  for (const text of ['', '[', '{}', 'null', '[1]', '[""]', '[" "]', '["x","x"]', '["lattice"]', '["a\\u0000b"]']) assert.throws(() => parseGridFieldIds(text));
});

test('invalid combinations and malformed import values cannot be generated', () => {
  for (const params of [{}, {outfile:3}, {outfile:''}, {outfile:'part.csv'}, {outfile:'part.h5',fieldfile:'other.h5'}, {outfile:'part.stl',fieldfile:''}, {outfile:'part.stl',fieldfile:'part.csv'}, {outfile:'part.stl',GridFieldIDs:['SizeField']}, {outfile:'part.h5',GridFieldIDs:'SizeField'}, {outfile:'part.h5',GridFieldIDs:['lattice']}, {outfile:'part.h5',GridFieldIDs:['a','a']}, {outfile:'part.h5',extra:true}]) assert.ok(exportError(params), JSON.stringify(params));
  assert.equal(exportError({outfile:'part.stl',GridFieldIDs:[]}), '');
  assert.equal(exportError({outfile:'part.h5',GridFieldIDs:['SizeField']}), '');
});

test('an invalid field-ID draft is reported even after selecting another step', () => {
  const params = {outfile:'part.h5'}, drafts = new WeakMap([[params, {text:'[',error:'Invalid draft'}]]);
  const workflow = {'1':{OP_Fit_GridField:{}},'2':{Export:params}};
  assert.match(exportWorkflowError(workflow, drafts), /Step 2.*Invalid draft/);
  drafts.delete(params);
  assert.equal(exportWorkflowError(workflow, drafts), '');
  params.fieldfile = 'other.h5';
  assert.match(exportWorkflowError(workflow), /Step 2.*mesh outfile/);
});
