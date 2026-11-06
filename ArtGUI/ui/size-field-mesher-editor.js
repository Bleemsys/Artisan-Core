import {workflowPanelSubtitle} from './workflow-panel-subtitle.js';
import {cloneNumericJson,stringifyNumericJson,numberText} from './numeric-json.js';
import {prepareFieldOperation,tetFieldKeyword} from './field-workflow.js';
import {translate as t} from './i18n.js';
import {mesherKind,mesherTitle,mesherKeys,earlierInputs,isMeshPath,setMesherValue,mesherDraftWorkflow,mesherError,mesherFingerprint,mesherReportSummary} from './size-field-mesher-model.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const L=value=>esc(t(value));
const fmt=value=>Number.isFinite(value)?Number.isInteger(value)?value.toLocaleString('en-US'):value!==0&&Math.abs(value)<1e-6?value.toExponential(3):Number(value.toPrecision(6)).toLocaleString('en-US',{maximumFractionDigits:6}):'—';
const numeric=['sampling_size','hausd','surface_tolerance','hgrad','feature_angle','size_iterations','max_points'];
const booleans=['preserve_features','split_to_triangles'];

export function createSizeFieldMesherEditor(options){
  const states=new Map(),reports=new WeakMap();let active=null,host=null,reportSequence=0;
  const context=params=>options.getContext(params);
  function fresh(params,previous){
    const c=context(params),p=prepareFieldOperation(c.keyword,cloneNumericJson(params)),raw={};
    for(const key of mesherKeys(c.keyword))raw[key]=booleans.includes(key)?p[key]:p[key]===null?'':typeof p[key]==='number'?numberText(p,key):String(p[key]??'');
    return {doc:c.doc,base:stringifyNumericJson(params),raw,initial:{...raw},open:previous?.open??new Set(),sourceMode:isMeshPath(p.mesh_file)?'file':'id',outputMode:isMeshPath(p.export_mesh)?'file':'id',
      sourceId:isMeshPath(p.mesh_file)?'':p.mesh_file,sourceFile:isMeshPath(p.mesh_file)?p.mesh_file:'',outputId:isMeshPath(p.export_mesh)?mesherKind(c.keyword)==='tet'?'TetDomains':'QuadSurface':p.export_mesh,outputFile:isMeshPath(p.export_mesh)?p.export_mesh:'',phase:'idle',actionError:'',meshPath:previous?.meshPath};
  }
  function state(params){
    let s=states.get(params);
    if(!s||s.base!==stringifyNumericJson(params)){s=fresh(params,s);states.set(params,s);}
    if(options.isDiscardedPreview?.(s.meshPath)){s.meshPath=undefined;if(s.phase==='ready')s.phase='idle';}
    if(options.isDiscardedPreview?.(reports.get(params)?.meshPath))reports.delete(params);
    return s;
  }
  const pending=s=>Object.keys(s.raw).some(key=>s.raw[key]!==s.initial[key]);
  function readDraft(params=active){
    const c=context(params);if(!c)throw Error('This meshing step is no longer in the workflow.');
    const s=state(params),p=prepareFieldOperation(c.keyword,cloneNumericJson(params));
    for(const [key,value] of Object.entries(s.raw))if(value!==s.initial[key])setMesherValue(p,key,typeof value==='string'?value.trim():value);
    const workflow=mesherDraftWorkflow(c.doc.WorkFlow,c.key,c.keyword,p),error=mesherError(c.keyword,p,workflow,c.key);if(error)throw Error(error);
    return p;
  }
  function errorFor(params=active){try{readDraft(params);return '';}catch(error){return error.message||String(error);}}
  function message(error,params=active){
    if(active!==params||!host?.querySelector('[data-size-mesher]'))options.onReveal?.(params);
    state(params).actionError=error.message||String(error);paint();options.toast?.(state(params).actionError);return false;
  }
  function apply(params=active){
    try{const draft=readDraft(params),s=state(params);if(stringifyNumericJson(draft)!==stringifyNumericJson(params))options.onCommit(params,draft);
      const next=fresh(params,s);next.phase=s.phase;states.set(params,next);if(active===params&&host?.querySelector('[data-size-mesher]'))render();return true;
    }catch(error){return message(error,params);}
  }
  function render(){
    if(!active||!host||!context(active))return;
    const p=active,c=context(p),s=state(p),kind=mesherKind(c.keyword),tet=kind==='tet',before=earlierInputs(c.doc.WorkFlow,c.key),field=before.fields.find(field=>field.id===s.raw.size_field),record=reports.get(p),summary=mesherReportSummary(c.keyword,record?.report);
    const select=(key,items,placeholder)=>`<select id="sm-${key}" data-sm-value="${key}"><option value="">${L(placeholder)}</option>${s.raw[key]&&!items.some(item=>item.id===s.raw[key])?`<option value="${esc(s.raw[key])}" selected>${esc(s.raw[key])} · ${L('not defined earlier')}</option>`:''}${items.map(item=>`<option value="${esc(item.id)}" ${item.id===s.raw[key]?'selected':''} translate="no">${esc(item.id)} · ${L('Step')} ${esc(item.key)}</option>`).join('')}</select>`;
    const modes=(key,label)=>`<div class="sm-mode" role="group" aria-label="${L(label)}">${[['id','Mesh ID'],['file','File']].map(([value,text])=>`<button type="button" data-sm-mode="${key}" data-sm-mode-value="${value}" aria-pressed="${s[key+'Mode']===value}">${L(text)}</button>`).join('')}</div>`;
    const text=(key,browse=false)=>`<div class="sm-path"><input id="sm-${key}" type="text" data-sm-value="${key}" value="${esc(s.raw[key])}" spellcheck="false">${browse?`<button class="button" type="button" data-sm-browse="${key}" aria-label="${L('Browse')}">${L('Browse…')}</button>`:''}</div>`;
    const num=(key,label,{help='',limits='',unit=''}={})=>`<div class="field"><label for="sm-${key}">${L(label)}</label><div class="sm-number"><input id="sm-${key}" type="number" data-sm-value="${key}" value="${esc(s.raw[key])}" step="${['size_iterations','max_points'].includes(key)?'1':'any'}" ${limits} ${key==='surface_tolerance'?`placeholder="${L('Automatic')} · 2 × ${L('boundary tolerance')}"`:''}>${unit?`<span>${L(unit)}</span>`:''}</div>${help?`<p class="field-help">${L(help)}</p>`:''}</div>`;
    const details=(key,title,body,summary='')=>`<details class="sm-details" data-sm-details="${key}" ${s.open.has(key)?'open':''}><summary><strong>${L(title)}</strong>${summary?`<small>${L(summary)}</small>`:''}</summary><div>${body}</div></details>`;
    const controls=tet?num('sampling_size','Initial seed size',{unit:'model units',limits:'min="0"',help:'Initial seeds only; the field sets final targets.'}):`<div class="field sm-horizontal"><label for="sm-method">${L('Meshing method')}</label><div class="sm-segment" id="sm-method" role="group" aria-label="${L('Meshing method')}">${['SimpleQuad','Subdivision'].map(method=>`<button type="button" data-sm-method="${method}" aria-pressed="${s.raw.method===method}">${method}</button>`).join('')}</div></div><div class="field sm-horizontal"><label>${L('Output elements')}</label><div class="sm-segment" role="group" aria-label="${L('Output elements')}">${[[false,'Quads'],[true,'Split to triangles']].map(([value,label])=>`<button type="button" data-sm-split="${value}" aria-pressed="${s.raw.split_to_triangles===value}">${L(label)}</button>`).join('')}</div></div>`;
    const stats=summary?`<p class="sm-count"><span translate="no">${fmt(summary.vertices)}</span> ${L('vertices')} · <span translate="no">${fmt(tet?summary.tetrahedra:summary.triangle?summary.triangles:summary.quads)}</span> ${L(tet?'tetrahedra':summary.triangle?'triangles':'quads')}</p><dl class="sm-metrics">${!tet&&summary.method?`<dt>${L('Meshing method')}</dt><dd translate="no">${esc(summary.method)}</dd>`:''}<dt>${L('Median edge / target')}</dt><dd translate="no">${fmt(summary.ratio)}</dd><dt>${L(tet?'Minimum tet quality':summary.triangle?'Minimum triangle quality':'Minimum scaled Jacobian')}</dt><dd translate="no">${fmt(summary.quality)}</dd><dt>${L('Sampled surface distance')}</dt><dd translate="no">${fmt(summary.surface)} / ${fmt(summary.tolerance)}</dd>${tet?`<dt>${L('Volume')}</dt><dd translate="no">${fmt(summary.volume)}</dd>`:''}</dl>${summary.review?`<p class="sm-caution">${L(summary.sizeWarning?'Some edges differ substantially from field targets.':'Thin elements remain near small features.')}</p>`:''}`:'';
    const reportBody=record?`<p class="sm-report-state" data-sm-report-state></p>${stats}${record.report?.valid===false?`<p class="sm-caution">${esc(record.report.error||t('Generation failed'))}</p>`:''}`:'';
    host.classList.add('sm-host');
    host.innerHTML=`<div class="sm-editor" data-size-mesher="${kind}"><header class="sm-header property-header"><div class="property-header-copy"><h2>${L(mesherTitle(c.keyword))}</h2><p translate="no">${esc(workflowPanelSubtitle(c.doc.WorkFlow,c.key))}</p></div></header><div class="sm-scroll"><section class="sm-section"><h3>${L('Inputs & output')}</h3><div class="field sm-input"><div class="sm-label-row"><label for="sm-mesh_file">${L('Source mesh')}</label>${modes('source','Surface source')}</div>${s.sourceMode==='id'?select('mesh_file',before.meshes,'Choose an earlier triangle mesh'):text('mesh_file',true)}</div><div class="field sm-input"><label for="sm-size_field">${L('Size field')}</label>${select('size_field',before.fields,'Choose an earlier scalar field')}</div><div class="field sm-input"><div class="sm-label-row"><label for="sm-export_mesh">${L('Output mesh')}</label>${modes('output','Output destination')}</div>${text('export_mesh',s.outputMode==='file')}</div><div class="sm-field-info"><span data-sm-field-range>${L('Field values set target edge lengths in model units.')}</span><div class="sm-field-links"><button type="button" class="sm-link" id="sm-edit-field" ${field?'':'disabled'}>${L('Edit field…')}</button><button type="button" class="sm-link" id="sm-view-field" ${field?'':'disabled'}>${L('View field')}</button></div></div></section><section class="sm-section sm-meshing"><h3>${L('Meshing')}</h3>${controls}<div class="sm-pair">${num('hausd','Boundary tolerance',{unit:'model units',limits:'min="0"'})}${num('hgrad','Size gradation',{limits:'min="1"'})}</div><div class="sm-feature-row"><label class="sm-check"><input type="checkbox" id="sm-preserve_features" data-sm-value="preserve_features" ${s.raw.preserve_features?'checked':''}>${L('Preserve sharp features')}</label><div class="sm-angle"><label for="sm-feature_angle">${L('Feature angle')}</label><input id="sm-feature_angle" data-sm-value="feature_angle" type="number" min="0" max="180" step="any" value="${esc(s.raw.feature_angle)}"><span>°</span></div></div></section>${details('advanced','Advanced settings',num('surface_tolerance','Final surface acceptance tolerance',{limits:'min="0"',help:'Leave empty for twice the boundary tolerance.'})+num('size_iterations','Adaptation passes',{limits:'min="2" max="20"',help:'Resample the field between passes.'})+num('max_points','Vertex limit',{limits:'min="7" max="2147483647"',help:'A vertex-count limit, not a peak-memory limit.'})+`<div class="field"><label for="sm-quality_report">${L('Quality report')}</label>${text('quality_report',true)}<p class="field-help">${L('Optional JSON path; its parent folder must exist.')}</p><button type="button" class="sm-link" id="sm-suggest-report">${L('Use suggested report path')}</button></div>`+(options.renderPresets?details('presets','Example presets',options.renderPresets(p,c.keyword)||''):''),'Acceptance tolerance · passes · vertex limit')}<section class="sm-section sm-result"><div class="sm-result-heading"><h3>${L('Result & quality')}</h3>${record?`<button type="button" class="sm-link" id="sm-open-report">${L('View report')}</button>`:`<button type="button" class="button sm-report-disabled" disabled>${L('View report')}</button>`}</div><p class="sm-result-state" data-sm-result-state>${L('Not generated')}</p>${reportBody}<div class="sm-result-links"><button type="button" class="sm-link" id="sm-view-source">${L('View source')}</button><button type="button" class="sm-link" id="sm-view-mesh" ${record?.meshPath||s.meshPath?'':'disabled'}>${L('View mesh')}</button><button type="button" class="sm-link" id="sm-load-report" ${s.raw.quality_report?'':'disabled'}>${L('Load saved report')}</button></div></section><p class="sm-source-help">${L(tet?'Requires one closed, connected solid surface.':'Supports open or closed triangle surfaces.')}</p><p id="sm-error" class="sm-error" role="alert" hidden></p></div><footer class="sm-footer"><p class="sm-status" role="status" aria-live="polite"><span data-sm-status></span></p><div class="sm-actions"><button type="button" class="button" id="sm-preview">${L('Preview mesh')}</button><button type="button" class="button primary" id="sm-generate">${L('Generate mesh')}</button><button type="button" class="button" id="sm-revert">${L('Revert')}</button></div></footer></div>`;
    bind();paint();options.onRender?.();
  }
  function paint(){
    if(!active||!host?.querySelector('[data-size-mesher]')||!context(active))return;
    const p=active,c=context(p),s=state(p),q=selector=>host.querySelector(selector),error=errorFor(p),record=reports.get(p),stale=record&&(pending(s)||record.fingerprint!==mesherFingerprint(c.doc,c.key)),summary=mesherReportSummary(c.keyword,record?.report),busy=s.phase==='generating';
    q('#sm-preview').disabled=q('#sm-generate').disabled=!!error||busy;q('#sm-revert').disabled=!pending(s)||busy;q('#sm-feature_angle').disabled=!s.raw.preserve_features;
    q('#sm-error').hidden=!(error||s.actionError);q('#sm-error').textContent=t(s.actionError||error);
    const text=busy?'Generating mesh…':s.phase==='failed'?'Generation failed':pending(s)||stale?'Settings changed':record?.saved?'Saved report · verify settings':record?.report?.valid===true?'Mesh ready':s.phase==='ready'?'Mesh generated':'Not generated';
    q('[data-sm-status]').textContent=t(text);q('.sm-status').classList.toggle('sm-pending',pending(s)||!!stale);q('.sm-status').classList.toggle('sm-failed',s.phase==='failed');
    q('#sm-generate').textContent=t(busy?'Generating mesh…':'Generate mesh');
    host.querySelectorAll('[data-sm-method]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.smMethod===s.raw.method)));
    host.querySelectorAll('[data-sm-split]').forEach(button=>button.setAttribute('aria-pressed',String((button.dataset.smSplit==='true')===s.raw.split_to_triangles)));
    q('#sm-hgrad').title=t(c.keyword===tetFieldKeyword?'Must be greater than 1.':s.raw.method==='SimpleQuad'?'Triangle preparation gradation; SimpleQuad limits this to 1.3.':'Must be greater than 1.');
    q('[data-sm-result-state]').textContent=t(record?(stale?'Previous result · regenerate for current settings':record.saved?'Saved report · verify settings':record.report?.valid===true?'Last generated result':'Generation failed'):s.phase==='ready'?'Mesh generated · report unavailable':'Not generated');
    const reportState=q('[data-sm-report-state]');if(reportState)reportState.textContent=t(record.saved?'Saved report · verify settings':stale?'Settings changed since this result.':summary?.review?'Generated · review quality':'Last run');
    const info=options.getFieldInfo?.(p,s.raw.size_field);
    q('[data-sm-field-range]').textContent=info?.range?.every(Number.isFinite)?`${t('Saved field range')}: ${fmt(info.range[0])}–${fmt(info.range[1])} ${t('model units')}`:t('Field values set target edge lengths in model units.');
    if(q('#sm-load-report'))q('#sm-load-report').disabled=!s.raw.quality_report||busy;
  }
  async function view(mode){
    const p=active,s=state(p),draftField=s.raw.size_field;
    try{await options.onView(mode,p,reports.get(p),{size_field:draftField,mesh_file:s.raw.mesh_file});}
    catch(error){if(context(p))message(error,p);}
  }
  async function generate(temporary){
    const p=active;if(!apply(p)||options.onBeforeGenerate?.()===false)return;
    const c=context(p),s=state(p),fingerprint=mesherFingerprint(c.doc,c.key),doc=c.doc;s.phase='generating';s.actionError='';paint();
    try{const result=await options.onGenerate(p,c,temporary);
      if(!context(p)||context(p).doc!==doc||mesherFingerprint(context(p).doc,context(p).key)!==fingerprint)return;
      if(!result){s.phase='idle';return;}
      if(!result.success){s.phase='failed';s.actionError=result.error||t('Generation failed');return;}
      s.phase='ready';s.meshPath=result.meshPath;
      if(result.record)reports.set(p,{...result.record,fingerprint,saved:false});
      if(result.reportError)s.actionError=result.reportError;
    }catch(error){s.phase='failed';s.actionError=error.message||String(error);options.toast?.(s.actionError);}
    finally{if(s.phase==='generating')s.phase='idle';if(active===p&&host?.querySelector('[data-size-mesher]'))render();}
  }
  async function loadReport(p=active,saved=true,expected=null){
    const c=context(p);if(!c||!p.quality_report)return;
    const token=++reportSequence;
    try{const value=await options.onReport(p,c);if(token!==reportSequence||!context(p)||context(p).doc!==c.doc)return;
      reports.set(p,{...value,saved,fingerprint:expected||mesherFingerprint(c.doc,c.key)});state(p).phase=value.report?.valid===true?'ready':'failed';state(p).actionError='';if(active===p&&host?.querySelector('[data-size-mesher]'))render();return value;
    }catch(error){if(token===reportSequence&&active===p&&context(p))message(error,p);}
  }
  function bind(){
    const p=active,s=state(p),c=context(p),q=selector=>host.querySelector(selector);
    const update=el=>{const key=el.dataset.smValue;s.raw[key]=el.type==='checkbox'?el.checked:el.value;s.actionError='';if(key==='mesh_file')s[s.sourceMode==='file'?'sourceFile':'sourceId']=el.value;if(key==='export_mesh')s[s.outputMode==='file'?'outputFile':'outputId']=el.value;paint();};
    host.querySelectorAll('[data-sm-value]').forEach(el=>{el.oninput=()=>update(el);el.onchange=()=>update(el);});
    host.querySelectorAll('[data-sm-method]').forEach(el=>el.onclick=()=>{s.raw.method=el.dataset.smMethod;s.actionError='';paint();});
    host.querySelectorAll('[data-sm-split]').forEach(el=>el.onclick=()=>{s.raw.split_to_triangles=el.dataset.smSplit==='true';s.actionError='';paint();});
    host.querySelectorAll('[data-sm-mode]').forEach(el=>el.onclick=()=>{const name=el.dataset.smMode,mode=el.dataset.smModeValue;s[name+'Mode']=mode;s.raw[name==='source'?'mesh_file':'export_mesh']=s[name+(mode==='file'?'File':'Id')]||'';s.actionError='';render();});
    host.querySelectorAll('[data-sm-details]').forEach(el=>el.ontoggle=()=>el.open?s.open.add(el.dataset.smDetails):s.open.delete(el.dataset.smDetails));
    host.querySelectorAll('[data-sm-browse]').forEach(el=>el.onclick=async()=>{try{const key=el.dataset.smBrowse,path=await options.onBrowse(key,p,c.keyword,s.raw);if(path&&active===p){s.raw[key]=path;s.actionError='';if(key==='mesh_file')s.sourceFile=path;if(key==='export_mesh')s.outputFile=path;render();}}catch(error){message(error,p);}});
    q('#sm-edit-field').onclick=()=>{const field=earlierInputs(c.doc.WorkFlow,c.key).fields.find(field=>field.id===s.raw.size_field);if(field)options.onEditField(field,p);};
    q('#sm-view-field').onclick=()=>view('field');q('#sm-view-source').onclick=()=>view('source');q('#sm-view-mesh').onclick=()=>view('mesh');
    q('#sm-preview').onclick=()=>generate(true);q('#sm-generate').onclick=()=>generate(false);q('#sm-revert').onclick=()=>{states.set(p,fresh(p,s));render();};
    q('#sm-suggest-report').onclick=()=>{const stem=String(s.raw.export_mesh||mesherKind(c.keyword)).split(/[\\/]/).pop().replace(/[.][^.]+$/,'').replace(/[^a-zA-Z0-9_-]/g,'_');s.raw.quality_report='./Test_results/'+stem+'_quality.json';render();};
    q('#sm-load-report').onclick=()=>{if(apply(p))loadReport(p,true);};
    if(q('#sm-open-report'))q('#sm-open-report').onclick=()=>options.onOpenReport(reports.get(p),c.keyword);
  }
  return {
    show(element,params){host=element;active=params;const doc=context(params).doc;for(const [p,s] of states)if(s.doc!==doc||!context(p))states.delete(p);state(params);render();},
    hide(){active=null;host=null;reportSequence++;},refresh:()=>active&&render(),readDraft:()=>readDraft(),apply:()=>apply(),
    hasPending:()=>[...states].some(([p,s])=>context(p)&&s.doc===context(p).doc&&pending(state(p))),
    applyAll(){const current=[...states].filter(([p,s])=>context(p)&&s.doc===context(p).doc);for(const [p] of current)try{readDraft(p);}catch(error){return message(error,p);}for(const [p] of current)if(pending(state(p))&&!apply(p))return false;return true;},
    loadReport,getReport:p=>reports.get(p)
  };
}
