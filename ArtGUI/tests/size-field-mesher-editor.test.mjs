import test from 'node:test';
import assert from 'node:assert/strict';
import {createSizeFieldMesherEditor} from '../ui/size-field-mesher-editor.js';
import {prepareFieldOperation,tetFieldKeyword,quadFieldKeyword} from '../ui/field-workflow.js';
import {applyMesherDraft} from '../ui/size-field-mesher-model.js';
import {parseNumericJson,stringifyNumericJson} from '../ui/numeric-json.js';
let JSDOM;try{({JSDOM}=await import(process.env.ARTGUI_TEST_DOM||'jsdom'));}catch{}
const skip=!JSDOM?'Set ARTGUI_TEST_DOM for DOM checks':false;
function fixture(keyword=tetFieldKeyword,overrides={}){
  const dom=new JSDOM('<div id="host"></div>'),old={document:globalThis.document,window:globalThis.window,CustomEvent:globalThis.CustomEvent};Object.assign(globalThis,{document:dom.window.document,window:dom.window,CustomEvent:dom.window.CustomEvent});
  const p=parseNumericJson('{"mesh_file":"Solid","size_field":"CellSize","export_mesh":"MeshOut","sampling_size":0.75,"hausd":0.030}');if(keyword===quadFieldKeyword)delete p.sampling_size;prepareFieldOperation(keyword,p);
  const other={...p,export_mesh:'OtherMesh'},doc={Setup:{},WorkFlow:{'1':{ReadMesh:{MeshID:'Solid',meshfile:'solid.inp',elem_type:'Triangle'}},'2':{ReadGridField:{Gridfield_ID:'CellSize',FieldID:'Stored',inp_GridFieldFile:'data.h5'}},'3':{[keyword]:p},'4':{[keyword]:other}}};
  const host=document.querySelector('#host'),committed=[],viewed=[],edited=[],generated=[],messages=[];
  const editor=createSizeFieldMesherEditor({getContext:params=>{const key=Object.keys(doc.WorkFlow).find(key=>doc.WorkFlow[key][keyword]===params);return key?{doc,key,keyword}:null;},
    onCommit:(params,draft)=>{applyMesherDraft(params,draft,doc.WorkFlow,params===p?'3':'4',keyword);committed.push(draft);},onReveal:params=>editor.show(host,params),onView:async(...args)=>viewed.push(args),onEditField:(...args)=>edited.push(args),onGenerate:async params=>{generated.push(params);return {success:true,meshPath:'mesh.inp'};},onBrowse:async()=>'/chosen/file.inp',onReport:async()=>({path:'q.json',report:{valid:false,error:'Meshing failed'}}),onOpenReport:()=>{},toast:e=>messages.push(e),...overrides});
  editor.show(host,p);const q=s=>host.querySelector(s),edit=(s,value,event='input')=>{const el=q(s);el.value=value;el.dispatchEvent(new dom.window.Event(event,{bubbles:true}));};return {dom,host,doc,p,other,editor,q,edit,committed,viewed,edited,generated,messages,async flush(){await new Promise(resolve=>setTimeout(resolve,0));},close(){dom.window.close();Object.assign(globalThis,old);}};
}
test('both mesher subtitles follow displayed workflow positions, including after reordering',{skip},()=>{
  for(const keyword of [tetFieldKeyword,quadFieldKeyword]){
    const f=fixture(keyword);try{
      assert.equal(f.q('.sm-header p').textContent,`Workflow step 03 - ${keyword}`);
      f.doc.WorkFlow={'1':f.doc.WorkFlow['1'],'2':f.doc.WorkFlow['2'],'3':{[keyword]:f.other},'4':{[keyword]:f.p}};f.editor.show(f.host,f.p);
      assert.equal(f.q('.sm-header p').textContent,`Workflow step 04 - ${keyword}`);
    }finally{f.close();}
  }
});

test('workflow subtitle wording and exact keyword stay unchanged when the surrounding UI is translated',{skip},async()=>{
  const f=fixture();const {setLanguage,localize}=await import('../ui/i18n.js');try{
    setLanguage('zh-CN');localize(f.host);assert.equal(f.q('.sm-header p').textContent,'Workflow step 03 - Gen_TetMesh_SizeField');
  }finally{setLanguage('en');f.close();}
});

test('both compact panels offer Edit field and View field with different mesher-specific controls',{skip},()=>{
  for(const keyword of [tetFieldKeyword,quadFieldKeyword]){const f=fixture(keyword);try{assert.ok(f.q('#sm-edit-field'));assert.ok(f.q('#sm-view-field'));assert.equal(f.q('#sm-generate').disabled,false);assert.equal(f.q('#sm-revert').disabled,true);assert.equal(!!f.q('#sm-sampling_size'),keyword===tetFieldKeyword);assert.equal(!!f.q('#sm-method'),keyword===quadFieldKeyword);assert.equal(f.q('[data-sm-result-state]').textContent,'Not generated');assert.deepEqual(f.committed,[]);}finally{f.close();}}
});
test('edits are local, Revert restores applied values, and Save flushes without changing numeric tokens',{skip},()=>{
  const f=fixture();try{f.edit('#sm-hgrad','1.7');assert.equal(f.p.hgrad,1.3);assert.equal(f.q('#sm-revert').disabled,false);f.q('#sm-revert').click();assert.equal(f.q('#sm-hgrad').value,'1.3');f.edit('#sm-hgrad','1.6');assert.equal(f.editor.applyAll(),true);assert.equal(f.p.hgrad,1.6);assert.match(stringifyNumericJson(f.p),/0\.030/);}finally{f.close();}
});
test('View field uses the selected draft field without applying meshing edits',{skip},async()=>{
  const f=fixture();try{f.edit('#sm-hgrad','1.7');f.q('#sm-view-field').click();await f.flush();assert.equal(f.viewed[0][0],'field');assert.equal(f.viewed[0][3].size_field,'CellSize');assert.equal(f.p.hgrad,1.3);assert.equal(f.committed.length,0);f.q('#sm-edit-field').click();assert.equal(f.edited[0][0].key,'2');f.editor.show(f.host,f.p);assert.equal(f.q('#sm-hgrad').value,'1.7');}finally{f.close();}
});
test('invalid local values block generation and atomic Save across two visited panels',{skip},async()=>{
  const f=fixture();try{f.edit('#sm-hgrad','1.7');f.editor.show(f.host,f.other);f.edit('#sm-sampling_size','-1');assert.equal(f.q('#sm-generate').disabled,true);assert.equal(f.editor.applyAll(),false);assert.equal(f.committed.length,0);assert.equal(f.p.hgrad,1.3);f.q('#sm-revert').click();assert.equal(f.editor.applyAll(),true);assert.equal(f.p.hgrad,1.7);}finally{f.close();}
});
test('generating applies the current draft and reports the real callback outcome',{skip},async()=>{
  const f=fixture();try{f.edit('#sm-hgrad','1.8');f.q('#sm-generate').click();await f.flush();assert.equal(f.generated.length,1);assert.equal(f.p.hgrad,1.8);assert.match(f.q('[data-sm-status]').textContent,/Mesh generated/);assert.match(f.q('[data-sm-result-state]').textContent,/report unavailable/);assert.equal(f.q('#sm-view-mesh').disabled,false);}finally{f.close();}
});
test('failed generation leaves settings available and never claims a new ready result',{skip},async()=>{
  const f=fixture(tetFieldKeyword,{onGenerate:async()=>({success:false,error:'Meshing failed'})});try{f.q('#sm-generate').click();await f.flush();assert.equal(f.q('[data-sm-status]').textContent,'Generation failed');assert.match(f.q('#sm-error').textContent,/Meshing failed/);assert.equal(f.q('#sm-generate').disabled,false);}finally{f.close();}
});
test('Quad output element changes remain local until commit and revert cleanly',{skip},()=>{
  const f=fixture(quadFieldKeyword);try{f.doc.WorkFlow['5']={ExportMeshID:{MeshID:'MeshOut',elem_type:'Quad',out_meshfile:'mesh.inp'}};f.q('[data-sm-split="true"]').click();assert.equal(f.p.split_to_triangles,false);assert.equal(f.doc.WorkFlow['5'].ExportMeshID.elem_type,'Quad');assert.equal(f.editor.apply(),true);assert.equal(f.p.split_to_triangles,true);assert.equal(f.doc.WorkFlow['5'].ExportMeshID.elem_type,'Triangle');f.q('[data-sm-method="Subdivision"]').click();assert.equal(f.p.method,'SimpleQuad');f.q('#sm-revert').click();assert.equal(f.q('[data-sm-method="SimpleQuad"]').getAttribute('aria-pressed'),'true');}finally{f.close();}
});
test('feature angle disables when preservation is turned off without losing its value',{skip},()=>{
  const f=fixture();try{f.q('#sm-preserve_features').checked=false;f.q('#sm-preserve_features').dispatchEvent(new f.dom.window.Event('change'));assert.equal(f.q('#sm-feature_angle').disabled,true);assert.equal(Number(f.q('#sm-feature_angle').value),45);assert.equal(f.p.preserve_features,true);}finally{f.close();}
});
test('hidden drafts flush without replacing another inspector and unsaved guards can detect them',{skip},()=>{
  const f=fixture();try{f.edit('#sm-hgrad','1.6');f.editor.hide();f.host.innerHTML='<p>Field slice inspector</p>';assert.equal(f.editor.hasPending(),true);assert.equal(f.editor.applyAll(),true);assert.equal(f.host.textContent,'Field slice inspector');assert.equal(f.editor.hasPending(),false);}finally{f.close();}
});
test('no fabricated target range appears until actual field metadata is available',{skip},()=>{
  let info=null;const f=fixture(tetFieldKeyword,{getFieldInfo:()=>info});try{assert.doesNotMatch(f.q('[data-sm-field-range]').textContent,/4.?10/);info={range:[.4,1]};f.editor.refresh();assert.match(f.q('[data-sm-field-range]').textContent,/0.4–1/);assert.match(f.q('[data-sm-field-range]').textContent,/Saved field range/);}finally{f.close();}
});
test('missing saved field data produces a recoverable message and preserves the meshing draft',{skip},async()=>{
  const f=fixture(tetFieldKeyword,{onView:async()=>{throw Error('No saved HDF5 data is available for this size field.');}});try{f.edit('#sm-hgrad','1.7');f.q('#sm-view-field').click();await f.flush();assert.match(f.q('#sm-error').textContent,/No saved HDF5/);assert.equal(f.q('#sm-hgrad').value,'1.7');assert.equal(f.p.hgrad,1.3);}finally{f.close();}
});
test('Chinese labels preserve field IDs, numeric inputs and draft values',{skip},async()=>{
  const f=fixture();try{const {setLanguage,localize}=await import('../ui/i18n.js');f.edit('#sm-hgrad','1.7');setLanguage('zh-CN');localize(f.host);assert.equal(f.q('#sm-view-field').textContent,'查看场');assert.equal(f.q('#sm-size_field').value,'CellSize');assert.equal(f.q('#sm-hgrad').value,'1.7');setLanguage('en');}finally{f.close();}
});

test('saved Tet reports keep exact counts and identify settings as unverified',{skip},async()=>{
  const report=JSON.parse(await (await import('node:fs/promises')).readFile(new URL('./fixtures/tet-size-field-report.json',import.meta.url),'utf8'));
  report.final.vertices=1234567;report.final.tetrahedra=7654321;
  const f=fixture(tetFieldKeyword,{onReport:async()=>({path:'q.json',report})});try{
    f.p.quality_report='q.json';await f.editor.loadReport(f.p,true);
    assert.match(f.q('.sm-count').textContent,/1,234,567.*7,654,321/);
    assert.equal(f.q('[data-sm-status]').textContent,'Saved report · verify settings');
    assert.match(f.q('.sm-metrics').textContent,/e-15/);
    f.edit('#sm-hgrad','1.7');assert.equal(f.q('[data-sm-status]').textContent,'Settings changed');
  }finally{f.close();}
});

test('upstream drafts are flushed before the generated result captures its settings',{skip},async()=>{
  let f;f=fixture(tetFieldKeyword,{onBeforeGenerate:()=>{f.doc.Setup.res=[1,1,1];return true;}});try{
    f.q('#sm-generate').click();await f.flush();assert.match(f.q('[data-sm-status]').textContent,/Mesh generated/);
  }finally{f.close();}
});

test('a changed workflow discards a late result and restores the Generate action',{skip},async()=>{
  let finish;const f=fixture(tetFieldKeyword,{onGenerate:()=>new Promise(resolve=>{finish=resolve;})});try{
    f.q('#sm-generate').click();await f.flush();f.doc.Setup.res=[2,2,2];finish({success:true,meshPath:'obsolete.inp'});await f.flush();
    assert.equal(f.q('#sm-generate').disabled,false);assert.equal(f.q('[data-sm-status]').textContent,'Not generated');assert.equal(f.q('#sm-view-mesh').disabled,true);
  }finally{f.close();}
});
