import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as THREE from '../ui/vendor/three.module.js';
import {GeometryViewer} from '../ui/viewer.js';
import {createFieldInspector} from '../ui/field-inspector.js';
import {geometryOpacity,saveGeometryOpacity,applyGeometryOpacities,validateObjectOpacities} from '../ui/object-opacity.js';
import {validatePointReferences} from '../ui/point-cloud-inspector.js';
import {parseNumericJson,stringifyNumericJson} from '../ui/numeric-json.js';
import {translate} from '../ui/i18n.js';
let JSDOM;try{({JSDOM}=await import(process.env.ARTGUI_TEST_DOM||'jsdom'));}catch{}
const skip=!JSDOM?'Install jsdom or set ARTGUI_TEST_DOM to run DOM integration checks':false;

function viewer(){
 const v=Object.create(GeometryViewer.prototype);
 Object.assign(v,{settings:{sourceColor:'#ededed'},layerColors:new Map(),layerOpacities:new Map(),layers:new Map(),fieldLayers:new Map(),scene:new THREE.Scene(),origin:new THREE.Vector3(),hasOrigin:false,measurements:[],pending:[],section:{enabled:false},plane:new THREE.Vector4()});
 for(const method of ['setDisplay','setActiveLayer','refreshLayers','refreshHelpers','updateSection','redrawMeasurements','fit','validateUpload','render'])v[method]=()=>{};
 v.$=()=>null;return v;
}
const triangle=()=>new Float32Array([0,0,0,1,0,0,0,1,0]);

test('source, reference and result opacity round-trip without changing Artisan parameters',()=>{
 const doc=parseNumericJson('{"Setup":{"res":[0.8,0.8,0.8]},"WorkFlow":{},"PostProcess":{},"ArtGUI":{"version":1,"geometry":[{"id":"geometry-a","path":"a.stl"},{"id":"geometry-b","path":"b.stl"},{"id":"result","path":"r.stl"}],"supportingFiles":[]}}');
 const setup=stringifyNumericJson(doc.Setup);
 for(const [id,value] of [['source',.2],['geometry-a',0],['geometry-b',.7],['result',1]])saveGeometryOpacity(doc,id,value);
 const restored=JSON.parse(stringifyNumericJson(doc));validateObjectOpacities(restored.ArtGUI);
 for(const [id,value] of [['source',.2],['geometry-a',0],['geometry-b',.7],['result',1]])assert.equal(geometryOpacity(restored,id),value);
 assert.equal(stringifyNumericJson(doc.Setup),setup);assert.equal(saveGeometryOpacity(doc,'source',.2),false);
 assert.equal(saveGeometryOpacity(doc,'support-test',.4),false);
});

test('geometry opacity is independent before loading, through full-detail replacement and across projects',async()=>{
 const v=viewer(),doc={};saveGeometryOpacity(doc,'source',.35);applyGeometryOpacities(v,doc);
 let notices=0;v.onLayerOpacityChanged=()=>notices++;
 v.setLayer('source',triangle(),{center:[0,0,0],mode:'quick',lines:new Float32Array([0,0,0,1,0,0])});
 v.setLayer('geometry-b',triangle(),{center:[0,0,0]});
 assert.equal(notices,0);
 const a=v.layers.get('source');assert.equal(a.material.uniforms.opacity.value,.35);assert.equal(a.mesh.children[0].material.uniforms.opacity.value,.35);
 v.setOpacity('source',.2);assert.equal(v.layers.get('geometry-b').material.uniforms.opacity.value,1);assert.equal(notices,1);
 assert.equal(a.material.transparent,true);assert.equal(a.material.depthWrite,false);
 const stage=v.beginFullDetail('source','a.stl');stage.append({positions:triangle(),indices:new Uint16Array([0,1,2]),center:[0,0,0]});
 v.setOpacity('source',.65);await stage.commit({center:[0,0,0],bounds:[[0,0,0],[1,1,0]],totalTriangles:1});
 assert.equal(v.layers.get('source').material.uniforms.opacity.value,.65);
 v.layers.get('source').mesh.traverse(child=>{if(child.material)assert.equal(child.material.uniforms.opacity.value,.65);});
 v.setOpacity('source',1);assert.equal(v.layers.get('source').material.transparent,false);assert.equal(v.layers.get('source').material.depthWrite,true);
 v.layers.clear();applyGeometryOpacities(v,{});v.setLayer('source',triangle(),{center:[0,0,0]});assert.equal(v.layers.get('source').material.uniforms.opacity.value,1);
});

test('invalid opacities are rejected while old project and point settings remain usable',()=>{
 for(const value of [-1,1.01,NaN,Infinity,'0.5',null]){
  assert.throws(()=>validateObjectOpacities({sourceOpacity:value}));
  assert.throws(()=>validateObjectOpacities({geometry:[{opacity:value}]}));
  assert.throws(()=>validateObjectOpacities({fields:[{opacityByField:{stress:value}}]}));
  assert.throws(()=>viewer().setOpacity('source',value));
 }
 assert.doesNotThrow(()=>validateObjectOpacities({geometry:[],fields:[]}));assert.equal(geometryOpacity({},'source'),1);
 const ref={id:'points-a',path:'a.csv',columns:['x','y','z'],config:{delimiter:',',header:true,axes:[0,1,2],scalar:-1,limit:100000},style:{map:'viridis',size:3,range:[0,1],visible:true,lock:true,meshOpacity:.25}};
 assert.doesNotThrow(()=>validatePointReferences([ref]));ref.style.opacity=.5;assert.doesNotThrow(()=>validatePointReferences([ref]));ref.style.opacity=2;assert.throws(()=>validatePointReferences([ref]));
 assert.equal(translate('Point opacity','zh-CN'),'点云不透明度');
});

function domFixture(){
 const dom=new JSDOM('<div id="properties-title"></div><div id="properties-subtitle"></div><div id="properties-content"></div><div id="layer-controls"></div><div id="viewer-toolbar"></div><div id="viewport"><canvas></canvas><div id="viewport-empty"></div></div><span id="mesh-info"></span>');
 const previous=globalThis.document;globalThis.document=dom.window.document;
 return {dom,restore(){globalThis.document=previous;dom.window.close();}};
}
test('geometry Properties contains only its own opacity and stays synchronized with Visibility',{skip},()=>{
 const f=domFixture();try{
  const v=viewer();v.$=id=>document.getElementById(id);
  const doc={Setup:{},ArtGUI:{version:1,geometry:[{id:'geometry-a',path:'a.stl'},{id:'geometry-b',path:'b.stl'}],supportingFiles:[]}};
  v.onLayerOpacityChanged=(id,value)=>saveGeometryOpacity(doc,id,value);
  document.getElementById('layer-controls').innerHTML='<input data-layer-opacity="geometry-a" value="1"><input data-layer-opacity="geometry-b" value="1">';
  const source=readFileSync(new URL('../ui/app.js',import.meta.url),'utf8'),show=source.slice(source.indexOf('  function showFileProperties('),source.indexOf('  function refreshTimeline('));
  const context=vm.createContext({doc,viewer:v,$:id=>document.getElementById(id),nameForPath:p=>p,esc:String,section:(title,body)=>`<section>${title}${body}</section>`,geometryColour:()=> '#ededed',geometryOpacity,saveGeometryOpacity,geometryBounds:()=>'',fileIssues:new Map(),markDirty(){}});
  vm.runInContext(show,context);context.showFileProperties(doc.ArtGUI.geometry[0]);
  const control=document.getElementById('file-opacity');control.value='40';control.dispatchEvent(new f.dom.window.Event('input'));
  assert.equal(doc.ArtGUI.geometry[0].opacity,.4);assert.equal(doc.ArtGUI.geometry[1].opacity,undefined);
  assert.equal(document.querySelector('[data-layer-opacity="geometry-a"]').value,'0.4');assert.equal(document.querySelector('[data-layer-opacity="geometry-b"]').value,'1');
  assert.equal(document.querySelectorAll('#properties-content input[type="range"]').length,1);
  assert.doesNotMatch(document.getElementById('properties-content').textContent,/Point opacity|Field opacity|Mesh opacity/);
  context.showFileProperties(doc.ArtGUI.geometry[1]);assert.equal(document.getElementById('file-opacity').value,'100');
  context.showFileProperties(doc.ArtGUI.geometry[0]);assert.equal(document.getElementById('file-opacity').value,'40');
  const support={id:'support-mesh',path:'support.inp'};doc.ArtGUI.supportingFiles.push(support);
  context.showFileProperties(support,true);document.getElementById('file-opacity').value='55';document.getElementById('file-opacity').dispatchEvent(new f.dom.window.Event('input'));
  assert.equal(support.opacity,.55);assert.equal(geometryOpacity(doc,support.id),.55);validateObjectOpacities(doc.ArtGUI);
  context.showFileProperties({id:'support-text',path:'notes.txt'},true);assert.equal(document.getElementById('file-opacity'),null);
 }finally{f.restore();}
});

function slicePayload(){
 const header={version:1,axis:2,position:0,varying:[0,1],coordinates:[[0,1],[0,1]],shape:[2,2],transform:[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]},text=new TextEncoder().encode(JSON.stringify(header)),bytes=new Uint8Array(4+text.length+32),view=new DataView(bytes.buffer);
 view.setUint32(0,text.length,true);bytes.set(text,4);[1,2,3,4].forEach((value,i)=>view.setFloat64(4+text.length+i*8,value,true));return bytes;
}
test('fields own their opacity per file and field ID, preserving every mesh and other field',{skip},async()=>{
 const f=domFixture();let inspector;try{
  const v=viewer();v.canvas=document.querySelector('canvas');
  v.setLayer('source',triangle(),{center:[0,0,0]});v.setOpacity('source',.6);v.layers.get('source').mesh.visible=false;
  const refs=[],errors=[];let active='',dirty=0;
  const info=path=>({handle:path,path,fields:['stress','temperature'].map(id=>({id,coordinateSpace:'model',blocks:[{id:0,supported:true,shape:[2,2,2],bounds:[[0,1],[0,1],[0,1]],dtype:'float64',statistics:{minimum:1,maximum:4,nanCount:0,infCount:0}}]}))});
  inspector=createFieldInspector({invoke:async(command,args)=>command==='open_field_file'?info(args.path):command==='read_field_slice'?slicePayload():null,getViewer:()=>v,getReferences:()=>refs,addReference:ref=>refs.push(ref),removeReference(){},onSelect:id=>{active=id;inspector.renderProperties(id);},onChange:()=>{if(active)inspector.renderProperties(active);},onReferenceChanged:()=>dirty++,toast:message=>errors.push(message)});
  await inspector.load('a.h5');const a=refs[0].id;
  assert.equal(errors.length,0);assert.equal(document.getElementById('field-mesh-opacity'),null);assert.equal(document.getElementById('field-show-mesh'),null);
  const change=value=>{const input=document.getElementById('field-opacity');input.value=String(value);input.dispatchEvent(new f.dom.window.Event('input'));};
  change(.3);assert.equal(v.fieldLayers.get(a).mesh.material.uniforms.opacity.value,.3);assert.equal(v.fieldLayers.get(a).group.children[1].material.opacity,.3);
  await inspector.load('b.h5');const b=refs[1].id;change(.7);
  assert.equal(v.fieldLayers.get(a).mesh.material.uniforms.opacity.value,.3);assert.equal(v.fieldLayers.get(b).mesh.material.uniforms.opacity.value,.7);
  assert.equal(v.layers.get('source').material.uniforms.opacity.value,.6);assert.equal(v.layers.get('source').mesh.visible,false);
  await inspector.select(a,'temperature');assert.equal(document.getElementById('field-opacity').value,'0.85');change(.45);
  await inspector.select(a,'stress');assert.equal(document.getElementById('field-opacity').value,'0.3');
  assert.deepEqual(refs[0].opacityByField,{stress:.3,temperature:.45});assert.equal(dirty>0,true);
  const saved=JSON.parse(JSON.stringify(refs));validateObjectOpacities({fields:saved});
  inspector.reset();await inspector.select(b);assert.equal(v.fieldLayers.get(b).mesh.material.uniforms.opacity.value,.7);
  assert.equal(v.layers.get('source').material.uniforms.opacity.value,.6);assert.equal(v.layers.get('source').mesh.visible,false);
  change(0);assert.equal(v.fieldLayers.get(b).pick({}),null);assert.equal(v.fieldLayers.get(b).group.children[1].material.opacity,0);
 }finally{inspector?.reset();f.restore();}
});
