import {isOpacity} from './object-opacity.js';
import {PointCloudLayer} from './point-cloud-layer.js';
import {validatePointMapping} from './csv-points.mjs';
import {csvPathKey} from './csv-references.mjs';
import {createFullDetailMemoryGuard} from './full-detail-memory.mjs';
import {colourStops} from './field-data.js';
const $=id=>document.getElementById(id),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const name=p=>String(p).split(/[\\/]/).pop(),fmt=n=>Number.isFinite(n)?String(Number(n.toPrecision(8))):'—',label=s=>s.replaceAll('_',' ').replace(/^./,c=>c.toUpperCase());
export function validatePointReferences(refs,otherIds=[]){
 if(!Array.isArray(refs)||refs.length>16)throw Error('Invalid point-cloud file list.');const ids=new Set(otherIds);
 for(const r of refs){
  if(!r||!/^points-[a-z0-9-]+$/.test(r.id)||ids.has(r.id)||typeof r.path!=='string'||!r.path.trim()||!Array.isArray(r.columns)||r.columns.length<3||r.columns.length>1024||r.columns.some(n=>typeof n!=='string'))throw Error('Invalid point-cloud reference.');
  validatePointMapping(r.config,r.columns.length);ids.add(r.id);
  const s=r.style;if(s&&(!['viridis','diverging'].includes(s.map)||!Number.isFinite(s.size)||s.size<1||s.size>12||!Array.isArray(s.range)||s.range.length!==2||!s.range.every(Number.isFinite)||s.range[0]>s.range[1]||(s.opacity!==undefined&&!isOpacity(s.opacity))||typeof s.visible!=='boolean'||typeof s.lock!=='boolean'))throw Error('Invalid point-cloud display settings.');
 }
}
export function createPointCloudInspector({invoke,getViewer,getReferences,getCsvReferences=()=>[],getWorkflowPath=()=>null,addReference,removeReference,onSelect,onChange,onReferenceChanged,showModal,closeModal,toast,ready=async()=>{},pauseMemory}){
 const entries=new Map();let active='',epoch=0,opening=false,probeEnabled=true;
 const selected=()=>entries.get(active),viewer=()=>getViewer();
 function attachViewer(){
  const v=viewer();if(!v)return;
  v.pickPointCloud=event=>{const e=selected();if(!e?.layer||!probeEnabled||e.loading)return false;const probe=e.layer.pick(event);if(probe)e.layer.showProbe(probe,e.ref.config.scalar<0?null:label(e.ref.columns[e.ref.config.scalar]));return true;};
  v.onBeforePointCloudRender=()=>{for(const e of entries.values())e.layer?.prepare();};
  v.onPointCloudRender=()=>{for(const e of entries.values())e.layer?.positionLabel();};
  if(!$('point-cloud-legend')){const host=document.createElement('div');host.id='point-cloud-legend';host.className='field-legend point-cloud-legend';host.hidden=true;$('viewport').append(host);}
 }
 function paintLegend(){const host=$('point-cloud-legend'),e=selected();if(!host)return;host.hidden=!e?.layer||!e.ref.style.visible||e.ref.config.scalar<0;if(host.hidden)return;if($('field-legend'))$('field-legend').hidden=true;const s=e.ref.style;host.innerHTML=`<strong translate="no">${esc(label(e.ref.columns[e.ref.config.scalar]))}</strong><span>${esc(e.ref.units||'Units unspecified')}</span><div class="field-legend-scale"><div style="background:linear-gradient(to top,${colourStops[s.map].join(',')})"></div><div><span>${fmt(s.range[1])}</span><span>${fmt(s.range[0])}</span></div></div>${e.data.missing?'<small>Missing values: gray</small>':''}`;}
 function refresh(){paintLegend();onChange();}
 async function source(path,file=null){
  if(file)return {file,size:file.size};if(!invoke)throw Error('Reattach this CSV file to view it in the browser.');
  const resolved=await invoke('resolve_geometry',{path,workflowPath:getWorkflowPath()});return {url:window.__TAURI__.core.convertFileSrc(resolved.path),size:resolved.size};
 }
 async function runWorker(input,message,signal,progress=()=>{},guard=null){
  return new Promise((resolve,reject)=>{
   const worker=new Worker(new URL('./csv-point-worker.js',import.meta.url),{type:'module'});let done=false;
   const finish=(error,result)=>{if(done)return;done=true;signal?.removeEventListener('abort',abort);worker.terminate();error?reject(error):resolve(result);};
   const abort=()=>finish(new DOMException('CSV loading cancelled','AbortError'));
   signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted){abort();return;}
   worker.onerror=e=>finish(Error(e.message||'CSV reading failed.'));
   worker.onmessage=async({data})=>{if(done)return;try{
    if(data.type==='error')throw Error(data.message);
    if(data.type==='metadata'||data.type==='done'){finish(null,data);return;}
    if(data.type==='progress'){progress(data);if(guard)await guard.check({currentBytes:message.config.limit*52});if(!done)worker.postMessage({type:'accepted'});}
   }catch(error){finish(error);}};
   worker.postMessage({...input,...message});
  });
 }
 async function importSource(path,file=null,reference=null){
  if(opening||[...entries.values()].some(e=>e.loading)){toast('A CSV file is already opening.');return;}opening=true;const requestEpoch=epoch,controller=new AbortController();
  try{
   await ready();if(epoch!==requestEpoch)return;attachViewer();const input=await source(path,file);if(epoch!==requestEpoch)return;
   if(reference){await load(reference,input,file);return;}
   const metadata=await runWorker(input,{type:'inspect'},controller.signal);if(epoch!==requestEpoch)return;
   const ref={id:'points-'+crypto.randomUUID(),path,columns:metadata.names,config:{delimiter:metadata.delimiter,header:metadata.header,axes:metadata.axes,scalar:metadata.scalar,limit:250000},units:'Units unspecified'};
   function mappingDialog(){
    showModal(`<div class="modal-head"><div><h2>Import point cloud</h2><p translate="no">${esc(name(path))}</p></div><button class="icon-button" data-close aria-label="Close">×</button></div><div class="modal-body point-import"><p>Choose the coordinate columns. Original CSV samples are displayed without interpolation.</p><div class="point-import-format"><label>Delimiter<select id="csv-delimiter"><option value="," ${ref.config.delimiter===','?'selected':''}>Comma</option><option value=";" ${ref.config.delimiter===';'?'selected':''}>Semicolon</option><option value="tab" ${ref.config.delimiter==='\t'?'selected':''}>Tab</option></select></label><label><input type="checkbox" id="csv-header" ${ref.config.header?'checked':''}> First row contains headers</label></div><div class="point-coordinate-grid">${['X','Y','Z'].map((axis,i)=>`<label>${axis}<select id="csv-axis-${i}">${ref.columns.map((c,j)=>`<option value="${j}" ${ref.config.axes[i]===j?'selected':''}>${esc(c)}</option>`).join('')}</select></label>`).join('')}</div><label>Color by<select id="csv-color"><option value="-1">Solid color</option>${ref.columns.map((c,j)=>`<option value="${j}" ${ref.config.scalar===j?'selected':''}>${esc(c)}</option>`).join('')}</select></label><label>Display limit<select id="csv-limit"><option value="100000">100,000 points</option><option value="250000" selected>250,000 points</option><option value="1000000">1,000,000 points</option></select></label><p class="field-help">Larger files use a representative point sample. All rows are scanned for coordinate validity and the selected field range.</p><p id="csv-import-error" role="alert"></p></div><div class="modal-foot"><button class="button" data-close>Cancel</button><button class="button primary" id="csv-import-confirm">Import and show</button></div>`);
    const reparse=async()=>{try{const delimiter=$('csv-delimiter').value==='tab'?'\t':$('csv-delimiter').value,header=$('csv-header').checked;const next=await runWorker(input,{type:'inspect',format:{delimiter,header}},controller.signal);if(epoch!==requestEpoch||!$('csv-import-confirm'))return;ref.columns=next.names;ref.config={...ref.config,delimiter,header,axes:next.axes,scalar:next.scalar};mappingDialog();}catch(error){if($('csv-import-error'))$('csv-import-error').textContent=error.message;}};
    $('csv-delimiter').onchange=reparse;$('csv-header').onchange=reparse;
    $('csv-import-confirm').onclick=async()=>{
     ref.config.axes=[0,1,2].map(i=>Number($(`csv-axis-${i}`).value));ref.config.scalar=Number($('csv-color').value);ref.config.limit=Number($('csv-limit').value);
     try{validatePointMapping(ref.config,ref.columns.length);}catch(error){$('csv-import-error').textContent=error.message;return;}
     closeModal();await load(ref,input,file);
    };
   }mappingDialog();
  }catch(error){if(error.name!=='AbortError'&&epoch===requestEpoch)toast(`Could not open CSV: ${error.message}`);}
  finally{opening=false;}
 }
 async function load(ref,input,file=null,nextConfig=null){
  const requestEpoch=epoch;let e=entries.get(ref.id);if(e?.loading)return;
  e ||= {ref,layer:null,data:null,file};entries.set(ref.id,e);active=ref.id;e.loading=true;e.error='';e.controller=new AbortController();const controller=e.controller,config=nextConfig||ref.config;
  onSelect(ref.id);refresh();const progress=$('preview-progress');progress?.classList.remove('hidden');$('preview-progress-text').textContent='Reading CSV points…';
  const guard=invoke?createFullDetailMemoryGuard({invoke,signal:controller.signal,current:()=>epoch===requestEpoch,pause:assessment=>pauseMemory(assessment,controller.signal)}):null;
  try{
   if(guard)await guard.check({nextBytes:config.limit*100,force:true});
   const data=await runWorker(input,{type:'load',config,columns:ref.columns.length},controller.signal,p=>{const bar=$('preview-progress-bar');bar.max=p.total||1;bar.value=p.loaded;$('preview-progress-text').textContent=`Reading CSV · ${p.valid.toLocaleString()} valid points`;},guard);
   if(epoch!==requestEpoch||controller.signal.aborted)return;
   if(guard)await guard.check({currentBytes:config.limit*52,nextBytes:data.positions.byteLength*2,force:true});
   const changed=ref.config.scalar!==config.scalar;
   const {meshOpacity:legacyMeshOpacity,...savedStyle}=ref.style||{};
   const style={map:'viridis',size:3,range:data.range,lock:true,opacity:1,visible:true,...savedStyle,solid:config.scalar<0};
   if(changed||!style.lock)style.range=data.range;
   const layer=new PointCloudLayer(viewer(),ref.id,data,style),previous=e.layer;e.layer=layer;e.data=data;previous?.dispose();
   ref.config=config;ref.style=style;e.input=input;e.file=file||e.file;if(!getReferences().some(r=>r.id===ref.id))addReference(ref);else onReferenceChanged();
   if(!previous)viewer().fit();$('viewport-empty').classList.add('hidden');$('mesh-info').textContent=`${data.shown.toLocaleString()} of ${data.total.toLocaleString()} points · ${data.shown<data.total?'Sampled preview':'All points shown'}${data.invalid?' · '+data.invalid.toLocaleString()+' invalid rows skipped':''}`;
  }catch(error){if(error.name!=='AbortError'&&epoch===requestEpoch){e.error=error.message;toast(`Could not load point cloud: ${error.message}`);}}
  finally{if(epoch===requestEpoch){e.loading=false;progress?.classList.add('hidden');refresh();}}
 }
 async function browse(){
  if(invoke){try{const path=await invoke('choose_supporting_file');if(path){if(!/\.(csv|tsv)$/i.test(path)){toast('Choose a CSV or TSV point file.');return;}await importSource(path);}}catch(error){toast(error.message);}return;}
  const input=document.createElement('input');input.type='file';input.accept='.csv,.tsv';input.onchange=()=>{const file=input.files[0];if(file)importSource(file.name,file);};input.click();
 }
 async function select(id){active=id;const e=entries.get(id);onSelect(id);attachViewer();refresh();if(!e){const ref=getReferences().find(r=>r.id===id);if(ref)await importSource(ref.path,null,ref);}else if(e.layer)viewer().fit();}
 function treeHtml(){
  const saved=new Set(getReferences().map(ref=>csvPathKey(ref.path)));
  const discovered=getCsvReferences().filter(path=>!saved.has(csvPathKey(path)));
  return `<div class="tree-group point-tree"><div class="project-group-heading"><span class="tree-label">Point clouds</span><button class="text-button" id="add-point-cloud" aria-label="Add CSV point cloud">+ Add</button></div>${getReferences().map(ref=>{const e=entries.get(ref.id);return `<button class="tree-item project-file ${active===ref.id?'point-selected':''}" data-point-cloud="${esc(ref.id)}" title="${esc(ref.path)}"><span class="project-file-text"><strong translate="no">${esc(name(ref.path))}</strong><small>${e?.loading?'Loading…':e?.data?`${e.data.shown.toLocaleString()} of ${e.data.total.toLocaleString()} points · ${ref.style.visible?'Shown':'Hidden'}`:e?.error?'Could not load':'Open to view points'}</small></span></button>`;}).join('')}${discovered.map(path=>`<button class="tree-item project-file" data-point-reference="${esc(path)}" title="${esc(path)}"><span class="project-file-text"><strong translate="no">${esc(name(path))}</strong><small>Referenced CSV · open to view points</small></span></button>`).join('')}</div>`;}
 function bindTree(){$('add-point-cloud').onclick=browse;document.querySelectorAll('[data-point-cloud]').forEach(b=>b.onclick=()=>select(b.dataset.pointCloud));document.querySelectorAll('[data-point-reference]').forEach(b=>b.onclick=()=>importSource(b.dataset.pointReference));}
 function renderProperties(id){
  active=id;const e=entries.get(id),ref=e?.ref||getReferences().find(r=>r.id===id);$('properties-title').textContent='Point cloud';$('properties-subtitle').textContent=name(ref?.path||'CSV file');const host=$('properties-content');
  if(!e?.layer||e.loading){host.innerHTML=`<div class="point-inspector"><p role="status">${esc(e?.loading?'Reading CSV points…':e?.error||'Open the CSV from the Point clouds tree.')}</p>${e?.loading?'<button class="button" id="cancel-csv-load">Cancel loading</button>':''}</div>`;if($('cancel-csv-load'))$('cancel-csv-load').onclick=()=>e.controller.abort();return;}
  const s=ref.style;
  host.innerHTML=`<div class="point-inspector"><section><label for="point-color">Color by</label><select id="point-color"><option value="-1">Solid color</option>${ref.columns.map((c,i)=>`<option value="${i}" ${ref.config.scalar===i?'selected':''}>${esc(label(c))}</option>`).join('')}</select><label for="point-map">Color map</label><select id="point-map"><option value="viridis" ${s.map==='viridis'?'selected':''}>Viridis</option><option value="diverging" ${s.map==='diverging'?'selected':''}>Blue–white–red</option></select><label for="point-size">Point size</label><div class="point-slider"><input id="point-size" type="range" min="1" max="12" step="1" value="${s.size}"><output id="point-size-value">${s.size} px</output></div><div class="point-range"><label>Minimum<input id="point-minimum" type="number" step="any" value="${s.range[0]}"></label><label>Maximum<input id="point-maximum" type="number" step="any" value="${s.range[1]}"></label></div><label class="point-check"><input id="point-lock" type="checkbox" ${s.lock?'checked':''}> Lock color range</label><button class="text-button" id="point-reset-range">Use data range</button></section><section><label for="point-opacity">Point opacity</label><div class="point-slider"><input id="point-opacity" type="range" min="0" max="100" value="${Math.round(s.opacity*100)}"><output id="point-opacity-value">${Math.round(s.opacity*100)}%</output></div><label class="point-check"><input id="point-visible" type="checkbox" ${s.visible?'checked':''}> Show points</label><button class="button ${probeEnabled?'primary':''}" id="point-probe" aria-pressed="${probeEnabled}">Inspect a point</button><p class="field-help">Click a point to see its original coordinates and value.</p></section><section><label for="point-limit">Display limit</label><select id="point-limit">${[100000,250000,1000000].map(n=>`<option value="${n}" ${ref.config.limit===n?'selected':''}>${n.toLocaleString()} points</option>`).join('')}</select><p class="point-status">${e.data.shown.toLocaleString()} of ${e.data.total.toLocaleString()} points<br>${e.data.shown<e.data.total?'Sampled preview':'All points shown'}${e.data.invalid?` · ${e.data.invalid.toLocaleString()} invalid rows skipped`:''}</p><button class="button" id="remove-point-cloud">Remove from project</button></section></div>`;
  const update=()=>{s.solid=ref.config.scalar<0;e.layer.setStyle(s);paintLegend();onReferenceChanged();};
  $('point-color').value=ref.config.scalar;$('point-color').onchange=()=>load(ref,e.input,e.file,{...ref.config,scalar:Number($('point-color').value)});
  $('point-map').onchange=()=>{s.map=$('point-map').value;update();};
  $('point-size').oninput=()=>{s.size=Number($('point-size').value);$('point-size-value').textContent=s.size+' px';update();};
  const range=()=>{const a=Number($('point-minimum').value),b=Number($('point-maximum').value);if(!Number.isFinite(a)||!Number.isFinite(b)||a>b){toast('Color range needs finite minimum ≤ maximum.');return;}s.range=[a,b];update();};$('point-minimum').onchange=range;$('point-maximum').onchange=range;
  $('point-lock').onchange=()=>{s.lock=$('point-lock').checked;onReferenceChanged();};$('point-reset-range').onclick=()=>{s.range=e.data.range;update();renderProperties(id);};
  $('point-opacity').oninput=()=>{s.opacity=Number($('point-opacity').value)/100;$('point-opacity-value').textContent=Math.round(s.opacity*100)+'%';update();};
  $('point-visible').onchange=()=>{s.visible=$('point-visible').checked;update();onChange();};$('point-probe').onclick=()=>{probeEnabled=!probeEnabled;if(probeEnabled)viewer().setMeasureMode('off');renderProperties(id);};
  $('point-limit').onchange=()=>load(ref,e.input,e.file,{...ref.config,limit:Number($('point-limit').value)});
  $('remove-point-cloud').onclick=()=>{e.controller?.abort();e.layer.dispose();entries.delete(id);removeReference(id);active='';refresh();};
 }
 function reset(){epoch++;if($('csv-import-confirm'))closeModal();for(const e of entries.values()){e.controller?.abort();e.layer?.dispose();}entries.clear();active='';paintLegend();}
 function cancel(){for(const e of entries.values())if(e.loading)e.controller?.abort();}
 function setActive(value){active=value||'';paintLegend();}
 return {browse,importSource,select,treeHtml,bindTree,renderProperties,attachViewer,reset,cancel,setActive};
}
