import test from 'node:test';
import assert from 'node:assert/strict';
import {createTpmsPreviewJob} from '../ui/tpms-preview-job.js';
test('obsolete worker results never replace the current preview and workers are terminated',()=>{
 const workers=[],results=[],errors=[],job=createTpmsPreviewJob({onResult:g=>results.push(g),onError:e=>errors.push(e),workerFactory:()=>{const w={dead:0,terminate(){this.dead++;},postMessage(m){this.request=m;}};workers.push(w);return w;}});
 job.run({expr:'old'},16);const old=workers[0];job.run({expr:'new'},24);const current=workers[1];old.onmessage({data:{id:old.request.id,grid:'old'}});assert.deepEqual(results,[]);current.onmessage({data:{id:current.request.id,grid:'new'}});assert.deepEqual(results,['new']);assert.ok(old.dead);assert.ok(current.dead);job.run({},16);const late=workers[2];job.dispose();late.onmessage({data:{id:late.request.id,error:'late error'}});assert.deepEqual(errors,[]);
});
test('sampling and worker startup failures are surfaced without pretending to have current data',()=>{
 const errors=[];let worker;const job=createTpmsPreviewJob({onResult(){throw Error('Unexpected result');},onError:e=>errors.push(e),workerFactory:()=>worker={terminate(){},postMessage(m){this.id=m.id;}}});job.run({},16);worker.onmessage({data:{id:worker.id,error:'Invalid expression'}});assert.deepEqual(errors,['Invalid expression']);job.dispose();const failed=createTpmsPreviewJob({onResult(){},onError:e=>errors.push(e),workerFactory:()=>{throw Error('Worker unavailable');}});failed.run({},16);assert.equal(errors.at(-1),'Worker unavailable');failed.dispose();
});
