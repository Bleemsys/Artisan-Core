import {geometryType,geometryError,meshSource,regionTypes,regionColours,defaultGeometry,newPrimitiveRegion,scalarFieldError,coverageWarning,scalarFieldMethods,isScalarInterpolation,scalarMethodHelp,changeScalarMethod} from './region-model.js';
import {cloneNumericJson,assignNumericJson,setNumber} from './numeric-json.js';
import {operationIcon} from './operation-icons.js';

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function createRegionEditor({getViewer,getSetup,getGeometries,onChange,onGrid,onPreview,onViewField,browseMesh,loadMesh,toast,onRender=()=>{}}){
  const states=new WeakMap();let params=null,host=null,state=null,overlay=null,busy=false,rendering=false;
  const $=id=>host?.querySelector('#'+id);
  const region=()=>params?.regions?.[state.index];
  function history(){state.undo.push(cloneNumericJson(params));if(state.undo.length>30)state.undo.shift();}
  function changed(){state.updated=false;state.message='Field needs update';onChange();sync();}
  function mutation(fn){if(rendering)return;history();fn();changed();render();}
  function attachOverlay(instance){overlay=instance;if(params){sync();overlay.frame();}}
  function sync(){
    if(!params)return;
    const r=region(),error=scalarFieldError(params),warning=coverageWarning(r,getSetup());
    if($('region-error'))$('region-error').textContent=error;
    if($('region-coverage'))$('region-coverage').textContent=warning;
    if($('region-status')){$('region-status').textContent=state.message;$('region-status').classList.toggle('current',state.updated);}
    if($('region-update'))$('region-update').disabled=!!error||busy;
    if($('region-undo'))$('region-undo').disabled=!state.undo.length||busy;
    if($('region-revert'))$('region-revert').disabled=busy;
    overlay?.update(Array.isArray(params.regions)?params.regions:[],state.index,{mode:state.mode,snap:state.snap,hidden:state.hidden});
    document.getElementById('viewport-empty')?.classList.add('hidden');
  }
  function number(path,label,value,min){return `<div class="field"><label for="region-${path.replaceAll('.','-')}">${label}</label><input id="region-${path.replaceAll('.','-')}" data-region-number="${path}" type="number" step="any" ${min!==undefined?`min="${min}"`:''} value="${esc(value)}"></div>`;}
  function vector(key,label,values){return `<div class="field"><label>${label}</label><div class="region-vector">${['X','Y','Z'].map((axis,i)=>`<label><span>${axis}</span><input type="number" step="any" data-region-number="geometry.${key}.${i}" aria-label="${label} ${axis}" value="${esc(values?.[i])}"></label>`).join('')}</div></div>`;}
  function geometryFields(r){const g=r.geometry,type=geometryType(g),units=esc(getViewer()?.settings.units||'model units');
    if(type==='Mesh')return `<div class="field"><label for="region-source">Mesh file or mesh ID</label><div class="path-row"><input id="region-source" type="text" value="${esc(meshSource(g))}" placeholder="Closed surface mesh or mesh ID"><button class="icon-button" id="region-browse" aria-label="Browse region mesh">${operationIcon('folder-open')}</button></div></div><div class="field"><label for="region-loaded">Use project geometry</label><select id="region-loaded"><option value="">Choose geometry…</option>${getGeometries().map(f=>`<option value="${esc(f.path)}">${esc(f.path.split(/[\\/]/).pop())}</option>`).join('')}</select></div><button class="button" id="region-show-mesh">Load mesh overlay</button><p class="field-help">Use a closed surface. Mesh IDs can be computed by earlier workflow steps; file preview requires a mesh file. The original mesh is not transformed.</p>`;
    if(!regionTypes.includes(type))return '<p class="region-error">Unsupported geometry. Select a supported type or edit Workflow JSON.</p>';
    let html=vector('center',`Center (${units})`,g.center);
    if(type==='Box')html+=vector('size',`Full size (${units})`,g.size)+`<details class="region-orientation"><summary>Orientation</summary>${vector('rotation_axis','Rotation axis',g.rotation_axis||[0,0,1])}${number('geometry.rotation_degrees','Angle (degrees)',g.rotation_degrees||0)}</details>`;
    if(type==='Cylinder')html+=`<div class="region-two">${number('geometry.radius',`Radius (${units})`,g.radius,0)}${number('geometry.height',`Full height (${units})`,g.height,0)}</div>`+vector('axis','Cylinder axis',g.axis||[0,0,1]);
    if(type==='Sphere')html+=number('geometry.radius',`Radius (${units})`,g.radius,0);
    return html+`<div class="region-tools" role="group" aria-label="Viewport editing tool">${['move','resize','rotate'].filter(m=>m!=='rotate'||type!=='Sphere').map(m=>`<button class="button ${state.mode===m?'selected':''}" data-region-tool="${m}" aria-pressed="${state.mode===m}">${m[0].toUpperCase()+m.slice(1)}</button>`).join('')}<button class="button" id="region-pick">Pick center</button><button class="button" id="region-frame">Fit regions</button></div><div class="region-snap"><label for="region-snap">Drag snap (${units})</label><input id="region-snap" type="number" min="0" step="any" value="${state.snap}"><span>0 = off · Shift rotates by 15°</span></div><details class="region-help"><summary>Viewport controls</summary><p class="field-help" id="region-drag-help">${state.mode==='resize'?'Face and cap drags keep the opposite side fixed. Radius drags preserve the center.':state.mode==='rotate'?'Drag a colored rotation handle. Sphere orientation has no effect.':'Drag an axis handle, or drag the region name in the viewing plane. Pick center snaps to a visible model surface.'} Arrow keys adjust a focused handle; Esc cancels a drag.</p></details>`;
  }
  function render(){
    if(!params||!host||rendering)return;
    rendering=true;
    try{
    const regions=Array.isArray(params.regions)?params.regions:[];state.index=Math.min(state.index,regions.length-1);if(state.index<0&&regions.length)state.index=0;
    const r=region(),units=esc(getViewer()?.settings.units||'model units'),method=params.overlap??'Minimum',interpolation=isScalarInterpolation(method);
    const invalidWidths=interpolation&&regions.some(r=>(r?.transition_width??0)!==0);
    host.innerHTML=`<div class="scalar-region-editor"><div class="field"><label for="region-field-name">Field name</label><input id="region-field-name" type="text" value="${esc(params.field_id)}"></div><div class="region-two">${number('default_value','Background value',params.default_value)}<div class="field"><label for="region-overlap">Combination method</label><select id="region-overlap" aria-describedby="region-method-help">${scalarFieldMethods.includes(method)?'':`<option value="${esc(method)}" selected disabled>Choose a supported combination method.</option>`}${scalarFieldMethods.map(v=>`<option value="${v}" ${method===v?'selected':''}>${v}</option>`).join('')}</select></div></div><p class="field-help" id="region-method-help">${scalarMethodHelp(method)}</p>
      ${interpolation?'<p class="field-help">Background is not used. Regional values fill the entire sampling domain. Overlapping or touching regions cause an error when the field is computed.</p>':''}
      ${method==='InverseDistance'||(params.distance_power!==undefined&&params.distance_power!==1)?number('distance_power','Distance power',params.distance_power??1,0)+'<p class="field-help">Only for InverseDistance. Must be greater than zero; 1 matches Linear.</p>':''}
      ${invalidWidths?'<button class="button" id="region-clear-transitions">Clear transition widths</button>':''}
      <section class="region-section"><div class="region-heading"><h3>Regions <span>${regions.length}</span></h3><button class="button" id="region-add">Add region</button></div><div class="region-list" aria-label="Field regions">${regions.length?regions.map((r,i)=>`<div class="region-row ${i===state.index?'active':''}"><button class="region-select" data-region-select="${i}" aria-pressed="${i===state.index}"><span class="region-swatch" style="background:${regionColours[i%regionColours.length]}"></span><span><strong translate="no">${esc(r?.name||`Region ${i+1}`)}</strong><small>${esc(geometryType(r?.geometry)||'Unknown')} · Value ${esc(r?.value)}</small></span></button><input type="checkbox" data-region-visible="${i}" aria-label="Show region ${i+1} outline" ${state.hidden.has(i)?'':'checked'}></div>`).join(''):`<p class="field-help">${interpolation?'Interpolation requires at least two regions.':'No regions: the field is constant. Add a region to vary it.'}</p>`}</div></section>
      ${r?`<section class="region-section"><div class="region-heading region-selected-heading"><input type="text" id="region-name" aria-label="Region name" placeholder="Region name" value="${esc(r.name||'')}"><button class="button subtle" id="region-remove">Remove</button></div><div class="region-shapes" role="group" aria-label="Geometry type">${regionTypes.map(type=>`<button class="button ${geometryType(r.geometry)===type?'selected':''}" data-region-type="${type}" aria-pressed="${geometryType(r.geometry)===type}">${type}</button>`).join('')}</div>${geometryFields(r)}<div class="region-two">${number('value','Region value',r.value)}${number('transition_width',`Transition (${units})`,r.transition_width??0,0)}</div><p class="field-help">${interpolation?'Interpolation uses surface distances. Transition width must be 0.':'Transition blends outward from the boundary. Zero gives a sharp mask.'}</p></section>`:''}
      <p id="region-coverage" class="region-coverage"></p><button class="text-button" id="region-grid">Sampling grid settings</button><p id="region-error" class="region-error" role="alert"></p><div class="region-actions"><div id="region-status" role="status"></div><div><button class="button" id="region-undo">Undo</button><button class="button" id="region-revert">Revert</button><button class="button primary" id="region-update">Update field</button></div><button class="text-button" id="region-view-field">View exported field…</button><p>Outlines are editable geometry. Update computes an HDF5 preview through this step; downstream steps do not run.</p></div></div>`;
    $('region-field-name').onchange=e=>mutation(()=>params.field_id=e.target.value.trim());
    $('region-overlap').onchange=e=>mutation(()=>changeScalarMethod(params,e.target.value));
    $('region-default_value').disabled=interpolation;
    $('region-default_value').setAttribute('aria-describedby','region-method-help');
    if(interpolation&&$('region-transition_width')&&(r.transition_width??0)===0)$('region-transition_width').disabled=true;
    if($('region-clear-transitions'))$('region-clear-transitions').onclick=()=>mutation(()=>{for(const region of regions)if(region&&typeof region==='object')setNumber(region,'transition_width',0,'float');});
    $('region-add').onclick=()=>mutation(()=>{if(!Array.isArray(params.regions))params.regions=[];params.regions.push(newPrimitiveRegion('Box',getSetup()?.Sample?.Domain,params.regions.length));state.index=params.regions.length-1;});
    host.querySelectorAll('[data-region-select]').forEach(b=>b.onclick=()=>{state.index=Number(b.dataset.regionSelect);state.mode='move';render();});
    host.querySelectorAll('[data-region-visible]').forEach(b=>b.onchange=()=>{const i=Number(b.dataset.regionVisible);b.checked?state.hidden.delete(i):state.hidden.add(i);sync();});
    host.querySelectorAll('[data-region-type]').forEach(b=>b.onclick=()=>{if(geometryType(region().geometry)===b.dataset.regionType)return;mutation(()=>{region().geometry=defaultGeometry(b.dataset.regionType,getSetup()?.Sample?.Domain,region().geometry);state.mode='move';});toast('Geometry changed. Region name and field values are kept. Undo restores the previous shape.');});
    host.querySelectorAll('[data-region-tool]').forEach(b=>b.onclick=()=>{state.mode=b.dataset.regionTool;render();});
    host.querySelectorAll('[data-region-number]').forEach(input=>input.onchange=()=>{
      if(rendering)return;
      const path=input.dataset.regionNumber.split('.'),root=['default_value','distance_power'].includes(path[0])?params:region(),before=cloneNumericJson(params);
      try{let obj=root;for(const key of path.slice(0,-1)){if(!obj[key])obj[key]=key==='rotation_axis'||key==='axis'?[0,0,1]:{};obj=obj[key];}setNumber(obj,path.at(-1),input.value,'float');
        const error=path[0]==='geometry'?geometryError(region().geometry):path[0]==='distance_power'&&params.distance_power<=0?'Distance power must be finite and greater than zero.':path[0]==='transition_width'&&region().transition_width<0?'Transition width must be zero or positive.':path[0]==='transition_width'&&interpolation&&region().transition_width!==0?'Interpolation requires transition width 0. Clear transition widths or select Minimum or Maximum.':'';
        if(error)throw Error(error);state.undo.push(before);changed();render();}
      catch(e){assignNumericJson(params,before);render();$('region-error').textContent=e.message+' Previous value retained.';toast(e.message);}
    });
    if(r){$('region-name').onchange=e=>mutation(()=>region().name=e.target.value);$('region-remove').onclick=()=>mutation(()=>{params.regions.splice(state.index,1);state.hidden.clear();});}
    if($('region-snap'))$('region-snap').onchange=e=>{const v=Number(e.target.value);if(!Number.isFinite(v)||v<0){e.target.value=state.snap;return;}state.snap=v;sync();};
    if($('region-pick'))$('region-pick').onclick=()=>overlay?.pickCenter();
    if($('region-frame'))$('region-frame').onclick=()=>overlay?.frame();
    const setMesh=path=>mutation(()=>{if(typeof region().geometry==='string')region().geometry=path;else region().geometry.source=path;});
    if($('region-source')){
      $('region-source').onchange=e=>setMesh(e.target.value.trim());$('region-loaded').onchange=e=>{if(e.target.value)setMesh(e.target.value);};
      $('region-browse').onclick=async()=>{const original=params,selectedRegion=region();try{const path=await browseMesh();if(path&&params===original&&region()===selectedRegion){setMesh(path);await loadMesh(path);overlay?.refresh();}}catch(e){toast(String(e));}};
      $('region-show-mesh').onclick=async()=>{try{await loadMesh(meshSource(region().geometry));overlay?.refresh();}catch(e){toast(String(e));}};
    }
    $('region-grid').onclick=onGrid;$('region-view-field').onclick=onViewField;
    $('region-undo').onclick=()=>{const previous=state.undo.pop();if(previous){for(const k of Object.keys(params))delete params[k];assignNumericJson(params,previous);state.hidden.clear();changed();render();}};
    $('region-revert').onclick=()=>mutation(()=>{for(const k of Object.keys(params))delete params[k];assignNumericJson(params,cloneNumericJson(state.baseline));state.hidden.clear();});
    $('region-update').onclick=async()=>{
      const target=params,s=state;busy=true;s.message='Computing field…';sync();
      try{const result=await onPreview(target);if(result?.success){s.baseline=cloneNumericJson(target);s.updated=true;s.message='Field updated · preview saved';}else{s.message=result?.cancelled?'Update stopped · previous output may be stale':'Field needs update';}}
      catch(e){s.message='Update failed · field needs update';toast(e.message||String(e));}
      finally{busy=false;if(params===target){render();}}
    };
    sync();onRender();
    }finally{rendering=false;}
  }
  return {
    attachOverlay,
    show(element,p){host=element;params=p;const first=!states.has(p);if(first)states.set(p,{index:0,mode:'move',snap:0,hidden:new Set(),undo:[],baseline:cloneNumericJson(p),updated:false,message:'Geometry outlines · field not updated'});state=states.get(p);render();if(first)overlay?.frame();},
    hide(){params=null;host=null;overlay?.hide();},
    select(i){if(!params)return;state.index=i;state.mode='move';render();},
    drag(g){if(!region())return;region().geometry=g;state.updated=false;state.message='Field needs update';host?.querySelectorAll('[data-region-number^="geometry."]').forEach(input=>{const path=input.dataset.regionNumber.split('.').slice(1);input.value=path.reduce((o,k)=>o?.[k],g)??0;});if($('region-status'))$('region-status').textContent=state.message;},
    commit(original){if(!params)return;const previous=cloneNumericJson(params);previous.regions[state.index].geometry=original;state.undo.push(previous);changed();render();},
    cancel(original){if(region()){region().geometry=original;render();}},
    refresh(){if(params)sync();},
  };
}
