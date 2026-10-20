import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../ui/app.js',import.meta.url),'utf8');
const save=source.slice(source.indexOf('  async function saveProject('),source.indexOf('  async function cleanScratch('));
const clean=source.slice(source.indexOf('  async function cleanScratch('),source.indexOf('  function showSettings('));
function harness(overrides={}){
  const nodes=new Map(),messages=[],calls=[];
  const context={
    runProgress:{busy:false},exportWorkflowError:()=>'',doc:{WorkFlow:{}},exportDrafts:new WeakMap(),applyLatticeDraft:null,
    workflowJson:()=>'{"Setup":{},"WorkFlow":{}}\n',currentPath:'C:/work/original.json',dirty:true,
    $:id=>{if(!nodes.has(id))nodes.set(id,{disabled:false,classList:{toggle(){}}});return nodes.get(id);},
    nameForPath:p=>p.split(/[\\/]/).pop(),toast:message=>messages.push(message),t:message=>message,
    invoke:async(command,args)=>{calls.push({command,args});return 'C:/work/copy.json';},
    cleaningScratch:false,loadedLayerId:'source',loadedGeometryPath:'model.stl',loadedPreviewMode:'quick',
    viewer:{layers:new Map(),fieldLayers:new Map(),render(){}},adaptivePreview:null,cancelPreview(){},
    ...overrides
  };
  vm.createContext(context);vm.runInContext(save+clean,context);
  return {context,nodes,messages,calls};
}

test('Save as sends the current name as a suggestion and subsequent Save uses the chosen file',async()=>{
  const h=harness();
  assert.equal(await h.context.saveProject(true),true);
  assert.equal(h.calls[0].args.saveAs,true);
  assert.equal(h.calls[0].args.path,'C:/work/original.json');
  assert.equal(h.context.currentPath,'C:/work/copy.json');
  assert.equal(h.context.dirty,false);
  assert.equal(h.nodes.get('project-name').textContent,'copy');
  assert.equal(h.nodes.get('project-name').translate,false);
  await h.context.saveProject();
  assert.equal(h.calls[1].args.saveAs,false);
  assert.equal(h.calls[1].args.path,'C:/work/copy.json');
});
test('cancelling Save as or failing to write keeps the current file and dirty state',async()=>{
  for(const invoke of [async()=>null,async()=>{throw Error('disk full');}]){
    const h=harness({invoke});
    assert.equal(await h.context.saveProject(true),false);
    assert.equal(h.context.currentPath,'C:/work/original.json');
    assert.equal(h.context.dirty,true);
  }
});
test('Save and Save as both apply validation and reject writes during generation',async()=>{
  for(const saveAs of [false,true])for(const overrides of [
    {runProgress:{busy:true}}, {exportWorkflowError:()=> 'Invalid export'}, {applyLatticeDraft:()=>false}
  ]){
    const h=harness(overrides);
    assert.equal(await h.context.saveProject(saveAs),false);
    assert.equal(h.calls.length,0);
    assert.equal(h.context.dirty,true);
  }
});
test('cleanup cancels work and closes cached layers before deleting files, preserving full detail',async()=>{
  const order=[],layers=new Map([['source',{preview:{}}],['full',{mode:'full'}]]);
  const h=harness({
    viewer:{layers,fieldLayers:new Map(),removeLayer(id){order.push(id);layers.delete(id);},render(){}},
    cancelPreview:()=>order.push('cancel'),adaptivePreview:{clear:()=>order.push('close')},
    invoke:async command=>{order.push(command);}
  });
  await h.context.cleanScratch();
  assert.deepEqual(order,['cancel','source','close','clean_view_scratch']);
  assert.equal(layers.has('full'),true);
  assert.equal(h.context.currentPath,'C:/work/original.json');
  assert.equal(h.context.dirty,true);
  assert.equal(h.context.loadedGeometryPath,'');
  assert.equal(h.nodes.get('preview-mode').disabled,true);
  assert.equal(h.nodes.get('clean-scratch').disabled,false);
  assert.equal(h.messages.at(-1),'Scratch cleaned.');
});
test('cleanup reports errors and allows retry; repeated clicks cannot overlap',async()=>{
  const h=harness({invoke:async()=>{throw Error('locked');}});
  await h.context.cleanScratch();
  assert.match(h.messages.at(-1),/Could not clean scratch: locked/);
  assert.equal(h.context.cleaningScratch,false);
  assert.equal(h.nodes.get('clean-scratch').disabled,false);
  const busy=harness({cleaningScratch:true});
  await busy.context.cleanScratch();assert.equal(busy.calls.length,0);
});
test('browser-only cleanup explains availability without changing the viewer',async()=>{
  const h=harness({invoke:null,cancelPreview(){throw Error('Must not cancel');}});
  await h.context.cleanScratch();
  assert.match(h.messages.at(-1),/installed desktop app/);
  assert.equal(h.context.loadedGeometryPath,'model.stl');
});
