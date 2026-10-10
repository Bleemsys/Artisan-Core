import {test} from 'node:test';
import assert from 'node:assert/strict';
import {formatMemory,formatPercent,historySeries,chartModel} from '../ui/resource-monitor.js';

test('missing readings remain unavailable and memory labels use binary units',()=>{
  assert.equal(formatMemory(null),'—');assert.equal(formatPercent(null),'—');assert.equal(formatMemory(NaN),'—');
  assert.equal(formatMemory(2*1024**3),'2.0 GiB');assert.equal(formatMemory(32*1024**2),'32.0 MiB');assert.equal(formatPercent(150),'100%');
});
test('Artisan history excludes earlier runs and data outside the last minute',()=>{
  const snapshot={sampledAt:100000,runId:'new',history:[
    {sampledAt:10000,runId:'new',artisan:{memoryBytes:9*1024**3}},
    {sampledAt:50000,runId:'old',artisan:{memoryBytes:8*1024**3}},
    {sampledAt:99000,runId:'new',artisan:{memoryBytes:2*1024**3}},
    {sampledAt:100000,runId:'new',artisan:{memoryBytes:null}},
  ]};
  assert.deepEqual(historySeries(snapshot,'artisan','memory').map(p=>p.value),[null,2,null]);
  snapshot.runId=null;assert.ok(historySeries(snapshot,'artisan','memory').every(p=>p.value===null));
});
test('System and GUI traces retain valid zero readings and missing CPU warmup',()=>{
  const snapshot={sampledAt:2000,history:[{sampledAt:1000,systemCpuPercent:null,artgui:{cpuPercent:0}},{sampledAt:2000,systemCpuPercent:75,artgui:{cpuPercent:2}}]};
  assert.deepEqual(historySeries(snapshot,'system','cpu').map(p=>p.value),[null,75]);
  assert.deepEqual(historySeries(snapshot,'artgui','cpu').map(p=>p.value),[0,2]);
});
test('charts break at missing samples and pauses instead of inventing continuous usage',()=>{
  const points=[{time:1000,value:1},{time:2000,value:2},{time:3000,value:null},{time:4000,value:3},{time:10000,value:4}];
  const model=chartModel(points,260,'memory',10000);
  assert.deepEqual(model.segments.map(s=>s.length),[2,1,1]);
  assert.ok(model.segments.flat().every(p=>p.x>=model.left&&p.x<=model.right&&p.y>=model.top&&p.y<=model.bottom));
  assert.equal(chartModel([],260,'cpu',0).max,100);assert.equal(chartModel([],260,'memory',0).hasData,false);
});
