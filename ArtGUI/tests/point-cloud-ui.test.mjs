import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Worker as NodeWorker} from 'node:worker_threads';
import * as THREE from '../ui/vendor/three.module.js';
import {createPointCloudInspector,validatePointReferences} from '../ui/point-cloud-inspector.js';
import {csvReferences} from '../ui/csv-references.mjs';
let JSDOM;try{({JSDOM}=await import(process.env.ARTGUI_TEST_DOM||'jsdom'));}catch{}
const skip=!JSDOM?'Install jsdom or set ARTGUI_TEST_DOM to run DOM integration checks':false;
const tick=()=>new Promise(resolve=>setTimeout(resolve,15));
async function waitFor(check){for(let i=0;i<200;i++){if(check())return;await tick();}throw Error('UI state timed out');}
const csv='x,y,z,cell_size,stress\n0,0,0,8,12\n1,0,0,12,16\n0,1,0,16,20\n';
function fixture({workflow={},workflowPath='C:/project/workflow.json',missing=false}={}){
 const dom=new JSDOM('<div id="project-tree"></div><div id="properties-title"></div><div id="properties-subtitle"></div><div id="properties-content"></div><div id="modal"></div><div id="viewport"><canvas id="canvas"></canvas><div id="viewport-empty"></div></div><div id="preview-progress"><progress id="preview-progress-bar"></progress><span id="preview-progress-text"></span></div><span id="mesh-info"></span>',{url:'http://localhost/'});
 const saved={window:globalThis.window,document:globalThis.document,Worker:globalThis.Worker};globalThis.window=dom.window;globalThis.document=dom.window.document;
 const workerURL=new URL('../ui/csv-point-worker.js',import.meta.url).href;
 globalThis.Worker=class{
  constructor(){this.worker=new NodeWorker(`const {parentPort}=require('node:worker_threads');global.self={postMessage:(data,transfer)=>parentPort.postMessage(data,transfer)};const ready=import(${JSON.stringify(workerURL)});parentPort.on('message',data=>ready.then(()=>self.onmessage({data})));`,{eval:true});this.worker.on('message',data=>this.onmessage?.({data}));this.worker.on('error',error=>this.onerror?.(error));}
  postMessage(data){if(data.url)data={...data,file:new Blob([csv]),size:csv.length};this.worker.postMessage(data);}
  terminate(){this.worker.terminate();}
 };
 const refs=[],errors=[],calls=[],canvas=document.getElementById('canvas');canvas.getBoundingClientRect=()=>({left:0,top:0,width:200,height:200});const viewer={scene:new THREE.Scene(),origin:new THREE.Vector3(),hasOrigin:false,section:{enabled:false},plane:new THREE.Vector4(0,0,1,0),fieldLayers:new Map(),layers:new Map(),canvas,
  renderer:{getContext:()=>({ALIASED_POINT_SIZE_RANGE:1,getParameter:()=>[1,64]}),getPixelRatio:()=>1},validateUpload(){},refreshHelpers(){},fit(){},setMeasureMode(){},setOpacity(id,value){this.layers.get(id).material.uniforms.opacity.value=value;},render(){this.onBeforePointCloudRender?.();this.onPointCloudRender?.();}};
 viewer.camera=new THREE.PerspectiveCamera(60,1,.1,100);viewer.camera.position.set(0,0,3);viewer.camera.lookAt(0,0,0);viewer.camera.updateMatrixWorld();viewer.radius=()=>1;
 viewer.layers.set('source',{material:{uniforms:{opacity:{value:1}}}});
 let inspector,selected='';const refresh=()=>{document.getElementById('project-tree').innerHTML=inspector.treeHtml();inspector.bindTree();if(selected)inspector.renderProperties(selected);};
 inspector=createPointCloudInspector({invoke:async(command,args)=>{calls.push({command,args});if(command==='choose_supporting_file')return 'sole_points.csv';if(command==='resolve_geometry'){if(missing)throw Error('CSV file was not found');return {path:'fake.csv',size:csv.length};}if(command==='resource_snapshot')return {sampledAt:Date.now(),totalBytes:32*1024**3,availableBytes:20*1024**3};throw Error(command);},getViewer:()=>viewer,getReferences:()=>refs,getCsvReferences:()=>csvReferences(workflow),getWorkflowPath:()=>workflowPath,
  addReference:ref=>refs.push(ref),removeReference:id=>{refs.splice(refs.findIndex(r=>r.id===id),1);selected='';},onSelect:id=>{selected=id;refresh();},onChange:refresh,onReferenceChanged(){},toast:message=>errors.push(message),
  showModal:html=>{document.getElementById('modal').innerHTML=html;document.querySelectorAll('[data-close]').forEach(button=>button.onclick=()=>document.getElementById('modal').replaceChildren());},closeModal:()=>document.getElementById('modal').replaceChildren(),pauseMemory:async()=>false});
 window.__TAURI__={core:{convertFileSrc:path=>path}};inspector.attachViewer();refresh();
 return {inspector,viewer,refs,errors,calls,refresh,dom,restore(){inspector.reset();dom.window.close();Object.assign(globalThis,saved);}};
}
test('CSV import, inspector controls, field changes and removal work without a data table',{skip},async()=>{
 const f=fixture();try{
  await f.inspector.importSource('sole_points.csv',new Blob([csv]));
  assert.equal(document.querySelectorAll('table').length,0);assert.equal(document.getElementById('csv-axis-0').value,'0');
  await document.getElementById('csv-import-confirm').onclick();
  assert.equal(f.errors.length,0);assert.equal(f.refs.length,1);
  f.viewer.scene.updateMatrixWorld(true);const layer=f.viewer.fieldLayers.values().next().value,point=new THREE.Vector3(...layer.data.coordinates.subarray(0,3)).sub(f.viewer.origin).project(f.viewer.camera);
  assert.equal(f.viewer.pickPointCloud({clientX:(point.x+1)*100,clientY:(1-point.y)*100}),true);assert.match(document.querySelector('.point-cloud-tip').textContent,/Data row 1/);
  assert.equal(f.viewer.fieldLayers.size,1);
  assert.match(document.getElementById('mesh-info').textContent,/3 of 3 points/);assert.equal(document.querySelectorAll('table').length,0);
  const size=document.getElementById('point-size');size.value='7';size.dispatchEvent(new f.dom.window.Event('input'));assert.equal(f.refs[0].style.size,7);
  const range=document.getElementById('point-minimum');range.value='5';range.dispatchEvent(new f.dom.window.Event('change'));assert.deepEqual(f.refs[0].style.range,[5,16]);
  const color=document.getElementById('point-color');color.value='4';color.dispatchEvent(new f.dom.window.Event('change'));
  await waitFor(()=>f.refs[0].config.scalar===4&&document.getElementById('point-color'));
  assert.deepEqual(f.refs[0].style.range,[12,20]);assert.match(document.getElementById('point-cloud-legend').textContent,/Stress/);
  assert.doesNotThrow(()=>validatePointReferences(JSON.parse(JSON.stringify(f.refs))));
  document.getElementById('remove-point-cloud').click();assert.equal(f.refs.length,0);assert.equal(f.viewer.fieldLayers.size,0);assert.equal(f.viewer.layers.get('source').material.uniforms.opacity.value,1);
 }finally{f.restore();}
});
test('saved CSV mappings reopen without repeating the import dialog',{skip},async()=>{
 const f=fixture();try{
  f.refs.push({id:'points-123',path:'sole_points.csv',columns:['x','y','z','cell_size','stress'],config:{delimiter:',',header:true,axes:[0,1,2],scalar:4,limit:100000}});
  await f.inspector.select('points-123');assert.equal(document.getElementById('csv-import-confirm'),null);assert.equal(f.errors.length,0);assert.equal(f.viewer.fieldLayers.size,1);assert.equal(f.refs[0].config.scalar,4);
 }finally{f.restore();}
});

test('each cloud opacity affects only that cloud and never changes geometry on import or removal',{skip},async()=>{
 const f=fixture();try{
  f.viewer.layers.get('source').material.uniforms.opacity.value=.63;
  f.refs.push({id:'points-a',path:'a.csv',columns:['x','y','z','cell_size','stress'],config:{delimiter:',',header:true,axes:[0,1,2],scalar:4,limit:100000},style:{map:'viridis',size:3,range:[12,20],lock:true,visible:true,meshOpacity:.1}});
  f.refs.push({id:'points-b',path:'b.csv',columns:['x','y','z','cell_size','stress'],config:{delimiter:',',header:true,axes:[0,1,2],scalar:4,limit:100000}});
  await f.inspector.select('points-a');
  assert.equal(f.refs[0].style.opacity,1);assert.equal(f.refs[0].style.meshOpacity,undefined);
  const a=f.viewer.fieldLayers.get('points-a');
  const opacity=document.getElementById('point-opacity');opacity.value='30';opacity.dispatchEvent(new f.dom.window.Event('input'));
  assert.equal(a.points.material.uniforms.opacity.value,.3);assert.equal(a.points.material.transparent,true);assert.equal(a.points.material.depthWrite,false);
  assert.equal(document.getElementById('point-mesh-opacity'),null);assert.doesNotMatch(document.getElementById('properties-content').textContent,/Geometry opacity|Mesh opacity|Field opacity/);
  await f.inspector.select('points-b');
  const b=f.viewer.fieldLayers.get('points-b');
  assert.equal(b.points.material.uniforms.opacity.value,1);
  document.getElementById('point-opacity').value='70';document.getElementById('point-opacity').dispatchEvent(new f.dom.window.Event('input'));
  assert.equal(b.points.material.uniforms.opacity.value,.7);assert.equal(a.points.material.uniforms.opacity.value,.3);
  assert.equal(f.viewer.layers.get('source').material.uniforms.opacity.value,.63);
  await f.inspector.select('points-a');assert.equal(document.getElementById('point-opacity').value,'30');
  const saved=JSON.parse(JSON.stringify(f.refs));assert.doesNotThrow(()=>validatePointReferences(saved));
  assert.equal(saved[0].style.opacity,.3);assert.equal(saved[1].style.opacity,.7);
  document.getElementById('point-opacity').value='0';document.getElementById('point-opacity').dispatchEvent(new f.dom.window.Event('input'));
  assert.equal(a.pick({}),null);
  document.getElementById('remove-point-cloud').click();
  assert.equal(f.viewer.layers.get('source').material.uniforms.opacity.value,.63);assert.equal(b.points.material.uniforms.opacity.value,.7);
  f.inspector.reset();await f.inspector.select('points-b');
  assert.equal(f.viewer.fieldLayers.get('points-b').points.material.uniforms.opacity.value,.7);
 }finally{f.restore();}
});


test('JSON CSV references appear lazily and open through workflow-relative column mapping',{skip},async()=>{
 const workflow={WorkFlow:{1:{Read:{file:'./data/sole_points.csv'}},2:{Read:{file:'DATA\\sole_points.CSV'}}}};
 const f=fixture({workflow});try{
  assert.equal(document.querySelectorAll('[data-point-reference]').length,1);
  assert.equal(f.calls.length,0);assert.equal(f.refs.length,0);assert.equal(f.viewer.fieldLayers.size,0);
  await document.querySelector('[data-point-reference]').onclick();
  assert.deepEqual(f.calls.find(c=>c.command==='resolve_geometry').args,{path:'./data/sole_points.csv',workflowPath:'C:/project/workflow.json'});
  assert.ok(document.getElementById('csv-import-confirm'));
  await document.getElementById('csv-import-confirm').onclick();
  assert.equal(f.errors.length,0);assert.equal(f.refs.length,1);assert.equal(f.refs[0].path,'./data/sole_points.csv');
  assert.equal(document.querySelectorAll('[data-point-reference]').length,0);assert.equal(document.querySelectorAll('[data-point-cloud]').length,1);
  // Refreshing after a JSON edit picks up new paths without reading their files.
  workflow.WorkFlow[3]={Read:{file:'new.csv'}};const previousCalls=f.calls.length;f.refresh();
  assert.equal(document.querySelector('[data-point-reference]').dataset.pointReference,'new.csv');assert.equal(f.calls.length,previousCalls);
 }finally{f.restore();}
});

test('saved mappings hide duplicate JSON references and missing CSVs remain available to retry',{skip},async()=>{
 const f=fixture({workflow:{WorkFlow:{1:{Read:{file:'./data/points.csv'}}}},missing:true});try{
  await document.querySelector('[data-point-reference]').onclick();
  assert.match(f.errors[0],/not found/);assert.equal(f.refs.length,0);assert.equal(document.querySelectorAll('[data-point-reference]').length,1);
  f.refs.push({id:'points-existing',path:'DATA\\points.CSV',columns:['x','y','z'],config:{delimiter:',',header:true,axes:[0,1,2],scalar:-1,limit:100000}});f.refresh();
  assert.equal(document.querySelectorAll('[data-point-reference]').length,0);assert.equal(document.querySelectorAll('[data-point-cloud]').length,1);
 }finally{f.restore();}
});
