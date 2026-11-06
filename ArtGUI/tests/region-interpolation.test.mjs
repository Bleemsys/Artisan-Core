import {test} from 'node:test';
import assert from 'node:assert/strict';
import {scalarFieldMethods,scalarFieldError,scalarWorkflowError,changeScalarMethod,scalarMethodHelp,fieldPreviewWorkflow} from '../ui/region-model.js';
import {prepareFieldOperation,scalarFieldKeyword,fieldParameterInfo} from '../ui/field-workflow.js';
import {parseNumericJson,stringifyNumericJson,cloneNumericJson} from '../ui/numeric-json.js';

const params=()=>parseNumericJson('{"field_id":"CellSize","default_value":6.0,"overlap":"Linear","regions":[{"name":"A","geometry":{"type":"Box","center":[0.5,0.5,0.5],"size":[1,1,1]},"value":4.0},{"name":"B","geometry":{"type":"Box","center":[3.5,0.5,0.5],"size":[1,1,1]},"value":8.0}]}');

test('all five methods are offered and old workflows keep their numeric tokens',()=>{
 assert.deepEqual(fieldParameterInfo(scalarFieldKeyword+'.overlap').choices,scalarFieldMethods);
 for(const method of scalarFieldMethods){const p=params();p.overlap=method;prepareFieldOperation(scalarFieldKeyword,p);assert.equal(scalarFieldError(p),'');assert.match(stringifyNumericJson(p),/"value": 4\.0/);}
 const p=params();delete p.overlap;prepareFieldOperation(scalarFieldKeyword,p);assert.equal(p.overlap,'Minimum');assert.equal(p.distance_power,undefined);
});
test('region counts follow the backend and errors propagate to preview validation',()=>{
 for(const method of ['Linear','InverseDistance'])for(const count of [0,1,2,3]){const p=params();p.overlap=method;p.regions=Array.from({length:count},()=>p.regions[0]);assert.equal(!!scalarFieldError(p),count<2);}
 for(const count of [0,1,2,3]){const p=params();p.overlap='Smoothstep';p.regions=Array.from({length:count},()=>p.regions[0]);assert.equal(!!scalarFieldError(p),count!==2);}
 const p=params();p.regions=[];assert.match(scalarWorkflowError({'2':{[scalarFieldKeyword]:p}}),/Step 2.*at least two/);
});
test('nonzero widths are rejected without changing imported values',()=>{
 for(const method of ['Linear','Smoothstep','InverseDistance']){const p=params();p.overlap=method;p.regions[0].transition_width=2.5;const before=stringifyNumericJson(p);assert.match(scalarFieldError(p),/transition width 0/);assert.equal(stringifyNumericJson(p),before);}
 for(const method of ['Minimum','Maximum']){const p=params();p.overlap=method;p.regions[0].transition_width=2.5;assert.equal(scalarFieldError(p),'');}
});
test('inverse power defaults, finite positive validation and method changes',()=>{
 const p=params();changeScalarMethod(p,'InverseDistance');assert.equal(p.distance_power,1);
 for(const value of [0,-1,NaN,Infinity,true]){p.distance_power=value;assert.ok(scalarFieldError(p));}
 p.distance_power=2.5;assert.equal(scalarFieldError(p),'');
 const snapshot=cloneNumericJson(p);changeScalarMethod(p,'Smoothstep');assert.equal(p.distance_power,undefined);assert.equal(scalarFieldError(p),'');assert.equal(snapshot.distance_power,2.5);
 p.distance_power=2;assert.match(scalarFieldError(p),/only applies/);
 assert.throws(()=>changeScalarMethod(p,'Unknown'));
});
test('imported unsupported methods are visible errors and are never normalized away',()=>{
 const p=params();p.overlap='Cubic';prepareFieldOperation(scalarFieldKeyword,p);assert.equal(p.overlap,'Cubic');assert.match(scalarFieldError(p),/supported/);
});
test('field preview preserves interpolation settings and removes downstream steps',()=>{
 const p=params();changeScalarMethod(p,'InverseDistance');p.distance_power=2;
 const doc={Setup:{Type:'Sample'},WorkFlow:{'1':{[scalarFieldKeyword]:p},'2':{Other:{}}},PostProcess:{}};
 const before=stringifyNumericJson(doc),preview=fieldPreviewWorkflow(doc,'1','preview.h5');
 assert.equal(stringifyNumericJson(doc),before);assert.equal(preview.WorkFlow['1'][scalarFieldKeyword].distance_power,2);assert.equal(preview.WorkFlow['1'][scalarFieldKeyword].overlap,'InverseDistance');assert.equal(preview.WorkFlow['2'].Other,undefined);
});
test('method descriptions distinguish the background and pairwise smoothstep',()=>{
 assert.match(scalarMethodHelp('Maximum'),/background/);assert.match(scalarMethodHelp('Smoothstep'),/exactly two/);assert.match(scalarMethodHelp('Linear'),/3D/);
});
