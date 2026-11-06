import {isosurfaceGeometry} from './field-isosurface.js';
import {isOpacity} from './object-opacity.js';
import {decodeFieldSlice,defaultFieldRange,colourStops,normalizedValues} from './field-data.js';
import {FieldLayer} from './field-layer.js';

const $=id=>document.getElementById(id),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>Number.isFinite(n)?Number(n.toPrecision(9)).toString():'—',filename=p=>p.split(/[\\/]/).pop();
const section=(title,body)=>`<section class="property-section field-section"><h3>${title}</h3>${body}</section>`;

export function createFieldInspector({invoke,isTemporary=()=>false,isDiscarded=()=>false,getViewer,getReferences,addReference,removeReference,onSelect,onChange,onReferenceChanged,toast}) {
  const entries=new Map(),errors=new Map();let active='',epoch=0,opening=false,generationSuspended=false;const compactHosts=new Map();
  const selected=()=>entries.get(active);
  const fieldFor=e=>e.info.fields.find(f=>f.id===e.ref.fieldId);
  const blockFor=e=>fieldFor(e)?.blocks.find(b=>b.id===e.ref.blockId);
  function refresh(){onChange();paintToolbar();paintLegend();updateCompact();}
  function initialise(e,fieldId,blockId) {
    const field=e.info.fields.find(f=>f.id===fieldId)||e.info.fields.find(f=>f.id!=='lattice'&&f.blocks.some(b=>b.supported))||e.info.fields[0];
    const block=field.blocks.find(b=>b.id===blockId)||field.blocks[0];
    const changed=e.ref.fieldId!==field.id,referenceChanged=changed||e.ref.blockId!==block.id;e.ref.fieldId=field.id;e.ref.blockId=block.id;if(referenceChanged&&!e.temporary&&entries.has(e.ref.id))onReferenceChanged();
    if(!e.style||changed)e.style={range:defaultFieldRange(field),map:'viridis',opacity:.85,visible:true,lock:true,quality:256,probe:false};
    const opacity=e.ref.opacityByField?.[field.id];e.style.opacity=isOpacity(opacity)?opacity:.85;
    e.mode='slice';e.isovalue=0;e.surfaceQuality=32;e.volumeCache=null;e.axis=2;e.position=block.bounds?(block.bounds[2][0]+block.bounds[2][1])/2:0;e.probe=null;
  }
  function attachViewer() {
    const viewer=getViewer();if(!viewer)return;
    let button=$('field-probe-tool');
    if(!button){button=document.createElement('button');button.id='field-probe-tool';button.className='button subtle field-probe-tool';button.textContent='Probe';button.title='Click a field slice to inspect a stored grid value';$('viewer-toolbar').insertBefore(button,$('viewer-toolbar').lastElementChild);}
    button.onclick=()=>{const e=selected();if(!e||!e.layer||e.loading)return;e.style.probe=!e.style.probe;if(e.style.probe)viewer.setMeasureMode('off');paintToolbar();};
    viewer.pickField=event=>{const e=selected();if(!e?.style.probe||!e.layer||e.loading||!e.style.visible||e.style.opacity===0)return false;const point=e.layer.pick(event);if(point)probe(e,point);return true;};
    viewer.onFieldRender=()=>{for(const e of entries.values())e.layer?.positionLabel();};
    viewer.onMeasureModeChange=mode=>{if(mode!=='off'){const e=selected();if(e)e.style.probe=false;paintToolbar();}};
    if(!$('field-legend')){const legend=document.createElement('div');legend.id='field-legend';legend.className='field-legend';legend.hidden=true;$('viewport').append(legend);}
    paintToolbar();
  }
  function paintToolbar(){const button=$('field-probe-tool'),e=selected();if(button){button.disabled=!e?.layer||e.loading||!e.style.visible||e.mode==='surface';button.classList.toggle('primary',!!e?.style.probe);button.setAttribute('aria-pressed',String(!!e?.style.probe));}}
  function paintLegend(){const host=$('field-legend'),e=selected();if(!host)return;host.hidden=!e?.layer||!e.style.visible||e.loading;if(host.hidden)return;const field=fieldFor(e);if(e.mode==='surface'){host.innerHTML=`<strong translate="no">${esc(field.id)}</strong><span>Isovalue ${fmt(e.isovalue)}</span><small>Sampled inspection surface</small>`;return;}host.innerHTML=`<strong translate="no">${esc(field.id)}</strong><span>${esc(field.valueUnits||'Units unspecified')}</span><div class="field-legend-scale"><div style="background:linear-gradient(to top,${colourStops[e.style.map].join(',')})"></div><div><span>${fmt(e.style.range[1])}</span><span>${fmt(e.style.range[0])}</span></div></div><small>Nonfinite values: gaps</small>`;}
  async function load(path,reference=null,wantedField=null,options={}) {
    if(!invoke){toast('Field reading is available in the desktop app.');return;}
    if(generationSuspended){toast('Open the field after generation finishes.');return;}
    if(opening){toast('A field file is already opening.');return;}
    const currentEpoch=epoch;opening=true;
    try {
      if(isDiscarded(path))throw Error('This preview was cleaned. Generate it again to inspect values.');
      const temporary=isTemporary(path);
      const existing=reference||(temporary?compactEntry(path)?.ref:getReferences().find(f=>normalPath(f.path)===normalPath(path)));
      if(existing&&entries.has(existing.id)){
        if(options.strictField&&wantedField&&!entries.get(existing.id).info.fields.some(field=>field.id===wantedField))throw Error(`Field "${wantedField}" is not stored in this HDF5 file.`);
        if(options.select===false){active=existing.id;const e=entries.get(active);if(wantedField&&wantedField!==e.ref.fieldId){initialise(e,wantedField);await readSlice(e,true);}else refresh();}else await select(existing.id,wantedField);return describe(path,wantedField);
      }
      const info=await invoke('open_field_file',{path});
      if(epoch!==currentEpoch){await invoke('close_field_file',{handle:info.handle});return;}
      if(options.strictField&&wantedField&&!info.fields.some(field=>field.id===wantedField)){
        await invoke('close_field_file',{handle:info.handle});throw Error(`Field "${wantedField}" is not stored in this HDF5 file.`);
      }
      const ref=existing||{id:'field-'+crypto.randomUUID(),path:info.path};
      const e={ref,info,temporary,sequence:0,loading:false,error:'',timer:null,layer:null};
      initialise(e,wantedField||ref.fieldId,ref.blockId);if(options.distance)e.style.map='diverging';entries.set(ref.id,e);errors.delete(ref.id);if(!existing&&!temporary)addReference(ref);
      attachViewer();active=ref.id;if(options.select!==false)onSelect(active);await readSlice(e,true);
      if(options.strictField&&e.error)throw Error(e.error);
      return describe(info.path,wantedField);
    } catch(error){if(epoch===currentEpoch){if(reference)errors.set(reference.id,String(error));toast(`Could not open field: ${error.message||error}`);refresh();}if(options.strictField)throw error;return null;}
    finally{opening=false;}
  }
  async function select(id,fieldId=null) {
    const ref=entries.get(id)?.ref||getReferences().find(r=>r.id===id);if(!ref)return;
    const e=entries.get(id);if(!e){await load(ref.path,ref,fieldId);return;}
    active=id;if(fieldId&&fieldId!==e.ref.fieldId){initialise(e,fieldId);onSelect(id);await readSlice(e,true);}else if(e.mode==='surface'){e.mode='slice';onSelect(id);await readSlice(e,true);}else{onSelect(id);refresh();if(e.layer)getViewer()?.fit();}
  }
  async function readSlice(e,fit=false) {
    if(e.mode==='surface')return readSurface(e,fit);
    clearTimeout(e.timer);const block=blockFor(e);
    if(!block?.supported){e.error=block?.message||'Unsupported field block.';e.layer?.dispose();e.layer=null;refresh();return;}
    const requestId=++e.sequence,currentEpoch=epoch;e.loading=true;e.error='';e.probe=null;e.layer?.dispose();e.layer=null;refresh();
    try {
      const raw=await invoke('read_field_slice',{handle:e.info.handle,request:{fieldId:e.ref.fieldId,blockId:e.ref.blockId,axis:e.axis,position:e.position,maxEdge:e.style.quality,requestId}});
      if(currentEpoch!==epoch||e.sequence!==requestId)return;
      const slice=decodeFieldSlice(raw);e.position=slice.position;e.loading=false;
      if(!e.style.lock){let lo=Infinity,hi=-Infinity;for(const v of slice.values)if(Number.isFinite(v)){lo=Math.min(lo,v);hi=Math.max(hi,v);}e.style.range=lo===Infinity?[0,1]:[lo,hi];}
      const viewer=getViewer();if(!viewer)throw Error('The 3D viewer is unavailable.');
      e.layer ||= new FieldLayer(viewer,e.ref.id);e.layer.onSlicePosition=value=>{e.position=value;schedule(e);updateCompact();};e.layer.setSlice(slice,block,e.style);e.slice=slice;
      $('viewport-empty').classList.add('hidden');if(fit)viewer.fit();
      $('mesh-info').textContent=`${e.ref.fieldId} · Block ${e.ref.blockId} · ${'XYZ'[e.axis]} = ${fmt(e.position)} · ${slice.sampled?'Sampled preview':'Original grid slice'}`;
      refresh();
    } catch(error){if(currentEpoch===epoch&&e.sequence===requestId){e.error=String(error.message||error);e.loading=false;refresh();}}
  }
  async function readSurface(e,fit=false){
    clearTimeout(e.timer);const block=blockFor(e);if(!block?.supported||!block.bounds){e.error='This block cannot be inspected as an isosurface.';refresh();return;}
    const sequence=++e.sequence,currentEpoch=epoch,quality=e.surfaceQuality||32;e.loading=true;e.error='';e.probe=null;e.layer?.dispose();e.layer=null;refresh();
    try{
      let slices=e.volumeCache?.quality===quality?e.volumeCache.slices:null;
      if(!slices){slices=[];const count=Math.min(quality,block.shape[2]),bounds=block.bounds[2];
        for(let i=0;i<count;i++){
          if(epoch!==currentEpoch||e.sequence!==sequence)return;
          const raw=await invoke('read_field_slice',{handle:e.info.handle,request:{fieldId:e.ref.fieldId,blockId:e.ref.blockId,axis:2,position:bounds[0]+(bounds[1]-bounds[0])*i/(count-1),maxEdge:quality,requestId:sequence}});
          if(epoch!==currentEpoch||e.sequence!==sequence)return;
          const slice=decodeFieldSlice(raw);if(!slices.length||slice.position>slices.at(-1).position)slices.push(slice);e.surfaceProgress=Math.round((i+1)/count*100);updateCompact();
        }
        e.volumeCache={quality,slices};
      }
      const surface=isosurfaceGeometry(slices,e.isovalue),viewer=getViewer();if(!viewer)throw Error('The 3D viewer is unavailable.');
      if(epoch!==currentEpoch||e.sequence!==sequence)return;
      e.loading=false;e.layer=new FieldLayer(viewer,e.ref.id);e.layer.setSurface(surface,e.style);e.surfaceTriangles=surface.positions.length/9;
      $('viewport-empty').classList.add('hidden');if(fit&&e.surfaceTriangles)viewer.fit();$('mesh-info').textContent=`${e.ref.fieldId} · Isovalue ${fmt(e.isovalue)} · Sampled inspection surface`;refresh();
    }catch(error){if(epoch===currentEpoch&&e.sequence===sequence){e.loading=false;e.error=String(error.message||error);refresh();}}
  }
  function schedule(e) {
    clearTimeout(e.timer);e.probe=null;e.loading=true;const requestId=++e.sequence;
    invoke('cancel_field_request',{handle:e.info.handle,requestId}).catch(()=>{});paintToolbar();paintLegend();
    updateCompact();const status=$('field-status');if(status)status.textContent='Preparing slice…';
    e.timer=setTimeout(()=>readSlice(e),140);
  }
  async function probe(e,point) {
    const sequence=e.sequence,currentEpoch=epoch,block=blockFor(e);
    if(block.bounds)point=point.map((v,i)=>Math.max(block.bounds[i][0],Math.min(block.bounds[i][1],v)));
    e.probeLoading=true;refresh();
    try{const value=await invoke('probe_field',{handle:e.info.handle,fieldId:e.ref.fieldId,blockId:e.ref.blockId,point});if(epoch!==currentEpoch||sequence!==e.sequence)return;e.probe=value;e.layer.showProbe(value,e.ref.fieldId);}
    catch(error){if(epoch===currentEpoch&&sequence===e.sequence)toast(`Could not probe field: ${error.message||error}`);}
    finally{if(epoch===currentEpoch&&sequence===e.sequence){e.probeLoading=false;refresh();}}
  }
  function treeHtml() {
    const refs=[...getReferences(),...[...entries.values()].filter(e=>e.temporary).map(e=>e.ref)];
    return `<div class="tree-group"><div class="project-group-heading"><span class="tree-label">Fields</span><button class="text-button" id="add-field-file" aria-label="Add HDF5 field">＋ Add</button></div>`+(refs.map(ref=>{
      const e=entries.get(ref.id);return `<button class="tree-item project-file" data-field-file="${esc(ref.id)}" title="${esc(ref.path)}"><span class="tree-icon">▤</span><span class="project-file-text"><strong translate="no">${esc(filename(ref.path))}</strong><small>${errors.has(ref.id)?'Could not load':e?(e.temporary?'Temporary preview':'HDF5 field snapshot'):generationSuspended?'Closed for generation':'Open to inspect'}</small></span></button>`+(e?e.info.fields.map(f=>`<button class="tree-item field-tree-child ${active===ref.id&&e.ref.fieldId===f.id?'field-active':''}" data-field-file="${esc(ref.id)}" data-field-id="${esc(f.id)}"><span class="tree-icon">≈</span>${esc(f.id)}</button>`).join(''):'');
    }).join('')||'<p class="project-empty">Open an exported .h5 file to inspect grid values.</p>')+'</div>';
  }
  async function browse(){
    if(!invoke){toast('Field reading is available in the desktop app.');return;}
    try{
      const path=await invoke('choose_field_file');if(!path)return;
      if(!/\.h(df)?5$/i.test(path)){toast('Choose an HDF5 field file (.h5 or .hdf5).');return;}
      await load(path);
    }catch(error){toast(`Could not open field: ${error.message||error}`);}
  }
  function bindTree(){const add=$('add-field-file');if(add)add.onclick=browse;document.querySelectorAll('[data-field-file]').forEach(el=>el.onclick=()=>select(el.dataset.fieldFile,el.dataset.fieldId));}
  function renderProperties(id) {
    const e=entries.get(id);$('properties-title').textContent='Field inspector';$('properties-subtitle').translate=false;$('properties-subtitle').textContent=filename(e?.ref.path||getReferences().find(r=>r.id===id)?.path||'Field file');
    if(!e){$('properties-content').innerHTML=`<p class="field-help">${generationSuspended?'Field files are closed while Artisan generates. Open this field again after the run finishes.':'Open this field file from the Fields tree.'}</p>`;return;}
    const field=fieldFor(e),block=blockFor(e),bounds=block.bounds?.[e.axis]||[0,1],style=e.style,count=block.shape.reduce((a,b)=>a*BigInt(b),1n).toLocaleString();
    const probeHtml=e.probe?`<dl class="field-facts"><dt>Grid indices</dt><dd>(${e.probe.indices.join(', ')})</dd><dt>Grid coordinates</dt><dd>${e.probe.coordinates.map(fmt).join(', ')}</dd>${field.coordinateSpace!=='model'?`<dt>Model coordinates</dt><dd>${e.probe.modelCoordinates.map(fmt).join(', ')}</dd>`:''}</dl><div class="field-probe-value">${esc(e.probe.value===null?e.probe.kind:String(e.probe.value))}</div><p class="field-help">Stored grid value · ${esc(e.probe.dtype)} · ${esc(field.valueUnits||'units unspecified')}</p><button class="button" id="copy-field-value">Copy value</button>`:`<p class="field-help">${e.probeLoading?'Reading original value…':'Choose Probe and click the slice. Probes snap to the original grid.'}</p>`;
    $('properties-content').innerHTML=
      section('Field',`<label for="inspect-field">Field ID</label><select id="inspect-field">${e.info.fields.map(f=>`<option value="${esc(f.id)}" ${f.id===field.id?'selected':''}>${esc(f.id)}</option>`).join('')}</select>${field.blocks.length>1?`<label for="inspect-block">Partition block</label><select id="inspect-block">${field.blocks.map(b=>`<option value="${b.id}" ${b.id===block.id?'selected':''}>Block ${b.id}</option>`).join('')}</select><p class="field-help">One block at a time; exported padding is included.</p>`:''}<dl class="field-facts"><dt>Grid</dt><dd>${block.shape.join(' × ')}</dd><dt>Values</dt><dd>${count}</dd><dt>Precision</dt><dd>${esc(block.dtype)}</dd><dt>Coordinates</dt><dd>${esc(field.coordinateSpace)} · ${esc(field.coordinateUnits||'units unspecified')}</dd><dt>Value units</dt><dd>${esc(field.valueUnits||'unspecified')}</dd><dt>Saved range</dt><dd>${fmt(block.statistics.minimum)} to ${fmt(block.statistics.maximum)}</dd><dt>Nonfinite</dt><dd>${block.statistics.nanCount} NaN · ${block.statistics.infCount} infinity</dd></dl>`)+
      section('Slice',`<div class="field-axis-buttons">${[0,1,2].map(i=>`<button class="button ${e.axis===i?'primary':''}" data-field-axis="${i}" ${!block.supported?'disabled':''}>${'XYZ'[i]}</button>`).join('')}</div><label for="field-position">Position in grid coordinates</label><input id="field-position" type="number" step="any" min="${bounds[0]}" max="${bounds[1]}" value="${e.position}" ${!block.supported?'disabled':''}><input id="field-position-slider" aria-label="Slice position" type="range" min="${bounds[0]}" max="${bounds[1]}" step="any" value="${e.position}" ${!block.supported?'disabled':''}><p class="field-help">Position snaps to the nearest original grid plane.</p>`)+
      section('Colour',`<label for="field-colour">Colour map</label><select id="field-colour"><option value="viridis" ${style.map==='viridis'?'selected':''}>Viridis</option><option value="diverging" ${style.map==='diverging'?'selected':''}>Blue / white / red</option></select><div class="field-range"><label>Minimum<input id="field-range-min" type="number" step="any" value="${style.range[0]}"></label><label>Maximum<input id="field-range-max" type="number" step="any" value="${style.range[1]}"></label></div><label class="field-check"><input id="field-lock-range" type="checkbox" ${style.lock?'checked':''}> Lock colour range</label><button class="button subtle" id="field-auto-range">Use saved field range</button>`)+
      section('Display',`<label class="field-check"><input id="field-visible" type="checkbox" ${style.visible?'checked':''}> Show field</label><label for="field-opacity">Field opacity</label><input id="field-opacity" type="range" min="0" max="1" step=".01" value="${style.opacity}"><output id="field-opacity-value" for="field-opacity" translate="no">${Math.round(style.opacity*100)}%</output><label for="field-quality">Slice quality</label><select id="field-quality">${[[128,'Quick preview (up to 128 × 128)'],[256,'Preview (up to 256 × 256)'],[512,'Detailed slice (up to 512 × 512)']].map(([v,label])=>`<option value="${v}" ${style.quality===v?'selected':''}>${label}</option>`).join('')}</select><p class="field-help">Only the requested slice is read. Detailed slices may still be sampled on large grids.</p>`)+
      section('Probe',probeHtml)+`<p id="field-status" class="field-help" role="status">${esc(e.loading?'Loading slice…':e.error||`${e.slice?.sampled?'Sampled display':'Original grid slice'}; probes read original values.`)}</p><button class="button subtle" id="remove-field-file">Remove field file</button>`;
    const redraw=()=>{e.layer?.setStyle(style);paintToolbar();paintLegend();};
    $('inspect-field').onchange=event=>select(id,event.target.value);
    if($('inspect-block'))$('inspect-block').onchange=event=>{e.ref.blockId=Number(event.target.value);if(!e.temporary)onReferenceChanged();e.position=blockFor(e).bounds?.[e.axis]?.reduce((a,b)=>a+b,0)/2||0;readSlice(e,true);};
    document.querySelectorAll('[data-field-axis]').forEach(button=>button.onclick=()=>{e.axis=Number(button.dataset.fieldAxis);e.position=blockFor(e).bounds?.[e.axis]?.reduce((a,b)=>a+b,0)/2||0;readSlice(e);});
    $('field-position-slider').oninput=event=>{e.position=Number(event.target.value);$('field-position').value=event.target.value;schedule(e);};
    $('field-position').onchange=event=>{const value=Number(event.target.value);if(!event.target.value.trim()||!Number.isFinite(value)||value<bounds[0]||value>bounds[1]){toast('Enter a position within the selected block.');refresh();return;}e.position=value;readSlice(e);};
    $('field-quality').onchange=event=>{style.quality=Number(event.target.value);readSlice(e);};
    $('field-colour').onchange=event=>{style.map=event.target.value;redraw();};
    const rangeChanged=()=>{try{const lo=$('field-range-min').value,hi=$('field-range-max').value;if(!lo.trim()||!hi.trim())throw Error('Enter both colour bounds.');const range=[Number(lo),Number(hi)];normalizedValues([], ...range);style.range=range;style.lock=true;redraw();refresh();}catch(error){toast(error.message);refresh();}};
    $('field-range-min').onchange=$('field-range-max').onchange=rangeChanged;
    $('field-lock-range').onchange=event=>{style.lock=event.target.checked;if(!style.lock)readSlice(e);};
    $('field-auto-range').onclick=()=>{style.range=defaultFieldRange(field);style.lock=true;redraw();refresh();};
    $('field-visible').onchange=event=>{style.visible=event.target.checked;redraw();};
    $('field-opacity').oninput=event=>{style.opacity=Number(event.target.value);e.ref.opacityByField={...e.ref.opacityByField,[e.ref.fieldId]:style.opacity};$('field-opacity-value').textContent=Math.round(style.opacity*100)+'%';redraw();if(!e.temporary)onReferenceChanged();};
    if($('copy-field-value'))$('copy-field-value').onclick=async()=>{try{await navigator.clipboard.writeText(e.probe.value===null?e.probe.kind:String(e.probe.value));toast('Stored value copied.');}catch{toast('Select the value to copy it.');}};
    $('remove-field-file').onclick=()=>remove(id);
  }
  function remove(id){const e=entries.get(id);if(e){clearTimeout(e.timer);e.layer?.dispose();invoke('close_field_file',{handle:e.info.handle}).catch(()=>{});entries.delete(id);}if(!e?.temporary)removeReference(id);if(active===id)active='';refresh();}
  async function closeTemporary(){
    epoch++;
    const closing=[];
    for(const [id,e] of entries){
      if(!e.temporary)continue;
      clearTimeout(e.timer);e.layer?.dispose();entries.delete(id);
      if(active===id)active='';
      closing.push(invoke('close_field_file',{handle:e.info.handle}));
    }
    await Promise.all(closing);
    refresh();
  }
  function reset(){epoch++;active='';for(const e of entries.values()){clearTimeout(e.timer);e.layer?.dispose();invoke?.('close_field_file',{handle:e.info.handle}).catch(()=>{});}entries.clear();errors.clear();paintToolbar();paintLegend();}
  function releaseForGeneration(){
    generationSuspended=true;
    const hadFields=entries.size>0||opening;
    reset();
    if(hadFields){
      const viewer=getViewer();
      if(!viewer?.layers.size)$('viewport-empty').classList.remove('hidden');
      $('mesh-info').textContent=viewer?.layers.size?'Field files closed · Meshes remain loaded':'Field files closed for generation';
    }
    refresh();
  }
  function resumeAfterGeneration(){generationSuspended=false;refresh();}
  function setVisible(visible){for(const e of entries.values()){if(e.style){e.style.visible=visible&&e===selected();e.layer?.setStyle(e.style);}}paintToolbar();paintLegend();}
  const normalPath=value=>String(value||'').replaceAll('\\','/').replace(/^\/\/\?\//,'').toLowerCase();
  function compactEntry(path,fieldId){return [...entries.values()].find(e=>(normalPath(e.info.path)===normalPath(path)||normalPath(e.ref.path)===normalPath(path))&&(!fieldId||e.info.fields.some(f=>f.id===fieldId)));}
  function renderCompact(host,path,fieldId,options={}){
    if(!host)return;for(const old of compactHosts.keys())if(!old.isConnected)compactHosts.delete(old);
    const record={path,fieldId,options,stale:false};compactHosts.set(host,record);
    const e=compactEntry(path,fieldId);
    if(!e){host.innerHTML='<p class="pm-help">Generate a preview to inspect real field values.</p>'+(path&&!isDiscarded(path)?'<button type="button" class="button" data-fi-reopen>Open saved preview</button>':'');const button=host.querySelector('[data-fi-reopen]');if(button)button.onclick=async()=>{button.disabled=true;try{await load(path,null,fieldId,{strictField:true,select:false,distance:options.distance});if(host.isConnected){renderCompact(host,path,fieldId,options);setCompactStale(host,record.stale);}}catch(error){toast(String(error.message||error));}finally{if(button.isConnected)button.disabled=false;}};return;}
    active=e.ref.id;if(fieldId&&e.ref.fieldId!==fieldId){initialise(e,fieldId);readSlice(e);}
    host.innerHTML=`<div class="gf-inspect-controls"><p class="pm-help" data-fi-state role="status"></p><div class="pm-tools" role="group" aria-label="Field display"><button type="button" class="button" data-fi-mode="slice">Slice</button><button type="button" class="button" data-fi-mode="surface">Isosurface</button></div>${fieldFor(e).blocks.length>1?`<label class="pm-label">Partition block<select data-fi-block>${fieldFor(e).blocks.map(b=>`<option value="${b.id}">Block ${b.id}</option>`).join('')}</select></label>`:''}<div data-fi-slice><div class="pm-tools" role="group" aria-label="Slice plane">${[0,1,2].map(i=>`<button type="button" class="button" data-fi-axis="${i}">${'XYZ'[i]}</button>`).join('')}</div><label class="pm-input"><span>Slice position</span><input type="number" step="any" data-fi-position aria-label="Slice position"></label><input type="range" step="any" data-fi-slider aria-label="Slice position slider"><p class="pm-help">Drag the slice handle; position snaps to the stored grid.</p><button type="button" class="button" data-fi-probe aria-pressed="false">Probe point</button></div><div data-fi-surface hidden><label class="pm-input"><span>Isovalue</span><input type="number" step="any" data-fi-isovalue aria-label="Isovalue" value="${e.isovalue??0}"></label><input type="range" step="any" data-fi-iso-slider aria-label="Isovalue slider"><label class="pm-label">Surface quality<select data-fi-quality><option value="32">Quick (up to 32³)</option><option value="64">Detailed (up to 64³)</option></select></label><p class="pm-help">Sampled inspection surface; exports use the original grid.</p></div><label class="pm-toggle"><input type="checkbox" data-fi-visible>Show field</label><label class="pm-toggle"><input type="checkbox" data-fi-source>Show source mesh</label><p class="pm-help" data-fi-probe-result translate="no"></p><button type="button" class="pm-link" data-fi-details>Full field inspector</button></div>`;
    const q=s=>host.querySelector(s),changePosition=value=>{const b=blockFor(e).bounds?.[e.axis];if(!String(value).trim()||!Number.isFinite(Number(value))||!b||Number(value)<b[0]||Number(value)>b[1]){toast('Enter a position within the selected block.');updateCompact();return;}e.position=Number(value);schedule(e);};
    host.querySelectorAll('[data-fi-mode]').forEach(b=>b.onclick=()=>{e.mode=b.dataset.fiMode;e.style.probe=false;e.surfaceProgress=0;schedule(e);updateCompact();});
    host.querySelectorAll('[data-fi-axis]').forEach(b=>b.onclick=()=>{e.axis=Number(b.dataset.fiAxis);const bounds=blockFor(e).bounds?.[e.axis];e.position=bounds?(bounds[0]+bounds[1])/2:0;schedule(e);updateCompact();});
    q('[data-fi-position]').onchange=event=>changePosition(event.target.value);q('[data-fi-slider]').oninput=event=>{q('[data-fi-position]').value=event.target.value;changePosition(event.target.value);};
    const iso=value=>{if(!String(value).trim()||!Number.isFinite(Number(value))){toast('Enter a finite isovalue.');return;}e.isovalue=Number(value);schedule(e);};
    q('[data-fi-isovalue]').onchange=event=>iso(event.target.value);q('[data-fi-iso-slider]').oninput=event=>{q('[data-fi-isovalue]').value=event.target.value;iso(event.target.value);};
    q('[data-fi-quality]').onchange=event=>{e.surfaceQuality=Number(event.target.value);schedule(e);};
    q('[data-fi-probe]').onclick=()=>{active=e.ref.id;e.style.probe=!e.style.probe;if(e.style.probe)getViewer()?.setMeasureMode('off');paintToolbar();updateCompact();};
    q('[data-fi-visible]').onchange=event=>{e.style.visible=event.target.checked;e.layer?.setStyle(e.style);paintLegend();updateCompact();};
    q('[data-fi-source]').onchange=event=>options.setSource?.(event.target.checked);
    q('[data-fi-details]').onclick=()=>select(e.ref.id,e.ref.fieldId);
    if(q('[data-fi-block]'))q('[data-fi-block]').onchange=event=>{e.ref.blockId=Number(event.target.value);e.volumeCache=null;if(!e.temporary)onReferenceChanged();const bounds=blockFor(e).bounds?.[e.axis];e.position=bounds?(bounds[0]+bounds[1])/2:0;schedule(e);};
    updateCompact();
  }
  function setCompactStale(host,stale){const r=compactHosts.get(host);if(r){r.stale=stale;updateCompact();}}
  function updateCompact(){for(const [host,r] of compactHosts){if(!host.isConnected){compactHosts.delete(host);continue;}const e=compactEntry(r.path,r.fieldId),q=s=>host.querySelector(s);if(!q('[data-fi-state]'))continue;
    const status=q('[data-fi-state]');if(!e){status.textContent='Preview closed · generate again to inspect values';host.querySelectorAll('button,input,select').forEach(el=>el.disabled=true);continue;}
    const block=blockFor(e),bounds=block.bounds?.[e.axis]||[0,1],range=defaultFieldRange(fieldFor(e)),supported=!!block.supported&&!generationSuspended;
    status.classList.toggle('gf-inspect-stale',r.stale);status.textContent=e.loading?(e.mode==='surface'?`Reading sampled volume… ${e.surfaceProgress||0}%`:'Loading slice…'):e.error||(!block.supported?block.message:r.stale?'Previous preview · settings have changed':e.mode==='surface'?`${e.surfaceTriangles||0} triangles · sampled inspection surface`:'Stored field preview');
    q('[data-fi-slice]').hidden=e.mode==='surface';q('[data-fi-surface]').hidden=e.mode!=='surface';
    host.querySelectorAll('[data-fi-mode]').forEach(b=>{b.disabled=!supported;b.setAttribute('aria-pressed',String(e.mode===b.dataset.fiMode));});
    host.querySelectorAll('[data-fi-axis]').forEach(b=>{b.disabled=!supported;b.setAttribute('aria-pressed',String(e.axis===Number(b.dataset.fiAxis)));});
    for(const selector of ['[data-fi-position]','[data-fi-slider]']){const el=q(selector);el.disabled=!supported;el.min=bounds[0];el.max=bounds[1];if(document.activeElement!==el)el.value=e.position;}
    for(const selector of ['[data-fi-isovalue]','[data-fi-iso-slider]']){const el=q(selector);el.disabled=!supported;if(selector.includes('slider')){el.min=Math.min(range[0],e.isovalue);el.max=Math.max(range[1],e.isovalue);}if(document.activeElement!==el)el.value=e.isovalue??0;}
    q('[data-fi-quality]').value=e.surfaceQuality||32;q('[data-fi-quality]').disabled=!supported;
    q('[data-fi-probe]').disabled=!supported||e.loading||!e.layer||e.mode==='surface';q('[data-fi-probe]').setAttribute('aria-pressed',String(!!e.style.probe));
    q('[data-fi-visible]').checked=e.style.visible;q('[data-fi-source]').checked=!!r.options.source?.();q('[data-fi-source]').disabled=r.options.sourceAvailable?!r.options.sourceAvailable():!r.options.source;
    q('[data-fi-probe-result]').textContent=e.probeLoading?'Reading original value…':e.probe?`Value ${e.probe.value??e.probe.kind} · XYZ ${e.probe.modelCoordinates.map(fmt).join(', ')} · stored grid value`:'';
    if(q('[data-fi-block]'))q('[data-fi-block]').value=e.ref.blockId;
  }}
  function describe(path,fieldId){
    const normal=normalPath;
    const entry=[...entries.values()].find(e=>normal(e.info.path)===normal(path)||normal(e.ref.path)===normal(path));
    const field=entry?.info.fields.find(field=>field.id===(fieldId||entry.ref.fieldId));if(!field)return null;
    const minima=field.blocks.map(block=>block.statistics?.minimum).filter(Number.isFinite),maxima=field.blocks.map(block=>block.statistics?.maximum).filter(Number.isFinite);
    return {id:field.id,path:entry.info.path,range:minima.length&&maxima.length?[Math.min(...minima),Math.max(...maxima)]:null};
  }
  return {renderCompact,updateCompact,setCompactStale,load,browse,select,treeHtml,bindTree,renderProperties,reset,closeTemporary,releaseForGeneration,resumeAfterGeneration,attachViewer,setVisible,describe,has:id=>entries.has(id)};
}
