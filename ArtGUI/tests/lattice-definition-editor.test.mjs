import test from 'node:test';
import assert from 'node:assert/strict';
import {createLatticeDefinitionEditor} from '../ui/lattice-definition-editor.js';
import {definitionTemplate,latticeReferences} from '../ui/lattice-schema.js';
import {parseNumericJson,stringifyNumericJson} from '../ui/numeric-json.js';
let JSDOM;try{({JSDOM}=await import(process.env.ARTGUI_TEST_DOM||'jsdom'));}catch{}
const skip=!JSDOM?'Set ARTGUI_TEST_DOM for DOM checks':false;
function fixture(type='TPMS'){
  const dom=new JSDOM('<main id="host"></main>'),old={document:globalThis.document,window:globalThis.window,CustomEvent:globalThis.CustomEvent};
  Object.assign(globalThis,{document:dom.window.document,window:dom.window,CustomEvent:dom.window.CustomEvent});
  const first={la_name:'CellA',definition:definitionTemplate(type)},second={la_name:'CellB',definition:definitionTemplate('TPMS')};
  if(type==='MeshLattice'||type==='ConformalLattice')first.definition.definition.meshfile='Mesh';
  if(type==='Geom'||type==='Geom-Plate')first.definition.definition.file='cell.obj';
  const doc={WorkFlow:{'1':{Define_Lattice:first},'2':{Define_Lattice:second},'3':{Add_Lattice:{la_name:'CellA'}}}},applied=[],edits=[],used=[],navigated=[],removed=[],messages=[];
  const host=document.querySelector('#host');let activeDoc=doc;
  const editor=createLatticeDefinitionEditor({
    getContext:params=>{const key=Object.keys(activeDoc.WorkFlow).find(k=>activeDoc.WorkFlow[k].Define_Lattice===params);return key?{doc:activeDoc,key}:null;},
    validateName:(name,params)=>!name?'Enter a lattice name.':Object.values(activeDoc.WorkFlow).some(s=>s.Define_Lattice&&s.Define_Lattice!==params&&s.Define_Lattice.la_name===name)?'Name already used.':'',
    renderLatticePicker:(_params,value)=>`<select id="lattice-la_name-select" data-lattice-select="lattice-la_name"><option value="BCCubic">BCCubic</option><option value="">Other name / file…</option></select><input id="lattice-la_name" data-lattice-field="la_name" value="${value}">`,
    onApply:(params,draft)=>{const previous=params.la_name;for(const ref of latticeReferences(activeDoc))if(ref.value===previous)ref.object[ref.key]=draft.name;params.la_name=draft.name;params.definition=draft.definition;applied.push(draft);},
    onEdit:(params,draft)=>edits.push({params,draft}),onUse:params=>used.push(params),onExport:()=>{},onRemove:params=>removed.push(params),onNavigate:key=>navigated.push(key),onReveal:params=>editor.show(host,params),onBrowse:async()=>'/new/path.obj',notify:message=>messages.push(message)
  });
  editor.show(host,first);
  const q=s=>host.querySelector(s),edit=(s,value,event='input')=>{const el=q(s);el.value=value;el.dispatchEvent(new dom.window.Event(event,{bubbles:true}));};
  return{dom,doc,first,second,host,editor,q,edit,applied,edits,used,navigated,removed,messages,setDoc:next=>activeDoc=next,close(){dom.window.close();Object.assign(globalThis,old);}};
}
test('all lattice variants use workflow subtitles and refresh their displayed position after reordering',{skip},()=>{
  for(const type of ['MeshLattice','ConformalLattice','strut','TPMS','TPMS-Field','Geom','Geom-Plate']){
    const f=fixture(type);try{
      assert.equal(f.q('.ld-header p').textContent,'Workflow step 01 - Define_Lattice');
      f.doc.WorkFlow={'1':{Define_Lattice:f.second},'2':{Define_Lattice:f.first},'3':{Add_Lattice:{la_name:'CellA'}}};f.editor.show(f.host,f.first);
      assert.equal(f.q('.ld-header p').textContent,'Workflow step 02 - Define_Lattice');assert.equal(f.q('.ld-header h2').textContent,'CellA');
    }finally{f.close();}
  }
});

test('numbered sections default to cell definition and saved values are not marked dirty',{skip},()=>{
  const f=fixture();try{assert.deepEqual([...f.host.querySelectorAll('[data-ld-section]')].map(e=>e.dataset.ldSection),['identity','cell','advanced','usage']);assert.equal(f.q('[data-ld-section="cell"]').open,true);assert.equal(f.q('[data-ld-section="identity"]').open,false);assert.equal(f.q('#apply-lattice').disabled,true);assert.equal(f.q('#revert-lattice').disabled,true);assert.equal(f.q('#lattice-domain').value,'Hex');assert.match(f.q('[data-ld-summary="identity"]').textContent,/Cube \(Hex\)/);assert.match(f.q('[data-ld-summary="usage"]').textContent,/Used by 1 workflow steps/);assert.deepEqual(f.applied,[]);}finally{f.close();}
});
test('edits remain local, Apply propagates a rename, and a no-op flush preserves numeric tokens',{skip},()=>{
  const f=fixture();try{f.first.definition=parseNumericJson('{"type":"TPMS","extra":1.00,"definition":{"ladomain":"Hex","expr":"cos(x)","unit_x_len":"2*pi","unit_y_len":"2*pi","unit_z_len":"2*pi","other":2e0}}');f.editor.show(f.host,f.first);const original=stringifyNumericJson(f.first);assert.equal(f.editor.applyAll(),true);assert.equal(stringifyNumericJson(f.first),original);assert.equal(f.applied.length,0);f.edit('#lattice-name','Renamed');f.edit('#lattice-expr','cos(x)+sin(y)');assert.equal(f.first.la_name,'CellA');assert.equal(f.q('#apply-lattice').disabled,false);f.q('#apply-lattice').click();assert.equal(f.first.la_name,'Renamed');assert.equal(f.doc.WorkFlow['3'].Add_Lattice.la_name,'Renamed');assert.equal(f.first.definition.definition.expr,'cos(x)+sin(y)');assert.match(stringifyNumericJson(f.first),/"extra": 1.00/);assert.equal(f.q('[data-ld-status]').textContent,'Applied to workflow');}finally{f.close();}
});
test('linked periods affect the next edit; unlinking and Revert restore independent values',{skip},()=>{
  const f=fixture();try{assert.equal(f.q('#lattice-link-periods').getAttribute('aria-pressed'),'true');f.edit('#lattice-unit_x_len','3*pi');assert.deepEqual(['x','y','z'].map(a=>f.q('#lattice-unit_'+a+'_len').value),['3*pi','3*pi','3*pi']);assert.equal(f.first.definition.definition.unit_x_len,'2*pi');f.q('#lattice-link-periods').click();f.edit('#lattice-unit_y_len','4*pi');assert.equal(f.q('#lattice-unit_x_len').value,'3*pi');f.q('#revert-lattice').click();assert.equal(f.q('#lattice-unit_y_len').value,'2*pi');assert.equal(f.q('#apply-lattice').disabled,true);}finally{f.close();}
});
test('invalid drafts disable application and cannot reach designers or mutate the workflow',{skip},()=>{
  const f=fixture();try{const before=stringifyNumericJson(f.doc);f.edit('#lattice-expr','');assert.equal(f.q('#apply-lattice').disabled,true);assert.equal(f.q('#edit-tpms-cell').disabled,true);assert.equal(f.q('#use-lattice').disabled,true);assert.equal(f.q('#lattice-error').hidden,false);assert.equal(f.editor.applyAll(),false);assert.equal(stringifyNumericJson(f.doc),before);f.edit('#lattice-expr','cos(x)');assert.equal(f.q('#lattice-error').hidden,true);assert.equal(f.q('#apply-lattice').disabled,false);}finally{f.close();}
});
test('drafts survive selection and refresh and all are validated before any Save flush mutation',{skip},()=>{
  const f=fixture();try{f.edit('#lattice-expr','sin(x)');f.editor.show(f.host,f.second);f.edit('#lattice-expr','');f.editor.show(f.host,f.first);assert.equal(f.q('#lattice-expr').value,'sin(x)');assert.equal(f.editor.applyAll(),false);assert.equal(f.first.definition.definition.expr,'cos(x)+cos(y)+cos(z)');assert.equal(f.applied.length,0);f.edit('#lattice-expr','sin(y)');assert.equal(f.editor.applyAll(),true);assert.equal(f.first.definition.definition.expr,'sin(x)');assert.equal(f.second.definition.definition.expr,'sin(y)');}finally{f.close();}
});
test('duplicate pending names are rejected before mutation and old-document drafts cannot leak',{skip},()=>{
  const f=fixture();try{f.edit('#lattice-name','Same');f.editor.show(f.host,f.second);f.edit('#lattice-name','Same');assert.equal(f.editor.applyAll(),false);assert.equal(f.applied.length,0);const other={WorkFlow:{'1':{Define_Lattice:{la_name:'Other',definition:definitionTemplate('TPMS')}}}};f.setDoc(other);assert.equal(f.editor.applyAll(),true);assert.equal(f.applied.length,0);f.editor.show(f.host,other.WorkFlow['1'].Define_Lattice);assert.equal(f.q('#lattice-name').value,'Other');}finally{f.close();}
});
test('renaming a unit cell preserves unfinished edits in a conformal definition that consumes it',{skip},()=>{
  const f=fixture();try{f.second.definition=definitionTemplate('ConformalLattice');f.second.definition.definition.meshfile='mesh.inp';f.second.definition.definition.la_name='CellA';f.editor.show(f.host,f.second);f.edit('#lattice-k','0.2');f.editor.show(f.host,f.first);f.edit('#lattice-name','Renamed');f.q('#apply-lattice').click();f.editor.show(f.host,f.second);assert.equal(f.q('#lattice-k').value,'0.2');assert.equal(f.q('#lattice-la_name').value,'Renamed');assert.equal(f.editor.applyAll(),true);assert.equal(f.second.definition.definition.k,0.2);assert.equal(f.second.definition.definition.la_name,'Renamed');}finally{f.close();}
});
test('Save can flush a hidden draft without replacing another operation inspector',{skip},()=>{
  const f=fixture();try{f.edit('#lattice-expr','sin(x)');f.host.innerHTML='<p>Another operation inspector</p>';assert.equal(f.editor.applyAll(),true);assert.equal(f.first.definition.definition.expr,'sin(x)');assert.equal(f.host.textContent,'Another operation inspector');}finally{f.close();}
});
test('the unsaved-work guard can detect local drafts even while another inspector is shown',{skip},()=>{
  const f=fixture();try{assert.equal(f.editor.hasPending(),false);f.edit('#lattice-expr','sin(x)');f.host.innerHTML='<p>Other inspector</p>';assert.equal(f.editor.hasPending(),true);assert.equal(f.editor.applyAll(),true);assert.equal(f.editor.hasPending(),false);}finally{f.close();}
});
test('domain changes update designer availability without applying and designer receives draft values',{skip},()=>{
  const f=fixture();try{f.edit('#lattice-domain','Tet','change');assert.equal(f.q('#edit-tpms-cell').disabled,true);assert.match(f.q('[data-ld-designer-help]').textContent,/Cube/);assert.equal(f.first.definition.definition.ladomain,'Hex');f.edit('#lattice-domain','Hex','change');f.edit('#lattice-expr','sin(x)');f.q('#edit-tpms-cell').click();assert.equal(f.edits[0].draft.definition.definition.expr,'sin(x)');assert.equal(f.applied.length,0);}finally{f.close();}
});
test('usage navigation uses actual consuming steps and flags consumers preceding definitions',{skip},()=>{
  const f=fixture();try{f.q('[data-ld-use-step="3"]').click();assert.deepEqual(f.navigated,['3']);f.doc.WorkFlow={'1':{Add_Lattice:{la_name:'CellA'}},'2':{Define_Lattice:f.first}};f.editor.show(f.host,f.first);assert.match(f.q('.ld-order-warning').textContent,/precedes/);f.q('#delete-lattice').click();assert.deepEqual(f.removed,[f.first]);}finally{f.close();}
});
test('strut arrays are editable in Advanced, invalid connectivity is rejected and extra fields survive',{skip},()=>{
  const f=fixture('strut');try{assert.ok(f.q('[data-ld-section="advanced"] #lattice-pts'));const before=stringifyNumericJson(f.first);f.edit('#lattice-cnnt','[[0,999]]');assert.equal(f.editor.apply(),false);assert.equal(stringifyNumericJson(f.first),before);f.q('#revert-lattice').click();f.first.definition.definition.extra={value:1};f.editor.show(f.host,f.first);f.edit('#lattice-name','StrutEdited');assert.equal(f.editor.apply(),true);assert.deepEqual(f.first.definition.definition.extra,{value:1});}finally{f.close();}
});
test('surface domains open the Strut and Plate designers from the definition panel',{skip},()=>{
 for(const [type,button] of [['strut','#edit-strut-cell'],['Geom-Plate','#edit-mesh-cell']]){
  const f=fixture(type);
  try{
   for(const domain of ['Quad','Triangle']){
    f.edit('#lattice-domain',domain,'change');
    assert.equal(f.q(button).disabled,false);
    f.q(button).click();
    assert.equal(f.edits.at(-1).draft.definition.definition.ladomain,domain);
   }
  }finally{f.close();}
 }
});
test('all definition families render applicable controls and mesh k remains optional',{skip},()=>{
  for(const type of ['MeshLattice','ConformalLattice','TPMS-Field','Geom','Geom-Plate']){const f=fixture(type);try{assert.equal(f.editor.applyAll(),true,type);if(type.includes('Lattice')){assert.ok(f.q('#lattice-meshfile'));assert.ok(f.q('[data-ld-section="advanced"] #lattice-k'));delete f.first.definition.definition.k;f.editor.show(f.host,f.first);assert.equal(f.editor.applyAll(),true);assert.equal('k' in f.first.definition.definition,false);}else if(type==='TPMS-Field'){assert.equal(f.q('#edit-tpms-cell'),null);assert.ok(f.q('#lattice-expr'));}else{assert.ok(f.q('#edit-mesh-cell'));assert.ok(f.q('#lattice-file'));}}finally{f.close();}}
});
test('file browsing updates the local draft and Use applies before creating the consumer',{skip},async()=>{
  const f=fixture('Geom');try{f.q('[data-lattice-browse="file"]').click();await new Promise(r=>setTimeout(r,0));assert.equal(f.q('#lattice-file').value,'/new/path.obj');assert.equal(f.first.definition.definition.file,'cell.obj');f.q('#use-lattice').click();assert.equal(f.first.definition.definition.file,'/new/path.obj');assert.deepEqual(f.used,[f.first]);}finally{f.close();}
});
test('localization preserves serialized domain values, drafts and the open section',{skip},async()=>{
  const f=fixture();try{const {localize,setLanguage}=await import('../ui/i18n.js');f.edit('#lattice-expr','sin(x)');setLanguage('zh-CN');localize(f.host);assert.equal(f.q('#lattice-domain').value,'Hex');assert.equal(f.q('#lattice-expr').value,'sin(x)');assert.equal(f.q('[data-ld-section="cell"]').open,true);assert.equal(f.q('#apply-lattice').textContent,'应用更改');assert.match(f.q('[data-ld-summary="identity"]').textContent,/立方体/);assert.equal(f.editor.readDraft().definition.definition.expr,'sin(x)');setLanguage('en');}finally{f.close();}
});
