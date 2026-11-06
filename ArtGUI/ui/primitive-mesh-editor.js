import {primitiveMeshKeywords,primitiveMeshInfo,primitiveMeshKeys,primitiveMeshError,displayedPrimitiveValue,setPrimitiveNumber,replacePrimitiveMesh,restorePrimitiveMesh,primitiveMeshFingerprint,isAxialPrimitive} from './primitive-mesh-model.js';
import {cloneNumericJson,assignNumericJson} from './numeric-json.js';
import {operationIcon} from './operation-icons.js';

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const axisNames=['X','Y','Z'];
export function createPrimitiveMeshEditor(options){
  const states=new Map();let params=null,keyword='',host=null,state=null,overlay=null,suspended=false;
  const snapshot=()=>({keyword,params:cloneNumericJson(params)});
  function fresh(p,k){return {keyword:k,doc:options.getContext(p)?.doc,baseline:new Map([[k,cloneNumericJson(p)]]),shapes:new Map(),undo:[],redo:[],raw:new Map(),errors:new Map(),mode:'shape',display:'edges',visible:true,snap:0,selected:'',transaction:null,generated:null,busy:false,actionError:''};}
  function push(before){
    if(!before||primitiveMeshFingerprint(before.keyword,before.params)===primitiveMeshFingerprint(keyword,params))return;
    state.undo.push(before);if(state.undo.length>50)state.undo.shift();state.redo=[];state.actionError='';
  }
  function begin(){if(!state.transaction)state.transaction=snapshot();}
  function commit(){if(state.transaction){push(state.transaction);state.transaction=null;}paint();}
  function cancel(){if(!state.transaction)return;const before=state.transaction;state.transaction=null;restore(before);state.raw.clear();state.errors.clear();options.onChange();render();}
  function restore(before){
    const previous=keyword;keyword=before.keyword;state.keyword=keyword;restorePrimitiveMesh(params,before.params);
    if(previous!==keyword)options.onKeywordChange(previous,keyword,params);
  }
  function errorFor(s=state,k=keyword,p=params){return [...s.errors.values()][0]||primitiveMeshError(k,p);}
  function sync({fit=false}={}){
    if(!params||!overlay)return;
    if(!state.visible||suspended||state.busy||primitiveMeshError(keyword,params))overlay.hide();
    else{
      options.onViewDisplay?.(state.display);
      overlay.update(keyword,params,{mode:state.mode,display:state.display,snap:state.snap,selected:state.selected});
      document.getElementById('viewport-empty')?.classList.add('hidden');if(fit)overlay.frame();
    }
  }
  function syncInputs(){
    if(!host)return;
    host.querySelectorAll('[data-pm-number]').forEach(el=>{const path=el.dataset.pmNumber;if(path!=='snap'&&!state.raw.has(path))el.value=displayedPrimitiveValue(params,path)??'';});
    const slider=host.querySelector('[data-pm-taper]');if(slider)slider.value=displayedPrimitiveValue(params,'UB_heightRatio');
    const preserve=host.querySelector('[data-pm-preserve]');if(preserve)preserve.checked=params.Preserve_thickness;
    const output=host.querySelector('[data-pm-output]');if(output&&document.activeElement!==output)output.value=params.Mesh_file??'';
  }
  function paint(){
    if(!host||!params)return;const error=errorFor(),busy=state.busy||suspended;
    const q=s=>host.querySelector(s);if(!q('[data-primitive-mesh]'))return;
    q('.pm-scroll').disabled=busy;
    q('[data-pm-preview]').disabled=q('[data-pm-generate]').disabled=!!error||busy;q('[data-pm-fit]').disabled=!state.visible||!!primitiveMeshError(keyword,params)||busy;
    q('[data-pm-undo]').disabled=!state.undo.length||busy;q('[data-pm-redo]').disabled=!state.redo.length||busy;
    q('[data-pm-generate]').textContent=state.busy?'Generating mesh…':'Generate mesh';
    const alert=q('[data-pm-error]');alert.textContent=error||state.actionError;alert.hidden=!alert.textContent;
    if(options.isDiscardedPreview?.(state.generated?.path))state.generated=null;
    const status=state.busy?'Generating mesh…':state.generated?(state.generated.fingerprint===primitiveMeshFingerprint(keyword,params)?'Mesh generated':'Settings changed · generate to update the result'):'Editing preview · generate to export the mesh';
    q('[data-pm-status]').textContent=status;
    const product=params.num_elem?.reduce((a,b)=>a*b,1);q('[data-pm-total]').textContent=Number.isSafeInteger(product)?product.toLocaleString():'—';
    host.querySelectorAll('[data-pm-number]').forEach(el=>{const path=el.dataset.pmNumber;el.setAttribute('aria-invalid',String(state.errors.has(path)));el.closest('.pm-input')?.classList.toggle('pm-linked',path===state.selected||path.startsWith(state.selected+'.'));});
    q('[data-pm-output]').setAttribute('aria-invalid',String(state.errors.has('Mesh_file')));
    host.querySelectorAll('[data-pm-display]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.pmDisplay===state.display)));
    host.querySelectorAll('[data-pm-tool]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.pmTool===state.mode)));
    q('[data-pm-visible]').checked=state.visible;
    q('[data-pm-placement-mode]').hidden=state.mode==='shape';
    q('[data-pm-mode-label]').textContent=state.mode==='move'?'Moving origin':'Rotating normal';
  }
  function tool(mode,{fit=false}={}){
    if(!params)return;overlay?.cancel();commit();state.mode=mode;state.visible=true;
    state.selected=mode==='move'?'ori':mode==='axis'?'Normal':'';
    paint();sync({fit});
  }
  function select(path){
    if(!state)return;
    const mode=path==='ori'||path.startsWith('ori.')?'move':path==='Normal'||path.startsWith('Normal.')?'axis':null;
    if(mode&&state.mode!==mode){state.mode=mode;state.visible=true;state.selected=path;sync();}
    else{state.selected=path;overlay?.select(path);}
    paint();
  }
  function updateNumber(el){
    const path=el.dataset.pmNumber;begin();state.raw.set(path,el.value);const draft=cloneNumericJson(params);
    try{for(const [key,value] of state.raw)setPrimitiveNumber(draft,key,value);const error=primitiveMeshError(keyword,draft);if(error)throw Error(error);restorePrimitiveMesh(params,draft);state.errors.clear();state.actionError='';options.onChange();sync();const slider=host.querySelector('[data-pm-taper]');if(slider&&path==='UB_heightRatio')slider.value=el.value;}
    catch(error){state.errors.set(path,error.message);}
    paint();
  }
  function mutate(fn,{fit=false}={}){
    commit();if(state.errors.size){options.toast(errorFor());return;}
    const before=snapshot();try{fn();const error=primitiveMeshError(keyword,params);if(error)throw Error(error);push(before);state.raw.clear();options.onChange();render();if(fit)sync({fit:true});}
    catch(error){restore(before);state.actionError=error.message;options.toast(error.message);render();}
  }
  function history(redo=false){
    commit();const from=redo?state.redo:state.undo,to=redo?state.undo:state.redo,before=from.pop();if(!before)return;
    to.push(snapshot());restore(before);state.raw.clear();state.errors.clear();state.actionError='';options.onChange();render();
  }
  function reset(group){
    const base=state.baseline.get(keyword),keys=group==='geometry'?[...primitiveMeshInfo[keyword].geometry,...(keyword==='Gen_BoxMesh'?['z_angle']:[])]:group==='divisions'?['num_elem']:['ori','Normal'];
    for(const path of [...state.raw.keys()])if(keys.includes(path.split('.')[0])){state.raw.delete(path);state.errors.delete(path);}
    mutate(()=>{for(const key of keys)assignNumericJson(params,{[key]:cloneNumericJson(base[key])});});
  }
  function changeShape(next){
    if(next===keyword)return;mutate(()=>{
      state.shapes.set(keyword,cloneNumericJson(params));const data=replacePrimitiveMesh(keyword,next,params),saved=state.shapes.get(next);
      if(saved)for(const key of [...primitiveMeshInfo[next].geometry,...(next==='Gen_BoxMesh'?['z_angle']:[])])assignNumericJson(data,{[key]:cloneNumericJson(saved[key])});
      const previous=keyword;keyword=next;state.keyword=keyword;restorePrimitiveMesh(params,data);if(!state.baseline.has(next))state.baseline.set(next,cloneNumericJson(data));
      state.mode='shape';state.selected='';options.onKeywordChange(previous,next,params);
    },{fit:true});
  }
  function number(path,label,{min='',max='',step='any',suffix=''}={}){
    const value=state.raw.has(path)?state.raw.get(path):displayedPrimitiveValue(params,path);
    return `<label class="pm-input"><span>${esc(label)}</span><span class="pm-number-wrap"><input type="number" data-pm-number="${path}" aria-label="${esc(label)}" value="${esc(value)}" step="${step}" ${min!==''?`min="${min}"`:''} ${max!==''?`max="${max}"`:''} ${suffix?'class="pm-with-suffix"':''}><span class="pm-suffix" aria-hidden="true">${suffix}</span></span></label>`;
  }
  const heading=(label,group,help='')=>`<div class="pm-section-heading"><h3>${label}</h3>${help?`<span>${help}</span>`:''}<button type="button" class="pm-link" data-pm-reset="${group}" aria-label="Reset ${group}">Reset</button></div>`;
  function range(key,title,labels=['Start','End'],degrees=false){return `<div class="pm-range"><p>${title}${degrees?' <span class="pm-unit">(degrees)</span>':''}</p><div class="pm-two">${labels.map((label,i)=>number(key+'.'+i,label,{min:degrees||key==='r_range'?0:'',max:degrees?(key==='phi_range'?360:180):'',suffix:degrees?'°':''})).join('')}</div></div>`;}
  function render(){
    if(!host||!params)return;const info=primitiveMeshInfo[keyword];
    const geometry=keyword==='Gen_BoxMesh'?`<div class="pm-axis-table"><div class="pm-table-head"><span>Axis</span><span>Min</span><span>Max</span></div>${axisNames.map((axis,i)=>`<div class="pm-table-row"><strong>${axis}</strong>${[0,1].map(side=>number('xyz'[i]+'_range.'+side,axis+' '+(side?'maximum':'minimum'))).join('')}</div>`).join('')}</div>`:
      keyword==='Gen_CappedConeMesh'?range('r_range','Top radii',['Inner radius','Outer radius'])+number('r_bottom','Bottom radius',{min:0})+number('Height','Height',{min:0})+`<div class="pm-cone-taper"><p class="pm-label">Taper start</p><div class="pm-taper-row"><input type="range" data-pm-taper aria-label="Taper start slider" min="0" max="99.9" step="0.1" value="${displayedPrimitiveValue(params,'UB_heightRatio')}">${number('UB_heightRatio','Taper start',{min:0,max:99.9,step:.1,suffix:'%'})}</div><p class="pm-help">Measured from the origin end along the normal.</p></div><label class="pm-toggle"><input type="checkbox" data-pm-preserve ${params.Preserve_thickness?'checked':''}>Preserve wall thickness</label>`+range('phi_range','Phi range',['Phi start','Phi end'],true):
      range('r_range','Radius range',['Inner radius','Outer radius'])+range('phi_range','Phi range',['Phi start','Phi end'],true)+(isAxialPrimitive(keyword)?number('Height','Height',{min:0}):range('theta_range','Theta range',['Theta start','Theta end'],true));
    host.innerHTML=`<div class="pm-editor ${keyword==='Gen_CappedConeMesh'?'pm-cone':''}" data-primitive-mesh="${keyword}"><fieldset class="pm-scroll"><div class="pm-shapes" role="group" aria-label="Primitive mesh shape">${primitiveMeshKeywords.map(k=>`<button type="button" data-pm-shape="${k}" class="button" aria-pressed="${k===keyword}">${operationIcon(primitiveMeshInfo[k].icon)}<span>${primitiveMeshInfo[k].shape}</span></button>`).join('')}</div><div class="pm-edit-mode" data-pm-placement-mode hidden><span data-pm-mode-label></span><button type="button" class="pm-link" data-pm-tool="shape">Shape handles</button></div><section class="pm-section">${heading('Geometry','geometry','Model units')}${geometry}</section><section class="pm-section">${heading('Mesh divisions','divisions')}<div class="pm-three">${info.axes.map((axis,i)=>number('num_elem.'+i,axis+' divisions',{min:1,step:1})).join('')}</div><p class="pm-help"><span>Total elements</span>: <strong data-pm-total translate="no"></strong></p></section><section class="pm-section">${heading('Placement','placement')}<div class="pm-placement-heading"><p class="pm-label">Origin</p><button type="button" class="button" data-pm-tool="move" aria-pressed="false">Move origin</button></div><div class="pm-three">${axisNames.map((axis,i)=>number('ori.'+i,'Origin '+axis)).join('')}</div><p class="pm-help">Origin is applied before orientation.</p><div class="pm-placement-heading"><p class="pm-label">Axis direction</p><button type="button" class="button" data-pm-tool="axis" aria-pressed="false">Rotate normal</button></div><div class="pm-three">${axisNames.map((axis,i)=>number('Normal.'+i,'Axis '+axis)).join('')}</div><div class="pm-axis-presets" role="group" aria-label="Align axis">${axisNames.map((axis,i)=>`<button type="button" class="pm-link" data-pm-axis="${i}">+${axis}</button>`).join('')}</div>${keyword==='Gen_BoxMesh'?number('z_angle','In-plane rotation',{min:0,max:360,suffix:'°'}):''}</section><section class="pm-section"><h3>Output</h3><label class="pm-label" for="pm-output">Mesh ID / file</label><div class="pm-path"><input id="pm-output" data-pm-output type="text" value="${esc(params.Mesh_file)}" translate="no"><button type="button" class="button" data-pm-browse>Browse…</button></div></section><details class="pm-viewport-tools" ${state.toolsOpen?'open':''}><summary>Viewport controls</summary><div class="pm-tools" role="group" aria-label="Editing tool">${[['shape','Shape'],['move','Move origin'],['axis','Rotate normal']].map(([tool,label])=>`<button type="button" class="button" data-pm-tool="${tool}">${label}</button>`).join('')}</div><div class="pm-tools" role="group" aria-label="Preview display">${[['solid','Solid'],['wireframe','Wireframe'],['edges','Solid + edges']].map(([display,label])=>`<button type="button" class="button" data-pm-display="${display}">${label}</button>`).join('')}</div><label class="pm-toggle"><input type="checkbox" data-pm-visible ${state.visible?'checked':''}>Show editing preview</label>${number('snap','Drag snap',{min:0})}<p class="pm-help">0 = off. Shift snaps angles to 15°; Alt makes dragging finer.</p></details>${options.renderExtras?.(keyword,params)||''}</fieldset><footer class="pm-footer"><p data-pm-error class="pm-error" role="alert" hidden></p><p data-pm-status class="pm-help" role="status" aria-live="polite"></p><div class="pm-history"><button type="button" class="button" data-pm-undo>Undo</button><button type="button" class="button" data-pm-redo>Redo</button><span class="pm-help">Changes update the workflow</span></div><div class="pm-actions"><button type="button" class="button" data-pm-fit>Fit preview</button><button type="button" class="button" data-pm-preview>Preview mesh</button><button type="button" class="button primary" data-pm-generate>Generate mesh</button></div></footer></div>`;
    const snapInput=host.querySelector('[data-pm-number="snap"]');snapInput.value=state.snap;
    bind();paint();sync();options.onRender?.();
  }
  function bind(){
    const q=s=>host.querySelector(s);
    host.querySelectorAll('[data-pm-number]').forEach(el=>{
      const path=el.dataset.pmNumber;
      if(path==='snap'){el.onchange=()=>{const n=Number(el.value);state.snap=el.value.trim()&&Number.isFinite(n)&&n>=0?n:0;el.value=state.snap;sync();};return;}
      el.onfocus=()=>select(path);el.oninput=()=>updateNumber(el);el.onchange=()=>{updateNumber(el);commit();if(!state.errors.has(path)){state.raw.delete(path);el.value=displayedPrimitiveValue(params,path);}};
      el.onblur=commit;el.onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();cancel();}};
    });
    const taper=q('[data-pm-taper]');if(taper){taper.onfocus=()=>select('UB_heightRatio');taper.oninput=()=>{const input=q('[data-pm-number="UB_heightRatio"]');input.value=taper.value;updateNumber(input);};taper.onchange=()=>{commit();state.raw.delete('UB_heightRatio');syncInputs();};taper.onblur=commit;taper.onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();cancel();}};}
    const preserve=q('[data-pm-preserve]');if(preserve)preserve.onchange=()=>mutate(()=>params.Preserve_thickness=preserve.checked);
    const output=q('[data-pm-output]');output.onfocus=begin;output.oninput=()=>{begin();if(!output.value.trim()){state.errors.set('Mesh_file','Enter an output mesh ID or file.');}else{params.Mesh_file=output.value;state.errors.delete('Mesh_file');options.onChange();}paint();};output.onchange=commit;output.onblur=commit;
    host.querySelectorAll('[data-pm-shape]').forEach(b=>b.onclick=()=>changeShape(b.dataset.pmShape));
    host.querySelectorAll('[data-pm-reset]').forEach(b=>b.onclick=()=>reset(b.dataset.pmReset));
    host.querySelectorAll('[data-pm-axis]').forEach(b=>b.onclick=()=>mutate(()=>{const axis=Number(b.dataset.pmAxis);axisNames.forEach((_,i)=>setPrimitiveNumber(params,'Normal.'+i,i===axis?1:0));}));
    host.querySelectorAll('[data-pm-tool]').forEach(b=>b.onclick=()=>tool(state.mode===b.dataset.pmTool?'shape':b.dataset.pmTool,{fit:true}));
    host.querySelectorAll('[data-pm-display]').forEach(b=>b.onclick=()=>{state.display=b.dataset.pmDisplay;paint();sync();});
    q('[data-pm-visible]').onchange=e=>{state.visible=e.target.checked;sync();paint();};
    q('.pm-viewport-tools').ontoggle=e=>state.toolsOpen=e.target.open;
    q('[data-pm-undo]').onclick=()=>history();q('[data-pm-redo]').onclick=()=>history(true);q('[data-pm-fit]').onclick=()=>overlay?.frame();q('[data-pm-preview]').onclick=()=>generate(true);q('[data-pm-generate]').onclick=()=>generate(false);
    q('[data-pm-browse]').onclick=async()=>{const p=params,s=state;try{const path=await options.onBrowse(p.Mesh_file);if(path&&params===p&&state===s)mutate(()=>params.Mesh_file=path);}catch(error){options.toast(error.message||String(error));}};
    host.onkeydown=e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'&&!['INPUT','TEXTAREA'].includes(e.target.tagName)){e.preventDefault();history(e.shiftKey);}};
  }
  async function generate(temporary){
    if(!api.applyAll()||state.busy||suspended)return;const p=params,s=state,k=keyword,c=options.getContext(p),fingerprint=primitiveMeshFingerprint(k,p);
    s.busy=true;s.actionError='';paint();sync();
    try{
      const result=await options.onGenerate(p,c,temporary);
      if(!result||!options.getContext(p)||options.getContext(p).doc!==c.doc)return;
      if(result.success){s.generated={fingerprint,path:result.meshPath};}
      else s.actionError=result.error||'Mesh generation did not finish.';
    }catch(error){s.actionError=error.message||String(error);options.toast(s.actionError);}
    finally{s.busy=false;if(params===p){render();}}
  }
  const api={
    show(element,k,p){
      if(params&&params!==p){commit();overlay?.hide();}
      host=element;params=p;keyword=k;
      for(const [old,s] of states)if(!options.getContext(old)||s.doc!==options.getContext(old).doc)states.delete(old);
      if(!states.has(p))states.set(p,fresh(p,k));state=states.get(p);state.keyword=k;render();
      if(!state.fitted&&state.visible&&!primitiveMeshError(k,p)){state.fitted=true;sync({fit:true});}
    },
    hide(){if(params){overlay?.cancel();commit();}overlay?.hide();host=null;params=null;state=null;keyword='';},
    attachOverlay(value){overlay=value;if(params)sync({fit:true});},
    select,
    setDisplay(mode){if(params&&['solid','wireframe','edges'].includes(mode)){state.display=mode;paint();}},
    begin(){if(params)begin();},
    drag(path,value){
      if(!params)return false;begin();const draft=cloneNumericJson(params);
      try{if(Array.isArray(value))value.forEach((n,i)=>setPrimitiveNumber(draft,path+'.'+i,n));else setPrimitiveNumber(draft,path,value);if(primitiveMeshError(keyword,draft))return false;restorePrimitiveMesh(params,draft);state.raw.clear();state.errors.clear();state.selected=path;syncInputs();paint();options.onChange();return true;}
      catch{return false;}
    },commit,cancel,
    suspend(value){suspended=value;if(params){paint();sync();}},
    refresh(){if(params){sync();paint();}},
    applyAll(){if(params)commit();for(const [p,s] of states){const c=options.getContext(p);if(!c||s.doc!==c.doc)continue;const error=errorFor(s,c.keyword,p);if(error){options.toast(error);options.onReveal?.(p);return false;}}return true;},
    hasPending(){return [...states].some(([p,s])=>options.getContext(p)&&s.errors.size>0);}
  };return api;
}
