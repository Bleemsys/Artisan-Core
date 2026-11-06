import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {initialGeometryMode,AUTO_FULL_DETAIL_BYTES,admitFullDetail} from '../ui/preview-policy.mjs';

const source=readFileSync(new URL('../ui/app.js',import.meta.url),'utf8');
const begin=source.indexOf('  async function loadPreview(');
const prefix=source.slice(begin,source.indexOf('    const request=++previewRequest;',begin))+
 '    started.push({path,mode,layerId});\n  }';
const actual=source.slice(begin,source.indexOf('  function loadStlWorker(',begin));

function setup({bytes=100,denied=false,metadataError=false,workerError=false,invokeOverride=null,whole=false}={}){
 const elements=new Map(),commands=[],modes=[],workerCalls=[];
 const context=vm.createContext({initialGeometryMode,admitFullDetail,viewerReady:Promise.resolve(),
  viewer:{geometryBytes:()=>0,setLayer(){}},previewRequest:0,previewSelection:0,cleaningScratch:false,
  currentPath:null,started:[],fileIssues:new Map(),activePreviewJob:'',previewProgressUnlisten:null,
  previewCancelReject:null,previewWorker:null,previewAbort:null,loadedGeometryPath:'',loadedLayerId:'source',loadedPreviewMode:'',
  AbortController,Float32Array,performance:{},
  invoke:async(command,args)=>{commands.push(command);if(invokeOverride)return invokeOverride(command,args);
   if(command==='resolve_geometry'){if(metadataError)throw Error('Metadata unavailable');return {path:args.path,size:bytes};}
   if(command==='check_full_detail')return {allowed:!denied,reason:'low memory'};
   if(command==='prepare_mesh_preview')return {triangles:1,overviewCount:1};
   throw Error('Unexpected command: '+command);
  },
  $:id=>{if(!elements.has(id))elements.set(id,{classList:{add(){},remove(){}}});return elements.get(id);},
  fullDetailWarning:()=>assert.fail('unexpected modal'),toast:()=>assert.fail('unexpected toast'),
  setPreviewProgress(){},refreshTree(){},refreshProperties(){},nameForPath:p=>p,
  updatePreviewMode:mode=>modes.push(mode),adaptivePreview:{open:async()=>true},
  window:{__TAURI__:{event:{listen:async()=>()=>{}},core:{convertFileSrc:p=>p}}},
  loadStlWorker:async(...args)=>{workerCalls.push(args);if(workerError==='abort')throw new DOMException('Memory check declined','AbortError');if(workerError)throw Error('Upload failed');return {positions:new Float32Array(9),totalTriangles:1,triangles:1};}
 });
 vm.runInContext(whole?actual:prefix,context);
 return {context,commands,modes,workerCalls};
}

test('ordinary small model loads go directly to full detail and reuse resolved metadata',async()=>{
 const s=setup({whole:true});await s.context.loadPreview('small.stl');
 assert.equal(s.context.loadedPreviewMode,'full');assert.deepEqual(s.modes,['full']);
 assert.deepEqual(s.commands,['resolve_geometry']);assert.equal(s.workerCalls.length,1);
});

test('800 MB loads full and one byte above it starts the preview service',async()=>{
 const at=setup({bytes:AUTO_FULL_DETAIL_BYTES,whole:true});await at.context.loadPreview('at.stl');assert.equal(at.context.loadedPreviewMode,'full');
 const over=setup({bytes:AUTO_FULL_DETAIL_BYTES+1,whole:true});await over.context.loadPreview('over.stl');
 assert.equal(over.context.loadedPreviewMode,'quick');assert.equal(over.workerCalls.length,0);
 assert.deepEqual(over.commands,['resolve_geometry','prepare_mesh_preview']);
});

test('manual preview and full-detail requests override automatic file-size selection',async()=>{
 const preview=setup({whole:true});await preview.context.loadPreview('small.stl','quick');
 assert.deepEqual(preview.commands,['prepare_mesh_preview']);assert.equal(preview.context.loadedPreviewMode,'quick');
 const full=setup({bytes:AUTO_FULL_DETAIL_BYTES+1,whole:true});await full.context.loadPreview('large.stl','full');
 assert.equal(full.context.loadedPreviewMode,'full');assert.deepEqual(full.commands,['resolve_geometry']);
});

test('automatic admission failures and unavailable sizes use preview without a modal',async()=>{
 const denied=setup({denied:true});await denied.context.loadPreview('small.obj');
 assert.equal(denied.context.started[0].mode,'quick');assert.deepEqual(denied.commands,['resolve_geometry','check_full_detail']);
 const unknown=setup({metadataError:true});await unknown.context.loadPreview('unknown.stl');assert.equal(unknown.context.started[0].mode,'quick');
});

test('failed automatic full-detail loads retry preview once',async()=>{
 const s=setup({workerError:true,whole:true});await s.context.loadPreview('small.stl');
 assert.equal(s.context.loadedPreviewMode,'quick');assert.equal(s.workerCalls.length,1);
 assert.deepEqual(s.commands,['resolve_geometry','prepare_mesh_preview']);
});

test('declining automatic full-detail memory admission starts preview',async()=>{
 const s=setup({workerError:'abort',whole:true});await s.context.loadPreview('small.stl');
 assert.equal(s.context.loadedPreviewMode,'quick');assert.equal(s.workerCalls.length,1);
});

test('a newer model selection wins when file-size lookups complete out of order',async()=>{
 const pending=new Map(),s=setup({invokeOverride:(command,args)=>new Promise(resolve=>pending.set(args.path,resolve))});
 const a=s.context.loadPreview('first.stl');await new Promise(setImmediate);
 const b=s.context.loadPreview('second.stl');await new Promise(setImmediate);
 pending.get('second.stl')({size:100,path:'second.stl'});await b;
 pending.get('first.stl')({size:100,path:'first.stl'});await a;
 assert.equal(s.context.started.length,1);assert.equal(s.context.started[0].path,'second.stl');
});

test('cancellation while inspecting file size prevents loading',async()=>{
 let resolve;const s=setup({invokeOverride:()=>new Promise(r=>resolve=r)});
 const pending=s.context.loadPreview('cancel.stl');await new Promise(setImmediate);
 s.context.previewRequest++;resolve({size:100,path:'cancel.stl'});await pending;
 assert.equal(s.context.started.length,0);
});
