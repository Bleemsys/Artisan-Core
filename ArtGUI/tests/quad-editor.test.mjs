import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createQuadMesherEditor} from '../ui/quad-mesher-editor.js';
import {prepareFieldOperation} from '../ui/field-workflow.js';
test('report displays exact large element counts and keeps saved output distinct from edited settings',async()=>{
 const p={mesh_file:'shoe.stl',size_field:'Size',export_mesh:'Quads'};prepareFieldOperation('Gen_QuadMesh_SizeField',p);
 const doc={Setup:{},WorkFlow:{'1':{OP_ExprOperation_GridField:{out_gridFieldFile:'Size'}},'2':{Gen_QuadMesh_SizeField:p}}};
 const controls=new Map(),tools={innerHTML:'',querySelectorAll:()=>[],setAttribute:()=>{}},host={innerHTML:'',querySelectorAll:()=>[],querySelector:id=>{if(id==='#quad-open-report')return null;if(!controls.has(id))controls.set(id,{});return controls.get(id);}};
 const previous=globalThis.document;globalThis.document={getElementById:()=>tools};let bindings=0;
 try{
  const editor=createQuadMesherEditor({getContext:()=>({doc,key:'2'}),onChange:()=>{},onRender:()=>bindings++,onReport:async()=>({path:'report.json',report:{valid:true,final:{vertices:203138,quadrilaterals:203136,triangles:0,scaled_jacobian_percentiles:[.007,.1,.3,.5,1],edge_to_target_percentiles:[.1,.3,.9,1.5,2],surface_error:{maximum:1.17}},surface_tolerance:2}}),toast:e=>{throw Error(e);}});
  p.quality_report='report.json';editor.show(host,p);await editor.loadReport(p,true);
  assert.match(host.innerHTML,/203,136/);assert.match(host.innerHTML,/203,138/);assert.doesNotMatch(host.innerHTML,/203,140/);assert.match(host.innerHTML,/Saved report/);
  p.split_to_triangles=true;editor.refresh();assert.match(host.innerHTML,/Split triangles/);assert.match(tools.innerHTML,/Quad mesh/);assert.ok(bindings>=3);
 }finally{globalThis.document=previous;}
});

test('method selector changes the workflow while retaining shared settings',()=>{
 const p={mesh_file:'shoe.stl',size_field:'Size',export_mesh:'Quads'};prepareFieldOperation('Gen_QuadMesh_SizeField',p);
 const doc={Setup:{},WorkFlow:{'1':{OP_ExprOperation_GridField:{out_gridFieldFile:'Size'}},'2':{Gen_QuadMesh_SizeField:p}}};
 const method={dataset:{quadValue:'method'},type:'select-one',value:'Subdivision'};
 const controls=new Map(),tools={querySelectorAll:()=>[],setAttribute:()=>{}},host={innerHTML:'',querySelectorAll:s=>s==='[data-quad-value]'?[method]:[],querySelector:id=>{if(id==='#quad-open-report')return null;if(!controls.has(id))controls.set(id,{});return controls.get(id);}};
 const previous=globalThis.document;globalThis.document={getElementById:()=>tools};let changes=0;
 try{
  const editor=createQuadMesherEditor({getContext:()=>({doc,key:'2'}),onChange:()=>changes++,toast:e=>{throw Error(e);}});
  editor.show(host,p);assert.match(host.innerHTML,/id="quad-method"/);assert.match(host.innerHTML,/value="SimpleQuad" selected/);
  method.onchange();assert.equal(p.method,'Subdivision');assert.equal(p.size_field,'Size');assert.equal(changes,1);
  assert.match(host.innerHTML,/value="Subdivision" selected/);assert.match(host.innerHTML,/Triangle adaptation passes before subdivision/);
 }finally{globalThis.document=previous;}
});
