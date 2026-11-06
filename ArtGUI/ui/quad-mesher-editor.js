import {quadKeyword,quadKeys,quadMethods,earlierInputs,quadError,updateQuadValue,quadFingerprint,reportSummary,isMeshPath} from './quad-mesher-model.js';
import {numberText} from './numeric-json.js';
import {translate as t} from './i18n.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>Number.isFinite(n)?(Number.isInteger(n)?n.toLocaleString('en-US'):Number(n.toPrecision(5)).toLocaleString('en-US',{maximumFractionDigits:5})):'—';
const L=s=>esc(t(s));

export function createQuadMesherEditor({getContext,onChange,onBrowse,onEditField,onView,onReport,onOpenReport,renderPresets,onRender,toast}){
  const states=new WeakMap(),reports=new WeakMap();let active=null,host=null,sequence=0;
  const state=p=>{if(!states.has(p))states.set(p,{sourceMode:isMeshPath(p.mesh_file)?'file':'id',outputMode:isMeshPath(p.export_mesh)?'file':'id',open:new Set(),view:'source',sourceId:isMeshPath(p.mesh_file)?'':p.mesh_file,sourceFile:isMeshPath(p.mesh_file)?p.mesh_file:'',outputId:isMeshPath(p.export_mesh)?'QuadSurface':p.export_mesh,outputFile:isMeshPath(p.export_mesh)?p.export_mesh:''});return states.get(p);};
  function show(nextHost,p){host=nextHost;active=p;render();}
  function hide(){active=null;host=null;sequence++;const tools=document.getElementById('quad-view-tools');if(tools)tools.hidden=true;}
  function render(){
    if(!active||!host)return;
    const p=active,s=state(p),{doc,key}=getContext(p);if(!key)return;
    const inputs=earlierInputs(doc.WorkFlow,key),field=inputs.fields.find(f=>f.id===p.size_field),error=quadError(p,doc.WorkFlow,key),record=reports.get(p),summary=reportSummary(record?.report);
    const stale=record&&(record.saved||record.fingerprint!==quadFingerprint(doc,key));
    const method=p.method===undefined?'SimpleQuad':p.method;
    const methodHelp=method==='Subdivision'?'Subdivides adapted triangles into quads; elements may look more like diamonds.':'Builds a direction-aligned quad layout, usually with more square-like elements.';
    const passesHelp=method==='Subdivision'?'Triangle adaptation passes before subdivision.':'Quad refinement passes; resamples the size field.';
    const gradationHelp=method==='Subdivision'?'Must be greater than 1.':'Triangle preparation gradation; SimpleQuad limits this to 1.3.';
    const select=(name,items,value,placeholder)=>`<select id="quad-${name}" data-quad-value="${name}"><option value="">${L(placeholder)}</option>${value&&!items.some(i=>i.id===value)?`<option value="${esc(value)}" selected>${esc(value)} · ${L('not defined earlier')}</option>`:''}${items.map(i=>`<option value="${esc(i.id)}" ${value===i.id?'selected':''}>${esc(i.id)} · ${L('Step')} ${esc(i.key)}</option>`).join('')}</select>`;
    const modes=(name,current)=>`<div class="quad-modes" role="group" aria-label="${L(name==='source'?'Surface source':'Output destination')}">${[['id','Mesh ID'],['file','File']].map(([value,label])=>`<label><input type="radio" name="quad-${name}-mode" value="${value}" data-quad-mode="${name}" ${current===value?'checked':''}>${L(label)}</label>`).join('')}</div>`;
    const text=(name,value,browse)=>`<div class="quad-path"><input id="quad-${name}" type="text" value="${esc(value)}" data-quad-value="${name}" spellcheck="false" translate="no">${browse?`<button type="button" class="button" data-quad-browse="${name}" aria-label="${L('Browse')}">${L('Browse…')}</button>`:''}</div>`;
    const numeric=(name,label,help='',limits='')=>`<div class="field"><label for="quad-${name}">${L(label)}</label><input id="quad-${name}" type="number" step="${['size_iterations','max_points'].includes(name)?'1':'any'}" value="${esc(p[name]===null?'':numberText(p,name))}" data-quad-value="${name}" ${limits} ${name==='surface_tolerance'?`placeholder="${L('Automatic')} (${fmt(2*p.hausd)})"`:''}><p class="field-help">${L(help)}</p></div>`;
    const details=(name,title,body)=>`<details class="quad-details" data-quad-details="${name}" ${s.open.has(name)?'open':''}><summary>${L(title)}</summary><div>${body}</div></details>`;
    const stats=summary?`<div class="quad-report-count" translate="no">${fmt(summary.quads)} ${L('quads')} · ${fmt(summary.triangles)} ${L('triangles')}</div><dl class="quad-metrics">${summary.method?`<dt>${L('Meshing method')}</dt><dd translate="no">${esc(summary.method)}</dd>`:''}<dt>${L('Vertices')}</dt><dd translate="no">${fmt(summary.vertices)}</dd><dt>${L('Median edge / target')}</dt><dd translate="no">${fmt(summary.ratio)}</dd><dt>${L('Sampled surface distance')}</dt><dd translate="no">${fmt(summary.surface)} / ${fmt(summary.tolerance)}</dd><dt>${L(summary.triangle?'Minimum triangle quality':'Minimum scaled Jacobian')}</dt><dd translate="no">${fmt(summary.quality)}</dd></dl>${summary.review?`<p class="quad-caution">${L(summary.sizeWarning?'Some edges differ substantially from field targets.':'Thin elements remain near small features.')}</p>`:''}`:record?.report.valid===false?`<p class="quad-error">${esc(record.report.error||t('Generation failed'))}</p>`:`<p class="field-help">${L('Load the quality report after generation to inspect counts, sizing and element quality.')}</p>`;
    host.innerHTML=`<div class="quad-editor" data-quad-editor><div class="quad-intro"><p>${L('Surface elements sized by a scalar field.')}</p><span class="quad-badge">${L(p.split_to_triangles?'Split triangles':'All quads')}</span></div>
      <section class="quad-section"><div class="field"><label for="quad-method">${L('Meshing method')}</label><select id="quad-method" data-quad-value="method">${quadMethods.map(value=>`<option value="${value}" ${method===value?'selected':''} translate="no">${value}</option>`).join('')}</select><p class="field-help">${L(methodHelp)}</p></div></section>
      <section class="quad-section"><h3>${L('Input')}</h3><div class="field"><div class="quad-field-head"><label for="quad-mesh_file">${L('Surface')}</label>${modes('source',s.sourceMode)}</div>${s.sourceMode==='id'?select('mesh_file',inputs.meshes,p.mesh_file,'Choose an earlier triangle mesh'):text('mesh_file',p.mesh_file,true)}<p class="field-help">${L('One connected open or closed triangle surface.')}</p></div>
      <div class="field"><div class="quad-field-head"><label for="quad-size_field">${L('Size field')}</label><button class="quad-link" type="button" id="quad-edit-field" ${!field?'disabled':''}>${L('Edit field step')}</button></div>${select('size_field',inputs.fields,p.size_field,'Choose an earlier scalar field')}<p class="field-help">${L('Positive field values are target quad edge lengths in model units. Coverage is checked during generation.')}</p></div>
      <div class="field"><div class="quad-field-head"><label for="quad-export_mesh">${L('Output mesh')}</label>${modes('output',s.outputMode)}</div>${text('export_mesh',p.export_mesh,s.outputMode==='file')}<p class="field-help">${L(s.outputMode==='id'?'Store the mesh for later workflow steps.':'Choose a format compatible with the output elements.')}</p></div>
      <label class="quad-check"><input id="quad-split" type="checkbox" data-quad-value="split_to_triangles" ${p.split_to_triangles?'checked':''}>${L('Split quads into triangles')}</label><p class="field-help">${L('Two surface triangles per quad; vertices stay unchanged. Matching export steps update automatically.')}</p></section>
      <section class="quad-section"><h3>${L('Feature preservation')}</h3><label class="quad-check"><input type="checkbox" data-quad-value="preserve_features" ${p.preserve_features?'checked':''}>${L('Preserve sharp features')}</label><div class="quad-angle"><label for="quad-feature_angle">${L('Feature angle')}</label><input id="quad-feature_angle" type="number" min="0" max="180" step="any" value="${esc(numberText(p,'feature_angle'))}" data-quad-value="feature_angle" ${!p.preserve_features?'disabled':''}><span>°</span></div></section>
      ${details('geometry','Geometry & sizing',numeric('hausd','Surface approximation','Per-pass geometry tolerance in model units.','min="0"')+numeric('surface_tolerance','Final surface tolerance','Leave empty for twice the surface approximation.','min="0"')+numeric('hgrad','Size gradation',gradationHelp,'min="1"')+numeric('size_iterations','Adaptation passes',passesHelp,'min="2" max="20"'))}
      ${details('limits','Limits & report',numeric('max_points','Vertex limit','A vertex-count limit, not a peak-memory limit.','min="7" max="2147483647"')+`<div class="field"><label for="quad-quality_report">${L('Quality report')}</label>${text('quality_report',p.quality_report,true)}<p class="field-help">${L('Optional JSON path; its parent folder must exist.')}</p><button class="button subtle" type="button" id="quad-enable-report">${L('Use suggested report path')}</button></div>`)}
      ${details('presets','Example presets',renderPresets?.(p)||'')}
      <p id="quad-error" class="quad-error" role="status">${esc(t(error))}</p>
      <section class="quad-saved-report"><div class="quad-result-title"><strong>${L(record?(stale?'Saved report · verify settings':summary?.review?'Generated · review quality':'Last run'):'Quality report')}</strong><button type="button" class="quad-link" id="quad-load-report" ${!p.quality_report?'disabled':''}>${L(record?'Reload report':'Load saved report')}</button></div>${stats}${stale?`<p class="field-help">${L('This saved result may use different settings. Generate again to validate the current inputs.')}</p>`:''}${record?`<button type="button" class="quad-link" id="quad-open-report">${L('Review quality report')}</button>`:''}<p class="field-help">${L('Target sizes are approximate; geometry may require smaller cells.')}</p></section></div>`;
    host.querySelectorAll('[data-quad-value]').forEach(el=>el.onchange=()=>{
      const name=el.dataset.quadValue;try{updateQuadValue(p,name,el.type==='checkbox'?el.checked:el.value,doc.WorkFlow,key);if(name==='mesh_file')s[s.sourceMode==='file'?'sourceFile':'sourceId']=p[name];if(name==='export_mesh')s[s.outputMode==='file'?'outputFile':'outputId']=p[name];onChange();render();}catch(e){toast(e.message);render();}
    });
    host.querySelectorAll('[data-quad-mode]').forEach(el=>el.onchange=()=>{
      const source=el.dataset.quadMode==='source',mode=el.value;s[source?'sourceMode':'outputMode']=mode;
      const value=s[source?(mode==='file'?'sourceFile':'sourceId'):(mode==='file'?'outputFile':'outputId')]||'';
      updateQuadValue(p,source?'mesh_file':'export_mesh',value,doc.WorkFlow,key);onChange();render();
    });
    host.querySelectorAll('[data-quad-details]').forEach(el=>el.ontoggle=()=>el.open?s.open.add(el.dataset.quadDetails):s.open.delete(el.dataset.quadDetails));
    host.querySelectorAll('[data-quad-browse]').forEach(el=>el.onclick=async()=>{const name=el.dataset.quadBrowse;try{const value=await onBrowse(name,p);if(value&&active===p){updateQuadValue(p,name,value,doc.WorkFlow,key);if(name==='mesh_file')s.sourceFile=value;if(name==='export_mesh')s.outputFile=value;onChange();render();}}catch(e){toast(String(e));}});
    host.querySelector('#quad-edit-field').onclick=()=>field&&onEditField(field,p);
    host.querySelector('#quad-enable-report').onclick=()=>{p.quality_report='./Test_results/'+String(p.export_mesh||'QuadSurface').split(/[\\/]/).pop().replace(/\.[^.]+$/,'').replace(/[^a-zA-Z0-9_-]/g,'_')+'_quality.json';onChange();render();};
    host.querySelector('#quad-load-report').onclick=()=>loadReport(p,true);
    const open=host.querySelector('#quad-open-report');if(open)open.onclick=()=>onOpenReport(record);
    paintTools(p,s);onRender?.();
  }
  function paintTools(p,s){
    let tools=document.getElementById('quad-view-tools');
    if(!tools){tools=document.createElement('div');tools.id='quad-view-tools';tools.className='quad-view-tools';tools.setAttribute('aria-label',t('Quad surface view'));document.getElementById('viewport').append(tools);}
    const saved=reportSummary(reports.get(p)?.report);
    tools.hidden=false;tools.innerHTML=[['source','Source'],['field','Size field'],['mesh',(saved?saved.triangle:p.split_to_triangles)?'Triangle mesh':'Quad mesh']].map(([view,label])=>`<button type="button" class="button ${s.view===view?'primary':''}" data-quad-view="${view}" aria-pressed="${s.view===view}">${L(label)}</button>`).join('');
    tools.querySelectorAll('button').forEach(button=>button.onclick=async()=>{try{await onView(button.dataset.quadView,p,reports.get(p));if(active===p){s.view=button.dataset.quadView;paintTools(p,s);}}catch(e){toast(String(e.message||e));}});
  }
  async function loadReport(p,saved=true,expected=null){
    if(!p.quality_report)return;
    const token=++sequence,context=getContext(p);if(!context.key)return;
    try{const value=await onReport(p,context);if(token!==sequence||!getContext(p).key)return;
      const record={...value,report:value.report,fingerprint:expected||quadFingerprint(context.doc,context.key),saved};reports.set(p,record);if(active===p)render();
      if(!saved&&active===p&&value.report.valid===true){try{await onView('mesh',p,record);if(active===p){state(p).view='mesh';paintTools(p,state(p));}}catch(e){toast(String(e.message||e));}}
      return value;
    }catch(e){if(active===p)toast(t('Could not load quality report: ')+String(e.message||e));}
  }
  return {show,hide,refresh:()=>active&&render(),loadReport,getReport:p=>reports.get(p)};
}
