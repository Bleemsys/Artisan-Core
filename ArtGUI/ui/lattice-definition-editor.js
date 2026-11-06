import {workflowPanelSubtitle} from './workflow-panel-subtitle.js';
import {cloneNumericJson,parseNumericJson,stringifyNumericJson,setNumber} from './numeric-json.js';
import {definitionTypes,definitionError,isMeshType,latticeReferences} from './lattice-schema.js';
import {operationIcon} from './operation-icons.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const domains={Hex:'Cube (Hex)',Tet:'Tetrahedron (Tet)',Quad:'Quadrilateral (Quad)',Triangle:'Triangle'};
const periods=['unit_x_len','unit_y_len','unit_z_len'];
const signature=params=>stringifyNumericJson(params);
const fieldKeys=type=>isMeshType(type)?['meshfile',...(type==='ConformalLattice'?['la_name']:[]),'k','field_mode']:['ladomain',...(type==='strut'?['pts','cnnt']:type.startsWith('TPMS')?[...periods,'expr']:['file'])];

// Draft values belong to the definition object, rather than a transient DOM tree.
// This preserves unfinished edits through selection, viewer and language updates.
export function createLatticeDefinitionEditor(options){
  const records=new Map();
  let host=null,current=null;
  const context=params=>options.getContext(params);
  function createRecord(params,previous){
    const type=params.definition.type,d=params.definition.definition||{},values={};
    for(const key of fieldKeys(type))values[key]=['pts','cnnt'].includes(key)?stringifyNumericJson(d[key]??[]):String(d[key]??(key==='field_mode'&&d[key]===undefined?'band':''));
    return {base:signature(params),doc:context(params).doc,name:params.la_name,values,originalValues:{...values},initial:JSON.stringify([params.la_name,values]),
      linked:type.startsWith('TPMS')&&periods.every(k=>values[k]===values.unit_x_len),
      open:previous?.open??new Set(['cell']),applied:false,error:''};
  }
  function record(params){
    let state=records.get(params);
    if(!state||state.base!==signature(params)){state=createRecord(params,state);records.set(params,state);}
    return state;
  }
  const changed=state=>JSON.stringify([state.name,state.values])!==state.initial;
  function readDraft(params){
    const state=record(params),definition=cloneNumericJson(params.definition),name=state.name.trim();
    const nameError=options.validateName?.(name,params);if(nameError)throw Error(nameError);
    definition.definition ||= {};
    for(const [key,value] of Object.entries(state.values)){
      if(value===state.originalValues[key])continue;
      if(['pts','cnnt'].includes(key))definition.definition[key]=parseNumericJson(value);
      else if(key==='k'){if(value.trim())setNumber(definition.definition,key,value,'float');else delete definition.definition[key];}
      else definition.definition[key]=value.trim();
    }
    const error=definitionError(definition);if(error)throw Error(error);
    if(definition.type==='ConformalLattice'&&(definition.definition.la_name===name||Object.values(context(params).doc.WorkFlow||{}).some(step=>step.Define_Lattice?.la_name===definition.definition.la_name&&isMeshType(step.Define_Lattice.definition?.type))))throw Error('A conformal definition must reference a separate unit cell, not a mesh or conformal lattice.');
    return {name,definition};
  }
  function errorFor(params){try{readDraft(params);return '';}catch(error){return error.message||String(error);}}
  function field(state,key,label,{help='',json=false,number=false,path=false,picker=false}={}){
    const value=state.values[key]??'';
    const control=picker?options.renderLatticePicker(current,value):json?`<textarea id="lattice-${key}" data-lattice-field="${key}" data-kind="json" spellcheck="false">${esc(value)}</textarea>`:`<div class="${path?'path-row':''}"><input id="lattice-${key}" data-lattice-field="${key}" data-kind="${number?'number':'text'}" type="${number?'number':'text'}" ${number?'min="0" step="any"':''} value="${esc(value)}">${path?`<button type="button" class="icon-button" data-lattice-browse="${key}" aria-label="Browse ${esc(label)}">${operationIcon('file-input')}</button>`:''}</div>`;
    return `<div class="field"><label for="lattice-${key}${picker?'-select':''}">${label}</label>${control}${help?`<p class="field-help">${help}</p>`:''}</div>`;
  }
  function section(state,key,number,title,summary,body){
    return `<details class="ld-section" data-ld-section="${key}" ${state.open.has(key)?'open':''}><summary><span class="ld-number" aria-hidden="true">${number}</span><span class="ld-section-heading"><strong>${title}</strong><small data-ld-summary="${key}">${summary}</small></span></summary><div class="ld-section-body">${body}</div></details>`;
  }
  function usage(params){
    const {doc,key}=context(params),steps=[...new Set(latticeReferences(doc).filter(ref=>ref.value===params.la_name).map(ref=>ref.step))];
    return {steps,body:steps.length?`<p class="field-help">Changes to this definition affect these workflow steps.</p><div class="ld-usage-list">${steps.map(step=>`<button type="button" class="ld-usage-step" data-ld-use-step="${esc(step)}"><span><span>Step</span> <span translate="no">${esc(step)}</span></span><span translate="no">${esc(Object.keys(doc.WorkFlow[step]||{}).join(', '))}</span>${operationIcon('chevron-down')}</button>${Number(step)<Number(key)?'<p class="ld-order-warning">This step precedes its definition. Move the definition earlier before generating.</p>':''}`).join('')}</div>`:'<p class="field-help">This definition is not used in the workflow yet.</p>'};
  }
  function render(){
    if(!host||!current)return;
    const state=record(current),type=current.definition.type,{steps,body:usageBody}=usage(current),mesh=isMeshType(type);
    // The name is the workflow identity, not a key inside definition.definition.
    let identity=`<div class="field"><label for="lattice-name">Lattice name</label><input id="lattice-name" type="text" value="${esc(state.name)}" autocomplete="off"></div>`;
    if(!mesh)identity+=`<div class="field"><label for="lattice-domain">Reference domain</label><select id="lattice-domain" data-lattice-field="ladomain" data-kind="text">${Object.entries(domains).map(([value,label])=>`<option value="${value}" ${state.values.ladomain===value?'selected':''}>${label}</option>`).join('')}</select></div>`;
    let cell='',advanced='';
    if(type==='strut'){
      cell=`<p class="ld-cell-summary"><span>${Array.isArray(current.definition.definition?.pts)?current.definition.definition.pts.length:0}</span> <span>nodes</span> · <span>${Array.isArray(current.definition.definition?.cnnt)?current.definition.definition.cnnt.length:0}</span> <span>connections</span></p><button type="button" class="button ld-designer" id="edit-strut-cell">Open strut cell designer</button><p class="field-help" data-ld-designer-help></p>`;
      advanced=field(state,'pts','Node coordinates',{json:true,help:'Normalized [X, Y, Z] coordinates. Tet nodes also require X + Y + Z ≤ 1.'})+field(state,'cnnt','Strut connections',{json:true,help:'Each pair contains two zero-based node indices.'});
    }else if(type.startsWith('TPMS')){
      cell=`<div class="field"><label for="lattice-expr">Implicit expression</label><textarea id="lattice-expr" data-lattice-field="expr" data-kind="text" spellcheck="false">${esc(state.values.expr)}</textarea></div><div class="ld-periods">${periods.map((key,index)=>field(state,key,['X period','Y period','Z period'][index])).join('')}<button type="button" class="icon-button ld-link" id="lattice-link-periods" aria-label="Link periods" aria-pressed="${state.linked}" title="Link periods">${operationIcon('network')}</button></div><p class="field-help">Periods use expression coordinates.</p>`;
      if(type==='TPMS')cell+='<button type="button" class="button ld-designer" id="edit-tpms-cell">Open TPMS cell designer</button><p class="field-help" data-ld-designer-help></p>';
      else cell+='<p class="field-help">Create referenced grid fields earlier with OP_Fit_GridField. Expressions are evaluated by Artisan.</p>';
    }else if(mesh){
      cell=field(state,'meshfile','Mesh file or mesh variable',{path:true,help:'Use a mesh file or a mesh variable created earlier in the workflow.'});
      if(type==='ConformalLattice')cell+=field(state,'la_name','Unit lattice',{picker:true,help:'Match the unit-cell reference domain to the mesh.'});
      const mode=state.values.field_mode,validMode=['band','full'].includes(mode);
      advanced=`<div class="field"><label for="lattice-field_mode">Strut field mode</label><select id="lattice-field_mode" data-lattice-field="field_mode" data-kind="text" aria-describedby="lattice-field-mode-help">${validMode?'':`<option value="${esc(mode)}" selected disabled>Choose a field mode</option>`}<option value="band" ${mode==='band'?'selected':''}>Band (default)</option><option value="full" ${mode==='full'?'selected':''}>Full field</option></select><p class="field-help" id="lattice-field-mode-help">Band uses local regions. Full completes distant values for later offsets. Applies to struts.</p></div>`+field(state,'k','Joint smoothing (k)',{number:true,help:'0 means no smoothing. Higher values blend joints and add material.'});
    }else{
      cell=field(state,'file','Geometry file',{path:true,help:type==='Geom'?'Use a closed, watertight unit-cell mesh.':'Use a surface mesh to define the plate unit cell.'})+`<button type="button" class="button ld-designer" id="edit-mesh-cell">${type==='Geom'?'Open Geometry cell designer':'Open Plate cell designer'}</button><p class="field-help" data-ld-designer-help></p>`;
    }
    if(type!=='strut')advanced+='<div class="field"><label for="lattice-definition-json">Definition JSON (read only)</label><textarea id="lattice-definition-json" class="ld-json" readonly spellcheck="false" translate="no"></textarea><p class="field-help">Inspect the definition that will be applied.</p></div>';
    const description=mesh?'Mesh and unit-cell inputs.':type==='strut'?'Edit nodes and connections in the cell designer.':'Describe the repeating unit cell.';
    host.classList.add('ld-host');
    host.innerHTML=`<div class="ld-editor"><header class="ld-header property-header"><div class="property-header-copy"><h2 translate="no">${esc(current.la_name)}</h2><p class="ld-subtitle" translate="no">${esc(workflowPanelSubtitle(context(current).doc.WorkFlow,context(current).key))}</p></div><details class="ld-menu"><summary aria-label="Definition actions">More</summary><div><button type="button" id="export-lattice">Export definition…</button><button type="button" id="delete-lattice">Remove definition</button></div></details></header><div class="ld-scroll">${section(state,'identity',1,'Identity','',identity)}${section(state,'cell',2,'Cell definition',description,cell)}${section(state,'advanced',3,'Advanced definition',type==='strut'?'Node coordinates and connections':mesh?'Field mode, joint smoothing and definition JSON':'Inspect definition JSON',advanced)}${section(state,'usage',4,'Usage',`<span>Used by</span> <span translate="no">${steps.length}</span> <span>workflow steps</span>`,usageBody)}<p class="ld-hint">Physical size, thickness and placement are set in Add_Lattice.</p><p id="lattice-error" class="lattice-error ld-error" role="alert" hidden></p></div><footer class="ld-footer"><p class="ld-status" role="status" aria-live="polite"><span data-ld-status></span></p><div class="ld-actions"><button type="button" class="button primary" id="apply-lattice">Apply changes</button><button type="button" class="button" id="revert-lattice">Revert</button><button type="button" class="ld-use" id="use-lattice">Use in Add_Lattice…</button></div></footer></div>`;
    bind();paint();
  }
  function paint(){
    if(!host?.isConnected||!current||!host.querySelector('.ld-editor'))return;
    const state=record(current),type=current.definition.type,error=errorFor(current),pending=changed(state),q=s=>host.querySelector(s);
    q('[data-ld-summary="identity"]').innerHTML=`<span translate="no">${esc(state.name||current.la_name)}</span>${isMeshType(type)?'':` · <span>${esc(domains[state.values.ladomain]||state.values.ladomain)}</span>`}`;
    q('[data-ld-status]').textContent=pending?'Unapplied changes':state.applied?'Applied to workflow':'No unapplied changes';
    q('.ld-status').classList.toggle('ld-pending',pending);
    q('#apply-lattice').disabled=!pending||!!error;
    q('#revert-lattice').disabled=!pending;
    q('#use-lattice').disabled=!!error;
    q('#lattice-error').hidden=!error;q('#lattice-error').textContent=error;
    const json=q('#lattice-definition-json');
    if(json){try{json.value=stringifyNumericJson(readDraft(current).definition);}catch{json.value=stringifyNumericJson(current.definition);}}
    const domain=state.values.ladomain,designer=q('#edit-strut-cell,#edit-tpms-cell,#edit-mesh-cell'),help=q('[data-ld-designer-help]');
    if(designer){const supported=type==='TPMS'?domain==='Hex':['Hex','Tet'].includes(domain);designer.disabled=!supported||!!error;
      if(help){help.textContent=supported?'':type==='TPMS'?'The visual designer supports TPMS definitions in Cube (Hex) cells.':'The visual designer supports Cube (Hex) and Tetrahedron (Tet) cells.';help.hidden=supported;}}
    const link=q('#lattice-link-periods');if(link)link.setAttribute('aria-pressed',String(state.linked));
  }
  function report(error,params=current){
    if(params!==current||!host?.querySelector('.ld-editor'))options.onReveal?.(params);
    const message=error.message||String(error),node=host?.querySelector('#lattice-error');if(node){node.hidden=false;node.textContent=message;node.scrollIntoView?.({block:'nearest'});}
    options.notify?.(message);return false;
  }
  function applyOne(params=current){
    try{const draft=readDraft(params),state=record(params);
      if(draft.name!==params.la_name||stringifyNumericJson(draft.definition)!==stringifyNumericJson(params.definition)){
        const previous=params.la_name;options.onApply(params,draft);
        // Rename propagation can change another definition's applied input.
        // Update its baseline without losing a separate, unfinished panel edit.
        if(previous!==draft.name)for(const [other,saved] of records)if(other!==params&&context(other)){
          const base=parseNumericJson(saved.base);for(const ref of latticeReferences({WorkFlow:{'1':{Define_Lattice:base}}}))if(ref.value===previous)ref.object[ref.key]=draft.name;
          if(signature(base)===signature(other)){
            saved.base=signature(other);
            if(saved.originalValues.la_name===previous){saved.originalValues.la_name=draft.name;if(saved.values.la_name===previous)saved.values.la_name=draft.name;}
            saved.initial=JSON.stringify([base.la_name,saved.originalValues]);
          }
        }
      }
      const next=createRecord(params,state);next.applied=true;records.set(params,next);
      if(params===current&&host?.querySelector('.ld-editor'))render();return true;
    }catch(error){return report(error,params);}
  }
  function bind(){
    const q=s=>host.querySelector(s),state=record(current),params=current;
    host.querySelectorAll('[data-ld-section]').forEach(details=>details.ontoggle=()=>{if(details.open)state.open.add(details.dataset.ldSection);else state.open.delete(details.dataset.ldSection);});
    function update(input){
      const key=input.dataset.latticeField;
      if(input.id==='lattice-name')state.name=input.value;
      else if(key){state.values[key]=input.value;if(state.linked&&periods.includes(key))for(const k of periods){state.values[k]=input.value;q('#lattice-'+k).value=input.value;}}
      paint();
    }
    host.querySelectorAll('#lattice-name,[data-lattice-field]').forEach(input=>{input.oninput=()=>update(input);input.onchange=()=>update(input);});
    host.querySelectorAll('[data-lattice-select]').forEach(select=>select.onchange=()=>{const input=q('#'+select.dataset.latticeSelect);input.style.display=select.value?'none':'';if(select.value){input.value=select.value;update(input);}else input.focus();});
    if(q('#lattice-link-periods'))q('#lattice-link-periods').onclick=()=>{state.linked=!state.linked;
      // Linking is an inspection preference. It copies values only on the next edit.
      paint();};
    q('#apply-lattice').onclick=()=>applyOne(params);
    q('#revert-lattice').onclick=()=>{records.set(params,createRecord(params,state));render();};
    q('#use-lattice').onclick=()=>{if(applyOne(params))options.onUse(params);};
    for(const id of ['edit-strut-cell','edit-tpms-cell','edit-mesh-cell'])if(q('#'+id))q('#'+id).onclick=()=>{try{options.onEdit(params,readDraft(params));}catch(error){report(error);}};
    q('#export-lattice').onclick=async()=>{try{if(applyOne(params))await options.onExport(params);}catch(error){report(error);}};
    q('#delete-lattice').onclick=()=>options.onRemove(params);
    host.querySelectorAll('[data-ld-use-step]').forEach(button=>button.onclick=()=>options.onNavigate(button.dataset.ldUseStep));
    host.querySelectorAll('[data-lattice-browse]').forEach(button=>button.onclick=async()=>{try{const key=button.dataset.latticeBrowse,input=q('#lattice-'+key),path=await options.onBrowse(key);
      if(path&&current===params&&input.isConnected){input.value=path;if(key==='la_name'){input.style.display='';q('#lattice-la_name-select').value='';}update(input);}
    }catch(error){report(error);}});
    // Keep the local action menu out of the way after a choice.
    q('.ld-menu').addEventListener('keydown',event=>{if(event.key==='Escape'){event.stopPropagation();q('.ld-menu').open=false;q('.ld-menu>summary').focus();}});
  }
  return {
    show(element,params){host=element;current=params;const activeDoc=context(params).doc;for(const [key,value] of records)if(value.doc!==activeDoc||!context(key))records.delete(key);record(params);render();},
    readDraft:()=>readDraft(current),
    hasPending:()=>[...records.keys()].some(params=>context(params)&&changed(record(params))),
    apply:()=>applyOne(),
    applyAll(){
      const active=[...records.keys()].filter(params=>context(params)&&records.get(params).doc===context(params).doc);
      // Validate every visited draft before mutating any workflow object.
      for(const params of active)try{readDraft(params);}catch(error){return report(error,params);}
      const names=active.map(params=>readDraft(params).name);if(new Set(names).size!==names.length)return report(Error('Choose a unique name that does not replace an integrated lattice.'));
      for(const params of active)if(changed(record(params))&&!applyOne(params))return false;
      return true;
    }
  };
}
