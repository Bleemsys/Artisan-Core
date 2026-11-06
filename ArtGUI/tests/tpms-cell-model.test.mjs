import test from 'node:test';
import assert from 'node:assert/strict';
import {compileTpmsExpression,tpmsPeriod} from '../ui/tpms-expression.js';
import {newTpmsDefinition,tpmsDefinitionDraft,sampleTpmsGrid,gridSlice,nearestGridValue,cellGridCoordinates} from '../ui/tpms-cell-model.js';
import {parseNumericJson,stringifyNumericJson} from '../ui/numeric-json.js';
const custom=expr=>({type:'TPMS',definition:{expr,unit_x_len:'1',unit_y_len:'1',unit_z_len:'1',ladomain:'Hex'}});
test('restricted scalar expressions follow mathematical precedence and Python-style remainder',()=>{
 for(const [source,value] of [['-2**2',-4],['(-2)**2',4],['2**3**2',512],['2**-2',.25],['-3//2',-2],['-3%2',1],['3%-2',-1],['sin(pi/2)+cos(0)',2],['where(x>0,log(x),0)',0]])assert.equal(compileTpmsExpression(source).evaluate(0,0,0),value,source);
 assert.equal(compileTpmsExpression('x+2*y+3*z').evaluate(1,2,3),14);
});
test('rejects executable code, property access, unknown functions, malformed and unbounded expressions',()=>{
 for(const s of ['globalThis','constructor.constructor(1)','Math.cos(x)','x=1','alert(1)','sin(x,2)','sin(','x+','0<x<1','x^2','sin()','where(1,2)','1e999','1;2','[x]','__proto__','('.repeat(70)+'1'+')'.repeat(70)])assert.throws(()=>compileTpmsExpression(s),Error,s);
 assert.throws(()=>compileTpmsExpression('1'.repeat(5000)),/too long/);
});
test('periods accept constant expressions and reject coordinates, nonfinite and nonpositive values',()=>{
 assert.equal(tpmsPeriod('2*pi'),2*Math.PI);assert.equal(tpmsPeriod('sqrt(4)'),2);for(const s of ['x','0','-1','1/0','sqrt(-1)'])assert.throws(()=>tpmsPeriod(s));
});
test('a linear field marks exactly the zero-crossing grid cells without generating a triangle mesh',()=>{
 const g=sampleTpmsGrid(custom('x-0.5'),16);assert.equal(g.values.length,17**3);assert.equal(g.cells.length,2*16**2);assert.equal(g.min,-.5);assert.equal(g.max,.5);assert.ok([...g.cells].every(i=>[7,8].includes(cellGridCoordinates(i,16)[0])));assert.equal(g.triangles,undefined);assert.equal(g.vertices,undefined);
});
test('slice axes and probes use the same normalized-to-expression coordinate mapping',()=>{
 const d=custom('x+2*y+3*z');Object.assign(d.definition,{unit_x_len:'2',unit_y_len:'3',unit_z_len:'4'});const g=sampleTpmsGrid(d,16),xy=gridSlice(g,'z',8),xz=gridSlice(g,'y',8),yz=gridSlice(g,'x',8);assert.equal(xy.values[0],6);assert.equal(xy.values.at(-1),14);assert.equal(xz.values[0],3);assert.equal(yz.values[0],1);assert.equal(nearestGridValue(g,[1,1,1]).value,20);assert.deepEqual(nearestGridValue(g,[.49,.49,.49]).position,[.5,.5,.5]);
});
test('empty and degenerate sampled fields report their limits; singular expressions fail cleanly',()=>{
 const empty=sampleTpmsGrid(custom('5'),16);assert.equal(empty.cells.length,0);assert.match(empty.warnings[0],/No zero surface/);const degenerate=sampleTpmsGrid(custom('0'),16);assert.equal(degenerate.cells.length,0);assert.match(degenerate.warnings[0],/every sampled point/);assert.throws(()=>sampleTpmsGrid(custom('1/x'),16),/grid point/);assert.throws(()=>sampleTpmsGrid(custom('sqrt(x-0.1)'),16),/grid point/);assert.throws(()=>sampleTpmsGrid(custom('x'),256),/supported/);assert.throws(()=>sampleTpmsGrid(custom('x*1e-60'),16),/precision/);
});
test('an imported definition preserves unknown fields and numeric formatting',()=>{
 const source=parseNumericJson('{"type":"TPMS","extra":1.00,"definition":{"expr":"cos(x)+cos(y)+cos(z)","unit_x_len":"2*pi","unit_y_len":"2*pi","unit_z_len":"2*pi","ladomain":"Hex","custom":{"factor":1e0}}}');assert.equal(stringifyNumericJson(tpmsDefinitionDraft(source)),stringifyNumericJson(source));const other=structuredClone(source);other.type='TPMS-Field';assert.throws(()=>tpmsDefinitionDraft(other),/ordinary TPMS/);const g=sampleTpmsGrid(newTpmsDefinition(),24);assert.ok(g.cells.length>0);assert.deepEqual(g.warnings,[]);
});
