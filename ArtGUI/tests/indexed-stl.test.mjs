import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readStlStream,IndexedBatch} from '../ui/stl-stream.mjs';
import {indexedGroup,indexedDisplay,geometryMemoryBytes} from '../ui/indexed-geometry.mjs';
import * as THREE from '../ui/vendor/three.module.js';
const faces=[[0,0,0,1,0,0,0,1,0],[1,0,0,1,1,0,0,1,0]];
function binary(triangles=faces){const bytes=new Uint8Array(84+50*triangles.length),view=new DataView(bytes.buffer);bytes.set(new TextEncoder().encode('solid binary'));view.setUint32(80,triangles.length,true);triangles.forEach((f,i)=>f.forEach((v,j)=>view.setFloat32(84+i*50+12+j*4,v,true)));return bytes;}
async function* split(bytes,size=7){for(let i=0;i<bytes.length;i+=size)yield bytes.subarray(i,i+size);}
async function parse(bytes,options={}){const chunks=[];const result=await readStlStream(split(bytes),{fileSize:bytes.length,onChunk:c=>chunks.push(c),...options});return {...result,chunks};}
function reconstructed(chunks){return chunks.flatMap(c=>Array.from(c.indices).flatMap(i=>[0,1,2].map(j=>c.positions[3*i+j]+c.center[j])));}
test('binary records split at arbitrary bytes retain every triangle and share exact vertices',async()=>{
 const r=await parse(binary());assert.equal(r.triangles,2);assert.equal(r.chunks[0].positions.length,12);
 assert.ok(r.chunks[0].indices instanceof Uint16Array);assert.deepEqual(reconstructed(r.chunks),faces.flat());assert.deepEqual(r.bounds,[[0,0,0],[1,1,0]]);
});
test('batch boundaries preserve all faces and coordinates without a global vertex table',async()=>{
 const r=await parse(binary(),{batchTriangles:1});assert.equal(r.chunks.length,2);assert.deepEqual(reconstructed(r.chunks),faces.flat());
 assert.ok(r.chunks.every(c=>c.indices.length===3&&c.positions.length===9));
});
test('ASCII parsing streams text, handles CRLF and missing final newline',async()=>{
 const text='solid test\r\n'+faces.map(f=>'facet normal 0 0 1\r\nouter loop\r\n'+[0,3,6].map(i=>'vertex '+f.slice(i,i+3).join(' ')).join('\r\n')+'\r\nendloop\r\nendfacet\r\n').join('')+'endsolid';
 const r=await parse(new TextEncoder().encode(text));assert.deepEqual(reconstructed(r.chunks),faces.flat());
});
test('malformed coordinates, truncated records and cancellation reject instead of publishing a model',async()=>{
 const bad=binary();new DataView(bad.buffer).setFloat32(96,NaN,true);await assert.rejects(parse(bad),/invalid coordinates/);
 const original=binary();await assert.rejects(readStlStream(split(original.subarray(0,-1)),{fileSize:original.length}),/ended before/);
 await assert.rejects(parse(original,{isCancelled:()=>true}),{name:'AbortError'});
});
test('numeric hash resolves collisions and signed zero without merging distinct points',()=>{
 const b=new IndexedBatch(10000);
 for(let i=0;i<10000;i++)assert.equal(b.vertex(i%100,Math.floor(i/100),0),i);
 for(let i=0;i<10000;i++)assert.equal(b.vertex(i%100,Math.floor(i/100),-0),i);
 assert.equal(b.vertices,10000);
});
test('vertex indices use 32 bits when a batch has more than 65536 unique points',()=>{
 const b=new IndexedBatch();for(let i=0;i<22000;i++)b.triangle([i,0,0,i,1,0,i,2,0]);
 const r=b.finish();assert.ok(r.indices instanceof Uint32Array);assert.equal(r.positions.length/3,66000);
});
test('indexed rendering preserves picking, counts indices, and releases lazy wireframe buffers',async()=>{
 const r=await parse(binary(),{batchTriangles:1});
 const uniforms={displayMode:{value:0}},surface=new THREE.ShaderMaterial({uniforms,side:THREE.DoubleSide,fragmentShader:'if(displayMode!=0){ }'}),line=new THREE.ShaderMaterial({uniforms});
 const group=indexedGroup(r.chunks,r.center,surface,line);group.position.fromArray(r.center);group.updateMatrixWorld(true);
 assert.equal(geometryMemoryBytes(group),84); // six points + six uint16 indices
 const ray=new THREE.Raycaster(new THREE.Vector3(.2,.2,1),new THREE.Vector3(0,0,-1));
 const hit=ray.intersectObject(group,true)[0];assert.ok(hit);assert.equal(hit.point.z,0);assert.equal(hit.object.geometry.index.count,3);
 indexedDisplay(group,'wireframe');assert.equal(group.children[0].material.visible,false);assert.equal(geometryMemoryBytes(group),108);
 indexedDisplay(group,'edges');assert.equal(group.children[0].material.visible,true);
 indexedDisplay(group,'solid');assert.equal(geometryMemoryBytes(group),84);assert.equal(group.children[0].children.length,0);
});

test('full STL worker transfers indexed batches and completes after acknowledgement',async()=>{
 const {Worker}=await import('node:worker_threads');
 const workerUrl=new URL('../ui/full-stl-worker.js',import.meta.url).href;
 const worker=new Worker(`const {parentPort}=require('node:worker_threads');global.self={postMessage:(data,transfer)=>parentPort.postMessage(data,transfer)};parentPort.on('message',data=>self.onmessage?.({data}));import(${JSON.stringify(workerUrl)}).then(()=>parentPort.postMessage({type:'ready'}));`,{eval:true});
 const chunks=[],bytes=binary();
 try{
  const result=await new Promise((resolve,reject)=>{
   worker.on('error',reject);
   worker.on('message',data=>{
    if(data.type==='ready')worker.postMessage({url:'data:application/octet-stream;base64,'+Buffer.from(bytes).toString('base64'),fileSize:bytes.length});
    if(data.type==='chunk'){chunks.push(data);worker.postMessage({type:'chunk-accepted'});}
    if(data.type==='error')reject(Error(data.message));
    if(data.type==='done')resolve(data);
   });
  });
  assert.equal(result.totalTriangles,2);assert.deepEqual(reconstructed(chunks),faces.flat());
  assert.ok(chunks[0].positions instanceof Float32Array);assert.ok(chunks[0].indices instanceof Uint16Array);
 }finally{await worker.terminate();}
});

test('range reads accept server-shortened responses and never request the entire file',async()=>{
 const {stlByteRanges}=await import('../ui/stl-source.mjs');const bytes=binary(),requests=[],output=[];
 const fetchImpl=async(_url,{headers})=>{
  const [start,end]=headers.Range.slice(6).split('-').map(Number);requests.push([start,end]);
  const actualEnd=Math.min(end,start+10),body=bytes.slice(start,actualEnd+1);
  return new Response(body,{status:206,headers:{'content-range':`bytes ${start}-${actualEnd}/${bytes.length}`}});
 };
 for await(const chunk of stlByteRanges('test',bytes.length,{rangeBytes:50,fetchImpl}))output.push(...chunk);
 assert.deepEqual(output,Array.from(bytes));assert.ok(requests.every(([a,b])=>b-a<50));
});
test('large files reject ignored ranges and mismatched range offsets',async()=>{
 const {stlByteRanges}=await import('../ui/stl-source.mjs');
 async function collect(fetchImpl){for await(const _ of stlByteRanges('test',100,{rangeBytes:50,fetchImpl})){} }
 await assert.rejects(collect(async()=>new Response(new Uint8Array(100))),/must support byte ranges/);
 await assert.rejects(collect(async()=>new Response(new Uint8Array(50),{status:206,headers:{'content-range':'bytes 1-50/100'}})),/does not match/);
});
