import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseNumericJson, stringifyNumericJson, numberType, setNumber} from '../ui/numeric-json.js';
import {prepareFieldOperation, newScalarRegion, scalarFieldKeyword, tetFieldKeyword} from '../ui/field-workflow.js';

test('older tet steps gain optional controls without overwriting saved values or numeric tokens', () => {
  const step=parseNumericJson('{"mesh_file":"Solid","export_mesh":"Tets","size_field":"CellSize","sampling_size":0.75,"hausd":0.030,"preserve_features":false,"max_points":99999}');
  prepareFieldOperation(tetFieldKeyword,step);
  assert.equal(step.surface_tolerance,null);
  assert.equal(step.hausd,0.03);
  assert.equal(step.preserve_features,false);
  assert.equal(step.max_points,99999);
  assert.equal(step.size_iterations,3);
  assert.match(stringifyNumericJson(step),/"hausd": 0\.030/);
  assert.equal(numberType(step,'size_iterations'),'integer');
  assert.equal(numberType(step,'feature_angle'),'float');
  const saved=stringifyNumericJson(step);
  prepareFieldOperation(tetFieldKeyword,step);
  assert.equal(stringifyNumericJson(step),saved);
});

test('regional field edits retain fractional values when regions are removed and added', () => {
  const step=parseNumericJson('{"field_id":"CellSize","default_value":8.0,"regions":[{"geometry":"Heel","value":4.0},{"geometry":"Toe","value":2.00}],"overlap":"Maximum"}');
  prepareFieldOperation(scalarFieldKeyword,step);
  assert.equal(step.overlap,'Maximum');
  assert.equal(step.regions[0].transition_width,0);
  step.regions.splice(0,1);
  assert.match(stringifyNumericJson(step.regions[0]),/"value": 2\.00/);
  step.regions.push(newScalarRegion());
  setNumber(step.regions[1],'value','0.4');
  setNumber(step.regions[1],'transition_width','2.5');
  assert.equal(step.regions[1].value,0.4);
  assert.equal(step.regions[1].transition_width,2.5);
  step.regions.splice(0,2);
  prepareFieldOperation(scalarFieldKeyword,step);
  assert.deepEqual(step.regions,[]);
});

test('explicit nullable tolerance survives, malformed imports are left for validation, other operations stay unchanged', () => {
  for(const tolerance of [null,0.06]) {
    const step={surface_tolerance:tolerance};
    prepareFieldOperation(tetFieldKeyword,step);
    assert.equal(step.surface_tolerance,tolerance);
  }
  const params={regions:[null,'bad'],overlap:'Unexpected'};
  assert.doesNotThrow(()=>prepareFieldOperation(scalarFieldKeyword,params));
  assert.equal(params.overlap,'Unexpected');
  const other=parseNumericJson('{"value":3.00}'),saved=stringifyNumericJson(other);
  prepareFieldOperation('Other',other);
  assert.equal(stringifyNumericJson(other),saved);
});
