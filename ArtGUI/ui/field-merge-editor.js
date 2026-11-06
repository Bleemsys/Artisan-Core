import {cloneNumericJson,assignNumericJson,setNumber,parseNumericJson,stringifyNumericJson} from './numeric-json.js';
import {fieldMergeModes,fieldMergeError,fieldMergeFingerprint,fieldMergeTargets,applyFieldMergeGeometry,earlierMergeFields,fieldMergeIsFile,switchFieldMergeMode} from './field-merge-model.js';
import {spatialTargets} from './spatial-model.js';

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=v=>Number.isFinite(v)?Number(v.toPrecision(6)).toString():'—';
const restore=(p,data)=>{for(const k of Object.keys(p))delete p[k];assignNumericJson(p,cloneNumericJson(data));};
export function createFieldMergeEditor(options){
  const states=new Map();let host=null,p=null,s=null,overlay=null,suspended=false,targets=[];
  const context=()=>options.getContext(p),snapshot=()=>({params:cloneNumericJson(p),source:s.source});
  const fields=()=>{const c=context();return earlierMergeFields(c?.doc.WorkFlow,c?.key);};
  const infer=()=>fields().some(f=>f.id===p.OP_para?.FieldFile)||!fieldMergeIsFile(p.OP_para?.FieldFile)?'field':'file';
  const signature=()=>{const c=context();return c?fieldMergeFingerprint(c.doc,c.key):'';};
  const issue=()=>[...s.errors.values()][0]||fieldMergeError(p,context()?.doc.WorkFlow,context()?.key);
  function push(before){if(JSON.stringify(before)!==JSON.stringify(snapshot())){s.undo.push(before);if(s.undo.length>50)s.undo.shift();s.redo=[];}}
  function begin(){s.transaction ||= snapshot();}
  function commit(){if(!s?.transaction)return;push(s.transaction);s.transaction=null;paint();}
  function restoreSnapshot(data){restore(p,data.params);s.source=data.source;s.raw.clear();s.errors.clear();}
  function cancel(){if(!s?.transaction)return;const data=s.transaction;s.transaction=null;restoreSnapshot(data);options.onChange();render();}
  function changed(){s.actionError='';options.onChange();paint();}
  function mutate(fn){commit();const before=snapshot();try{fn();s.raw.clear();s.errors.clear();push(before);changed();render();}catch(error){restoreSnapshot(before);s.actionError=error.message;paint();options.toast(error.message);}}
  function domain(){const c=context(),setup=c?.doc.Setup;if(setup?.Type==='Geometry'){const b=options.meshBounds?.(setup.Geomfile);if(b)return [0,1,2].map(i=>[b[0][i],b[1][i]]);}return setup?.Sample?.Domain;}
  function activeTargets(){return s.placement?spatialTargets('Add_Lattice',p,{domain:domain()}).targets:fieldMergeTargets(p,{domain:domain()});}
  function sync(){
    if(!p||!overlay)return;
    if(!s.visible||suspended||s.busy||fieldMergeError(p)){overlay.hide();return;}
    targets=activeTargets();if(!targets.length){overlay.hide();return;}
    s.index=Math.min(s.index,targets.length-1);const target=targets[s.index];if(!target.modes.includes(s.mode))s.mode='move';
    overlay.update(targets.map(t=>({name:t.label,geometry:t.geometry,colour:t.colour||'#2867d8',guideKind:t.kind==='plane'?'plane':undefined})),s.index,{mode:s.mode,snap:0});
    document.getElementById('viewport-empty')?.classList.add('hidden');
  }
  function read(path){const value=path.split('.').reduce((o,k)=>o?.[k],p);return path.startsWith('Rot.')&&Number.isFinite(value)?value*180/Math.PI:value;}
  function setNumeric(object,path,value){const keys=path.split('.'),key=keys.pop(),parent=keys.reduce((o,k)=>o?.[k],object);if(!parent)throw Error('Restore the missing parameter object in Advanced.');let number=Number(value);if(!String(value).trim()||!Number.isFinite(number))throw Error('Enter a finite number.');if(path.startsWith('Rot.'))number*=Math.PI/180;setNumber(parent,key,number,'float');}
  function syncInputs(){host?.querySelectorAll('[data-fm-number]').forEach(el=>{if(!s.raw.has(el.dataset.fmNumber))el.value=read(el.dataset.fmNumber)??'';});}
  function paint(){
    if(!host||!p||!s)return;const q=x=>host.querySelector(x);if(!q('[data-fm-run]'))return;const error=issue(),busy=s.busy||suspended;
    q('fieldset').disabled=busy;q('[data-fm-run]').disabled=busy||!!error;q('[data-fm-run]').textContent=s.busy?'Computing field…':'Update preview';
    q('[data-fm-error]').textContent=error||s.actionError;q('[data-fm-error]').hidden=!q('[data-fm-error]').textContent;
    q('[data-fm-status]').textContent=s.busy?'Computing field…':s.result?(s.result.fingerprint===signature()?'Preview up to date':'Settings changed · update preview'):'Editing guides · compute to inspect field values';
    q('[data-fm-undo]').disabled=busy||!s.undo.length;q('[data-fm-redo]').disabled=busy||!s.redo.length;q('[data-fm-reset]').disabled=busy;q('[data-fm-fit]').disabled=busy;
    host.querySelectorAll('[data-fm-tool]').forEach(el=>el.setAttribute('aria-pressed',String(s.mode===el.dataset.fmTool&&s.placement===el.hasAttribute('data-fm-placement'))));
    host.querySelectorAll('[data-fm-target]').forEach(el=>el.setAttribute('aria-pressed',String(!s.placement&&s.index===Number(el.dataset.fmTarget))));
    host.querySelectorAll('[data-fm-number]').forEach(el=>el.setAttribute('aria-invalid',String(s.errors.has(el.dataset.fmNumber))));
    options.inspector.setCompactStale?.(q('[data-fm-inspect]'),!!s.result&&s.result.fingerprint!==signature());
  }
  const number=(path,label)=>`<label class="pm-input"><span>${esc(label)}</span><input type="number" step="any" data-fm-number="${path}" aria-label="${esc(label)}" value="${esc(s.raw.get(path)??read(path)??'')}"></label>`;
  const vector=(path,label)=>`<p class="pm-label">${esc(label)}</p><div class="pm-three">${['X','Y','Z'].map((a,i)=>number(path+'.'+i,label+' '+a)).join('')}</div>`;
  const tool=(mode,label,placement=false)=>`<button type="button" class="button" data-fm-tool="${mode}" ${placement?'data-fm-placement':''}>${label}</button>`;
  const selectTarget=(i,label)=>`<button type="button" class="button" data-fm-target="${i}">${label}</button>`;
  function section(number,title,body,summary){return `<details class="fm-section" data-fm-section="${number}" ${s.open.has(number)?'open':''}><summary><span class="fm-number">${number}</span><span class="fm-heading-copy"><strong>${title}</strong><span class="fm-summary">${summary}</span></span></summary><div class="fm-section-body">${body}</div></details>`;}

  function lattice(path,label){const value=path.split('.').reduce((o,k)=>o?.[k],p);return `<label class="pm-label">${label}</label>${options.latticePicker(path,value)}`;}
  function render(){
    if(!host||!p)return;const q=p.OP_para||{},mode=q.InterpType,bridge=q.Transition&&typeof q.Transition==='object'&&Object.keys(q.Transition).length>0;
    const targetBody=`<p class="pm-help">Current field · previous workflow steps</p>${lattice('la_name','Target lattice')}${vector('size','Cell size')}${number('thk','Thickness control')}<p class="pm-help">For strut lattices, this is the strut radius.</p>`;
    let region=`<p class="pm-help">${{Linear:'Blend between two planes.',Attractor:'Blend around a point.',Annulus:'Blend between two radii.',Field:'Drive the transition with a scalar field.'}[mode]||'Choose a supported transition mode.'}</p><p class="pm-label">Mode</p><div class="fm-modes">${fieldMergeModes.map(m=>`<button type="button" class="button" data-fm-mode="${m}" aria-pressed="${mode===m}">${m}</button>`).join('')}</div>`;
    if(mode==='Linear')region+=`<div class="pm-tools">${selectTarget(0,'Start plane')}${selectTarget(1,'End plane')}</div>${vector('OP_para.pt_01','Start position')}${vector('OP_para.pt_02','End position')}<div class="pm-tools">${tool('move','Move plane')}${tool('rotate','Rotate plane')}</div><details class="fm-disclosure" ${s.normals?'open':''} data-fm-normals><summary>Plane directions</summary>${vector('OP_para.n_vec_01','Start normal')}${vector('OP_para.n_vec_02','End normal')}</details>`;
    if(['Attractor','Annulus'].includes(mode)){
      region+=vector('OP_para.pt_att','Center');
      region+=mode==='Attractor'?number('OP_para.pt_r','Radius'):`<div class="pm-two">${number('OP_para.inner_r','Inner radius')}${number('OP_para.outer_r','Outer radius')}</div><div class="pm-tools">${selectTarget(0,'Inner radius')}${selectTarget(1,'Outer radius')}</div>`;
      region+=`<div class="pm-tools">${tool('move','Move center')}${tool('resize',mode==='Attractor'?'Resize radius':'Edit radius')}</div>`;
    }
    if(mode==='Field'){
      const available=fields(),known=available.some(f=>f.id===q.FieldFile);
      region+=`<p class="pm-label">Field source</p><div class="fm-sources">${[['field','Field'],['file','CSV file']].map(([value,label])=>`<button type="button" class="button" data-fm-source="${value}" aria-pressed="${s.source===value}">${label}</button>`).join('')}</div>`;
      region+=s.source==='field'?`<label class="pm-label" for="fm-field">Field</label><select id="fm-field" data-fm-field aria-label="Field"><option value="">Choose a field…</option>${!known&&q.FieldFile?`<option value="${esc(q.FieldFile)}" selected translate="no">${esc(q.FieldFile)}</option>`:''}${available.map(f=>`<option value="${esc(f.id)}" ${f.id===q.FieldFile?'selected':''} translate="no">${esc(f.id)} · ${esc(f.key)}</option>`).join('')}</select><p class="pm-help">Use a field created or loaded before this step.</p>`:`<label class="pm-label" for="fm-file">CSV file</label><div class="pm-path"><input id="fm-file" type="text" data-fm-text="OP_para.FieldFile" aria-label="CSV file" value="${esc(q.FieldFile||'')}" translate="no"><button type="button" class="button" data-fm-browse>Browse…</button></div>`;
      region+=`<div class="pm-two">${number('OP_para.min_cap','Lower threshold')}${number('OP_para.max_cap','Upper threshold')}</div>`;
    }else region+=`<label class="pm-toggle"><input type="checkbox" data-fm-visible ${s.visible?'checked':''}>Show influence guide</label>`;
    let bridgeBody=`<label class="pm-toggle"><input type="checkbox" data-fm-bridge ${bridge?'checked':''}>Use a bridging lattice</label><p class="pm-help">Guide the transition with a third lattice. Inspect the generated mesh for connectivity.</p>`;
    if(bridge)bridgeBody+=lattice('OP_para.Transition.la_name','Bridge lattice')+vector('OP_para.Transition.size','Bridge cell size')+number('OP_para.Transition.thk','Bridge thickness control')+`<div class="pm-two">${number('OP_para.Transition.Weight','Influence weight')}${number('OP_para.Transition.f_trans','Transition rate')}</div>`;
    host.innerHTML=`<div class="pm-editor fm-editor"><fieldset class="pm-scroll">${section('1','Target lattice',targetBody,`<span translate="no">${esc(p.la_name)} · ${(Array.isArray(p.size)?p.size:[]).map(fmt).join(' × ')} · ${fmt(p.thk)}</span><p>Current field · previous workflow steps</p>`)}${section('2','Transition region',region,esc(mode||'Choose a mode'))}${section('3','Bridge lattice',bridgeBody,bridge?`<span translate="no">${esc(q.Transition.la_name)}</span>`:'Off · optional')}
      <details class="fm-disclosure fm-placement" data-fm-placement-section ${s.open.has('placement')?'open':''}><summary>Placement</summary>${vector('Rot','Rotation (degrees)')}${vector('Trans','Translation')}<div class="pm-tools">${tool('move','Move lattice',true)}${tool('rotate','Rotate lattice',true)}</div><p class="pm-help">Applies to the target lattice. Region guides use project coordinates.</p></details>
      <details class="fm-disclosure" data-fm-advanced ${s.open.has('advanced')?'open':''}><summary>Advanced</summary><label class="pm-toggle"><input type="checkbox" data-fm-fill ${p.Fill?'checked':''}>Clip to project boundary</label><label class="pm-label">Cube request</label><textarea data-fm-request aria-label="Cube request" translate="no">${esc(stringifyNumericJson(p.Cube_Request??{}))}</textarea>${options.renderExtras?.(p)||''}</details>
      ${s.result?`<details class="fm-disclosure" data-fm-inspect-section ${s.open.has('inspect')?'open':''}><summary>Inspect field</summary><div data-fm-inspect></div></details>`:'<div data-fm-inspect hidden></div>'}</fieldset>
      <footer class="pm-footer"><p class="pm-error" data-fm-error role="alert" hidden></p><p class="pm-help" data-fm-status role="status"></p><div class="pm-history"><button type="button" class="button" data-fm-undo>Undo</button><button type="button" class="button" data-fm-redo>Redo</button><button type="button" class="pm-link" data-fm-reset>Reset</button></div><div class="pm-actions"><button type="button" class="button" data-fm-fit>Fit preview</button><button type="button" class="button primary" data-fm-run>Update preview</button></div></footer></div>`;
    bind();options.inspector.renderCompact(host.querySelector('[data-fm-inspect]'),s.result?.path,'lattice',{source:()=>options.sourceVisible?.(),sourceAvailable:()=>options.sourceAvailable?.()??false,setSource:v=>options.setSourceVisible?.(v)});paint();sync();options.onRender?.();
    if(!s.fitted&&targets.length){s.fitted=true;overlay?.frame();}
  }
  function toolMode(mode,placement=false,index=s.index){overlay?.cancel?.();s.mode=mode;s.placement=placement;s.index=index;s.visible=true;paint();sync();}
  function updateNumber(el){const path=el.dataset.fmNumber;begin();s.raw.set(path,el.value);const candidate=cloneNumericJson(p);try{
    for(const [key,value] of s.raw)setNumeric(candidate,key,value);
    const error=fieldMergeError(candidate),previous=fieldMergeError(p);if(error&&error!==previous)throw Error(error);
    restore(p,candidate);s.errors.clear();changed();sync();
  }catch(error){s.errors.set(path,error.message);paint();}}
  function history(redo){commit();const from=redo?s.redo:s.undo,to=redo?s.undo:s.redo,before=from.pop();if(!before)return;to.push(snapshot());restoreSnapshot(before);changed();render();}
  function bind(){const q=x=>host.querySelector(x);
    for(const d of host.querySelectorAll('[data-fm-section]'))d.ontoggle=()=>{const changed=s.open.has(d.dataset.fmSection)!==d.open;if(d.open)s.open.add(d.dataset.fmSection);else s.open.delete(d.dataset.fmSection);if(changed&&!d.open)render();};
    for(const [selector,key] of [['[data-fm-placement-section]','placement'],['[data-fm-advanced]','advanced'],['[data-fm-inspect-section]','inspect']]){const d=q(selector);if(d)d.ontoggle=()=>d.open?s.open.add(key):s.open.delete(key);}
    if(q('[data-fm-normals]'))q('[data-fm-normals]').ontoggle=e=>{s.normals=e.target.open;};
    host.querySelectorAll('[data-fm-tool]').forEach(el=>el.onclick=()=>toolMode(el.dataset.fmTool,el.hasAttribute('data-fm-placement')));
    host.querySelectorAll('[data-fm-target]').forEach(el=>el.onclick=()=>toolMode(s.mode,false,Number(el.dataset.fmTarget)));
    host.querySelectorAll('[data-fm-mode]').forEach(el=>el.onclick=()=>mutate(()=>{const previous=p.OP_para?.InterpType;if(previous)s.modes.set(previous,{params:cloneNumericJson(p.OP_para),source:s.source});const mode=el.dataset.fmMode,cached=s.modes.get(mode);switchFieldMergeMode(p,mode,cached?.params,domain());s.source=cached?.source||infer();s.index=0;s.mode='move';s.placement=false;}));
    host.querySelectorAll('[data-fm-source]').forEach(el=>el.onclick=()=>mutate(()=>{const a=p.OP_para;s.sources[s.source]=cloneNumericJson({FieldFile:a.FieldFile,min_cap:a.min_cap,max_cap:a.max_cap});s.source=el.dataset.fmSource;assignNumericJson(a,s.sources[s.source]||parseNumericJson('{"FieldFile":"","min_cap":0.0,"max_cap":1.0}'));}));
    if(q('[data-fm-field]'))q('[data-fm-field]').onchange=e=>mutate(()=>{p.OP_para.FieldFile=e.target.value;});
    host.querySelectorAll('[data-fm-number]').forEach(el=>{el.onfocus=()=>{const path=el.dataset.fmNumber;if(path.startsWith('Rot.')||path.startsWith('Trans.'))toolMode(path.startsWith('Rot.')?'rotate':'move',true,0);else if(path.startsWith('OP_para.pt_0')||path.startsWith('OP_para.n_vec_0'))toolMode(path.includes('n_vec')?'rotate':'move',false,path.includes('_02')?1:0);else if(path.startsWith('OP_para.pt_att'))toolMode('move');else if(/OP_para[.](pt_r|inner_r|outer_r)/.test(path))toolMode('resize',false,path.includes('outer_r')?1:0);};el.oninput=()=>updateNumber(el);el.onchange=()=>{updateNumber(el);commit();if(!s.errors.has(el.dataset.fmNumber)){s.raw.delete(el.dataset.fmNumber);syncInputs();}};el.onblur=commit;el.onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();cancel();}};});
    host.querySelectorAll('[data-fm-text]').forEach(el=>{el.onfocus=begin;el.oninput=()=>{begin();const keys=el.dataset.fmText.split('.'),key=keys.pop(),object=keys.reduce((o,k)=>o?.[k],p);if(object){object[key]=el.value;changed();sync();}};el.onchange=()=>{el.oninput();commit();};el.onblur=commit;});
    host.querySelectorAll('[data-fm-lattice-browse]').forEach(el=>el.onclick=async()=>{const original=p;try{const value=await options.browseLattice();if(value&&original===p)mutate(()=>{const keys=el.dataset.fmLatticeBrowse.split('.'),key=keys.pop();keys.reduce((o,k)=>o[k],p)[key]=value;});}catch(error){options.toast(error.message);}});
    if(q('[data-fm-browse]'))q('[data-fm-browse]').onclick=async()=>{const original=p;try{const value=await options.browseFile();if(value&&original===p){if(!/[.]csv$/i.test(value))throw Error('Choose a CSV field file.');mutate(()=>{p.OP_para.FieldFile=value;});}}catch(error){options.toast(error.message);}};
    if(q('[data-fm-visible]'))q('[data-fm-visible]').onchange=e=>{s.visible=e.target.checked;sync();};
    q('[data-fm-fill]').onchange=e=>mutate(()=>{p.Fill=e.target.checked;});
    q('[data-fm-bridge]').onchange=e=>mutate(()=>{p.OP_para ||= {};if(e.target.checked)p.OP_para.Transition=cloneNumericJson(s.bridge||{la_name:'BCCubic',size:p.size,thk:p.thk,Weight:.2,f_trans:.5});else{s.bridge=cloneNumericJson(p.OP_para.Transition);p.OP_para.Transition={};}});
    q('[data-fm-request]').onfocus=begin;q('[data-fm-request]').oninput=e=>{begin();try{const value=parseNumericJson(e.target.value);const error=fieldMergeError({...p,Cube_Request:value});if(error&&error!==fieldMergeError(p))throw Error(error);p.Cube_Request=value;s.errors.delete('Cube_Request');changed();}catch(error){s.errors.set('Cube_Request',error.message);paint();}};q('[data-fm-request]').onblur=commit;
    q('[data-fm-undo]').onclick=()=>history(false);q('[data-fm-redo]').onclick=()=>history(true);q('[data-fm-reset]').onclick=()=>mutate(()=>{restoreSnapshot(s.baseline);s.modes.clear();s.sources={};s.bridge=null;s.index=0;s.placement=false;s.mode='move';});
    q('[data-fm-fit]').onclick=()=>targets.length&&s.visible?overlay?.frame():options.fit?.();q('[data-fm-run]').onclick=run;
  }
  async function run(){commit();if(!applyAll())return;const original=p,state=s,c=context(),fingerprint=signature();state.busy=true;state.actionError='';paint();sync();try{const result=await options.onGenerate(original,c);if(result?.success&&options.getContext(original)?.doc===c.doc){state.result={path:result.fieldPath,fingerprint};state.open.add('inspect');}}catch(error){state.actionError=error.message;options.toast(error.message);}finally{state.busy=false;if(p===original)render();}}
  function applyAll(){for(const [params,state] of states){const c=options.getContext(params);if(!c||c.doc!==state.doc)continue;const error=[...state.errors.values()][0]||fieldMergeError(params,c.doc.WorkFlow,c.key);if(error){options.toast(error);options.onReveal?.(params);return false;}}return true;}
  function hide(){if(p)commit();overlay?.hide();host=null;p=null;s=null;targets=[];}
  return {show(element,params){if(p!==params)hide();host=element;p=params;const doc=context()?.doc;if(!states.has(p)||states.get(p).doc!==doc){const source=infer();s={doc,source,open:new Set(['2']),undo:[],redo:[],modes:new Map(),sources:{},raw:new Map(),errors:new Map(),visible:true,placement:false,index:0,mode:'move',busy:false,result:null,transaction:null,actionError:''};s.baseline=snapshot();states.set(p,s);}s=states.get(p);render();},hide,applyAll,hasPending:()=>[...states].some(([p,s])=>options.getContext(p)?.doc===s.doc&&s.errors.size),attachOverlay(o){overlay=o;if(p)sync();},suspend(v){suspended=v;if(p){paint();sync();}},select(i){toolMode(s.mode,false,i);},
    drag(g){if(!p)return;begin();const target=targets[s.index];if(!target)return;try{applyFieldMergeGeometry(p,target,g,s.mode);changed();syncInputs();sync();}catch(error){s.actionError=error.message;paint();}},commitDrag(){commit();},cancelDrag(){cancel();},refreshInspection(){if(p)options.inspector.updateCompact?.();}
  };
}
