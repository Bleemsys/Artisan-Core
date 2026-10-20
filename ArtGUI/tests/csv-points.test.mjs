import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CsvRecords,inspectCsv,PointReservoir,validatePointMapping} from '../ui/csv-points.mjs';
import {validatePointReferences} from '../ui/point-cloud-inspector.js';
const config={delimiter:',',header:true,axes:[0,1,2],scalar:3,limit:1000};
test('streaming quoted fields, escaped quotes and CRLF survive arbitrary boundaries',()=>{
 const rows=[],parser=new CsvRecords(',',r=>rows.push(r)),text='x,y,z,value,note\r\n1,2,3,8,"a,b"\r\n4,5,6,9,"a""b\nc"';
 for(const c of text)parser.push(c);parser.push('',true);
 assert.deepEqual(rows,[['x','y','z','value','note'],['1','2','3','8','a,b'],['4','5','6','9','a"b\nc']]);
});
test('delimiter, headers and coordinate aliases are detected',()=>{
 const info=inspectCsv('\ufeffvalue;z;y;x\n8;3;2;1\n');assert.equal(info.delimiter,';');assert.equal(info.header,true);assert.deepEqual(info.axes,[3,2,1]);assert.equal(info.scalar,0);
 assert.equal(inspectCsv('0\t1\t2\t8\n3\t4\t5\t9\n').header,false);
});
test('bad coordinates are counted, missing scalar stays visible, original row IDs survive',()=>{
 const sample=new PointReservoir(config,4),parser=new CsvRecords(',',(row,i)=>sample.accept(row,i));
 parser.push('x,y,z,value\n0,1,2,8\n,,,\nNaN,2,3,4\n1,2,3,\n',true);const result=sample.finish();
 assert.equal(result.total,2);assert.equal(result.invalid,2);assert.equal(result.missing,1);assert.deepEqual(Array.from(result.rows),[1,4]);assert.deepEqual(result.range,[8,8]);assert.ok(Number.isNaN(result.values[1]));
});
test('large clouds stay bounded and sampled deterministically while bounds use every valid row',()=>{
 const make=()=>{const r=new PointReservoir(config,4);r.accept(['x','y','z','value'],1);for(let i=0;i<5000;i++)r.accept([String(i),'0','0',String(i)],i+2);return r.finish();};
 const a=make(),b=make();assert.equal(a.total,5000);assert.equal(a.shown,1000);assert.deepEqual(a.rows,b.rows);assert.deepEqual(a.range,[0,4999]);assert.deepEqual(a.bounds,[[0,0,0],[4999,0,0]]);
 for(let i=0;i<a.shown;i++)assert.equal(a.coordinates[i*3],a.rows[i]-1);
});
test('invalid mappings, malformed quotes and invalid persisted settings are rejected',()=>{
 assert.throws(()=>validatePointMapping({...config,axes:[0,0,1]},4));assert.throws(()=>new CsvRecords().push('"unclosed',true));
 const ref={id:'points-123',path:'a.csv',columns:['x','y','z','value'],config};assert.doesNotThrow(()=>validatePointReferences([ref]));assert.throws(()=>validatePointReferences([ref,ref]));
 assert.throws(()=>validatePointReferences([{...ref,config:{...config,limit:1e12}}]));
});
test('CSV worker reads a real Blob and transfers source values and sampled points',async()=>{
 const {Worker}=await import('node:worker_threads'),url=new URL('../ui/csv-point-worker.js',import.meta.url).href;
 const worker=new Worker(`const {parentPort}=require('node:worker_threads');global.self={postMessage:(data,transfer)=>parentPort.postMessage(data,transfer)};parentPort.on('message',data=>self.onmessage?.({data}));import(${JSON.stringify(url)}).then(()=>parentPort.postMessage({type:'ready'}));`,{eval:true});
 try{const result=await new Promise((resolve,reject)=>{worker.on('error',reject);worker.on('message',data=>{if(data.type==='ready')worker.postMessage({type:'load',file:new Blob(['x,y,z,value\n0,1,2,8\n1,2,3,9']),config,columns:4});if(data.type==='progress')worker.postMessage({type:'accepted'});if(data.type==='done')resolve(data);if(data.type==='error')reject(Error(data.message));});});assert.equal(result.total,2);assert.deepEqual(Array.from(result.values),[8,9]);assert.deepEqual(Array.from(result.rows),[1,2]);}
 finally{await worker.terminate();}
});
