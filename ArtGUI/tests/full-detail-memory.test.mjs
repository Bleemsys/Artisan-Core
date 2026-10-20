import {test} from 'node:test';
import assert from 'node:assert/strict';
import {assessFullDetailMemory,createFullDetailMemoryGuard} from '../ui/full-detail-memory.mjs';
import {loadIndexedGeometry} from '../ui/full-detail-load.mjs';
const MIB=1024**2,GIB=1024**3;
const tick=()=>new Promise(setImmediate);
const snapshot=(time=10000,available=20*GIB,total=32*GIB)=>({sampledAt:time,totalBytes:total,availableBytes:available});
test('reserve scales with installed RAM, not a fixed graphics size',()=>{
 assert.equal(assessFullDetailMemory(snapshot(),{now:10000,pendingBytes:2*GIB}).warning,false);
 const low=assessFullDetailMemory(snapshot(10000,2*GIB),{now:10000,pendingBytes:8*MIB});
 assert.equal(low.warning,true);assert.equal(low.reserveBytes,2*GIB);
 assert.equal(assessFullDetailMemory(snapshot(10000,2*GIB,8*GIB),{now:10000}).warning,false);
});
test('stale and unavailable telemetry warn rather than inventing capacity',()=>{
 for(const value of [null,snapshot(1),{...snapshot(),availableBytes:NaN}])assert.equal(assessFullDetailMemory(value,{now:10000}).warning,true);
});
test('continue permission expires by bytes and time; healthy readings restore protection',async()=>{
 let time=10000,warnings=0,available=GIB;
 const guard=createFullDetailMemoryGuard({now:()=>time,invoke:async()=>snapshot(time,available),pause:async()=>{warnings++;return true;}});
 await guard.check({nextBytes:MIB});assert.equal(warnings,1);
 await guard.check({currentBytes:MIB,nextBytes:MIB});assert.equal(warnings,1);
 await guard.check({currentBytes:66*MIB,nextBytes:MIB});assert.equal(warnings,2);
 time+=5001;await guard.check({currentBytes:67*MIB});assert.equal(warnings,3);
 available=20*GIB;time+=1001;await guard.check({currentBytes:68*MIB});
 available=GIB;time+=1001;await guard.check({currentBytes:69*MIB});assert.equal(warnings,4);
});
test('declining or cancelling a paused check aborts the load',async()=>{
 const guard=createFullDetailMemoryGuard({now:()=>10000,invoke:async()=>null,pause:async()=>false});
 await assert.rejects(guard.check(),{name:'AbortError'});
 const controller=new AbortController();controller.abort();
 const aborted=createFullDetailMemoryGuard({signal:controller.signal,invoke:()=>assert.fail(),pause:()=>assert.fail()});
 await assert.rejects(aborted.check(),{name:'AbortError'});
});
function loading({lowAfterFirst=false,failUpload=false,pause=async()=>false}={}){
 let reads=0,disposed=0,committed=0;const messages=[],controller=new AbortController();
 const worker={postMessage:m=>messages.push(m),terminate(){this.stopped=true;}};
 const stage={bytes:0,estimate:()=>16*MIB,append(){if(failUpload)throw Error('graphics allocation failed');this.bytes+=16*MIB;},async commit(){committed++;},dispose(){disposed++;}};
 const result=loadIndexedGeometry({worker,viewer:{beginFullDetail:()=>stage},layerId:'result',path:'test.stl',url:'test',fileSize:100,signal:controller.signal,
  invoke:async()=>{reads++;return snapshot(Date.now(),lowAfterFirst&&reads>1?GIB:20*GIB);},pause,yieldFrame:async()=>{}});
 return {worker,messages,controller,stage,result,get disposed(){return disposed;},get committed(){return committed;}};
}
test('worker acknowledgement waits for the memory decision and successful batch upload',async()=>{
 let resume;const s=loading({lowAfterFirst:true,pause:()=>new Promise(resolve=>resume=resolve)});
 await tick();assert.equal(s.messages.length,1);
 await s.worker.onmessage({data:{type:'chunk'}});assert.equal(s.messages.length,2);assert.equal(s.committed,0);
 const second=s.worker.onmessage({data:{type:'chunk'}});await tick();
 assert.equal(s.messages.length,2);assert.equal(s.stage.bytes,16*MIB);
 resume(true);await second;assert.equal(s.messages.length,3);
 await s.worker.onmessage({data:{type:'done',totalTriangles:2}});
 assert.equal((await s.result).staged,true);assert.equal(s.committed,1);assert.equal(s.disposed,0);
});
test('graphics failure terminates the worker and disposes staged data without committing',async()=>{
 const s=loading({failUpload:true});const rejected=assert.rejects(s.result,/graphics allocation failed/);await tick();
 await s.worker.onmessage({data:{type:'chunk'}});await rejected;
 assert.equal(s.messages.length,1);assert.equal(s.committed,0);assert.equal(s.disposed,1);assert.equal(s.worker.stopped,true);
});
test('cancel while paused releases the staged load and cannot acknowledge a late resume',async()=>{
 let resume;const s=loading({lowAfterFirst:true,pause:()=>new Promise(resolve=>resume=resolve)});
 const rejected=assert.rejects(s.result,{name:'AbortError'});await tick();await s.worker.onmessage({data:{type:'chunk'}});
 const pending=s.worker.onmessage({data:{type:'chunk'}});await tick();s.controller.abort();await rejected;
 resume(true);await pending;assert.equal(s.messages.length,2);assert.equal(s.committed,0);assert.equal(s.disposed,1);
});
