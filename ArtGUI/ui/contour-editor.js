import {numberText,numberType,setNumber} from './numeric-json.js';
import {isMeshPath} from './quad-mesher-model.js';
import {contourError,contourFingerprint,contourSchedule,contourSpacing} from './contour-model.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=value=>Number.isFinite(value)?String(Number(value.toPrecision(10))):'';

export function createContourEditor({getContext,onChange,onRender,renderExtras,onPreview,onBrowse,isDiscarded,units,getBounds,toast}){
  const states=new WeakMap();
  let host=null,params=null,state=null,overlay=null;
  const q=selector=>host?.querySelector(selector);
  const heights=()=>Array.isArray(params?.PlaneHeights)?params.PlaneHeights:[];
  const spacing=values=>contourSpacing(values)||{
    start:values.length?Math.min(...values):0,
    end:values.length?Math.max(...values):100,
    step:values.length>1?(Math.max(...values)-Math.min(...values))/(values.length-1)||20:20
  };
  const sameValues=(a,b)=>a.length===b.length&&a.every((value,i)=>value===b[i]);
  function fresh(value){
    const values=Array.isArray(value.PlaneHeights)?value.PlaneHeights.filter(Number.isFinite):[];
    const schedule=spacing(values),mode=contourSpacing(values)?'even':'manual';
    const outputMode=isMeshPath(value.out_meshfile)?'file':'mesh';
    return {mode,schedule,outputMode,outputs:{file:'contours.contour',mesh:'ContourLines',[outputMode]:value.out_meshfile||''},
      active:Math.floor(values.length/2),busy:false,errors:new Map(),result:null,message:''};
  }
  function result(){
    if(!state?.result)return null;
    if(isDiscarded(state.result.path)){state.result=null;return null;}
    const ctx=getContext(params);
    return ctx&&state.result.fingerprint===contourFingerprint(ctx.doc,ctx.key)?state.result:null;
  }
  function updateOverlay(){
    if(!host||!state)return;
    const levels=heights();
    overlay?.update(levels,state.active,result()?.slices,getBounds(),units());
  }
  function issue(){
    return state.errors.values().next().value||contourError(params);
  }
  function paint(){
    if(!host)return;
    const data=result(),error=issue(),count=heights().length;
    q('[data-contour-status]').textContent=state.busy?'Computing contours…':error||state.message||
      (data?(count+' '+(count===1?'slice':'slices')+' · preview up to date'):state.result?'Settings changed · preview again':'Plane guides · preview to compute');
    q('[data-contour-status]').classList.toggle('contour-error',!!error);
    q('[data-contour-preview]').disabled=state.busy||!!error;
    q('[data-contour-body]').disabled=state.busy;
    q('[data-contour-count]').textContent=String(count);
    q('[data-contour-unit]').textContent=units();
  }
  function updateSelection(){
    host.querySelectorAll('[data-contour-row]').forEach(row=>{
      const selected=Number(row.dataset.contourRow)===state.active;
      row.classList.toggle('is-active',selected);
      row.querySelector('[data-contour-select]').setAttribute('aria-pressed',String(selected));
    });
    updateOverlay();
  }
  function select(index){
    if(!host||index<0||index>=heights().length)return;
    state.active=index;
    updateSelection();
    const row=q('[data-contour-row="'+index+'"]'),list=q('.contour-table-scroll');
    if(row&&list){
      const box=row.getBoundingClientRect(),viewport=list.getBoundingClientRect();
      if(box.top<viewport.top||box.bottom>viewport.bottom)row.scrollIntoView?.({block:'nearest'});
    }
  }
  function renderRows(){
    const data=result(),manual=state.mode==='manual';
    q('[data-contour-rows]').innerHTML=heights().map((height,index)=>{
      const value=Number.isFinite(height)?numberText(heights(),index):String(height??'');
      const count=data?.slices.get(height)?.length;
      return '<tr data-contour-row="'+index+'"><td><button type="button" class="contour-select" data-contour-select="'+index+
        '" aria-label="Select slice '+(index+1)+'" aria-pressed="false">Z</button></td><td>'+
        (manual?'<input type="number" step="any" data-contour-height="'+index+'" value="'+esc(value)+'" aria-label="Slice height '+(index+1)+'">':
        '<button type="button" class="contour-height-label" data-contour-focus="'+index+'" translate="no">'+esc(fmt(height))+'</button>')+
        '</td><td data-contour-result><span translate="no">'+(count??'—')+'</span>'+(count===undefined?'':' <span>'+(count===1?'path':'paths')+'</span>')+'</td>'+
        (manual?'<td><button type="button" class="contour-remove" data-contour-remove="'+index+'" aria-label="Remove slice '+(index+1)+'">Remove</button></td>':'')+'</tr>';
    }).join('');
    updateSelection();
    paint();
  }
  function changed(redraw=true){
    state.message='';
    onChange();
    if(redraw)renderRows();
    else paint();
  }
  function updateGeometry(){
    changed(false);
    for(const cell of host.querySelectorAll('[data-contour-result]'))cell.textContent='—';
    updateSelection();
  }
  function changeSchedule(input){
    const key=input.dataset.contourRange;
    state.schedule[key]=input.value.trim()===''?NaN:Number(input.value);
    try{
      const {start,end,step}=state.schedule;
      const values=contourSchedule(start,end,step);
      const previous=heights()[state.active];
      state.errors.delete('range');
      if(!sameValues(values,heights())){
        params.PlaneHeights=[];
        values.forEach((value,index)=>setNumber(params.PlaneHeights,index,value,'float'));
        state.active=values.includes(previous)?values.indexOf(previous):Math.min(state.active,values.length-1);
        changed();
      }else paint();
    }catch(error){state.errors.set('range',error.message);paint();}
  }
  function changeMode(mode){
    if(mode===state.mode)return;
    state.mode=mode;
    state.errors.delete('range');state.errors.delete('height');
    state.schedule=spacing(heights().filter(Number.isFinite));
    render();
    if(mode==='even')changeSchedule(q('[data-contour-range="step"]'));
  }
  function setDestination(value){
    const output=value.trim(),key=state.outputMode;
    state.outputs[key]=output;
    const mismatch=key==='mesh'?isMeshPath(output):!isMeshPath(output);
    if(!output||mismatch){
      state.errors.set('destination',key==='mesh'?'Enter a Mesh ID without a file extension.':'Enter a file name with an extension.');
      paint();return;
    }
    state.errors.delete('destination');
    if(output!==params.out_meshfile){params.out_meshfile=output;changed(false);}
    else paint();
  }
  function changeDestinationMode(mode){
    if(mode===state.outputMode)return;
    state.outputMode=mode;
    setDestination(state.outputs[mode]);
    render();
  }
  async function browse(){
    const current=params,currentState=state;
    try{
      const path=await onBrowse(state.outputs.file);
      if(path&&params===current&&state===currentState&&state.outputMode==='file'){
        setDestination(path);
        q('[data-contour-output]').value=path;
      }
    }catch(error){
      if(params===current){state.message=String(error.message||error);paint();}
    }
  }
  async function preview(){
    if(!host||state.busy||issue())return;
    const current=params,entry=state,ctx=getContext(current);
    if(!ctx)return;
    entry.busy=true;entry.message='';paint();
    try{
      const run=await onPreview(current,ctx);
      if(run?.success&&run.slices)entry.result=run;
      else if(run)entry.message=run.cancelled?'Preview cancelled.':'Contour preview failed.';
    }catch(error){entry.message=String(error.message||error);}
    finally{
      entry.busy=false;
      if(host&&params===current)renderRows();
    }
  }
  function onTableClick(event){
    const button=event.target.closest('button');
    if(!button){
      const row=event.target.closest('[data-contour-row]');
      if(row)select(Number(row.dataset.contourRow));
      return;
    }
    if(button.hasAttribute('data-contour-remove')){
      const index=Number(button.dataset.contourRemove),remaining=heights().map((value,i)=>i===index?null:{value,text:Number.isFinite(value)?numberText(heights(),i):null,type:numberType(heights(),i)}).filter(Boolean);
      params.PlaneHeights=[];
      remaining.forEach(({value,text,type},i)=>text===null?params.PlaneHeights.push(value):setNumber(params.PlaneHeights,i,text,type));
      state.active=Math.max(0,Math.min(state.active-(index<state.active?1:0),remaining.length-1));
      state.errors.delete('height');
      changed();
      return;
    }
    const index=Number(button.dataset.contourSelect??button.dataset.contourFocus);
    if(Number.isInteger(index))select(index);
  }
  function changeHeight(input){
    const index=Number(input.dataset.contourHeight),value=Number(input.value);
    if(!input.value.trim()||!Number.isFinite(value)||heights().some((z,i)=>i!==index&&z===value)){
      state.errors.set('height','Enter distinct finite heights.');paint();return;
    }
    state.errors.delete('height');
    setNumber(params.PlaneHeights,index,input.value,'float');
    state.active=index;
    updateGeometry();
  }
  function addHeight(){
    if(!Array.isArray(params.PlaneHeights))params.PlaneHeights=[];
    const values=heights().filter(Number.isFinite),value=values.length?Math.max(...values)+1:0;
    if(!Number.isFinite(value)||values.includes(value)){
      state.errors.set('height','Enter distinct finite heights.');paint();return;
    }
    setNumber(params.PlaneHeights,heights().length,value,'float');
    state.active=heights().length-1;
    changed();
    q('[data-contour-height="'+state.active+'"]')?.select();
  }
  function render(){
    if(!host)return;
    const even=state.mode==='even',file=state.outputMode==='file',res=Array.isArray(params.res)?params.res:[];
    host.innerHTML='<section class="contour-editor"><fieldset class="contour-body" data-contour-body>'+
      '<section class="contour-section"><h3>Slice heights</h3><div class="contour-options" role="group" aria-label="Slice spacing">'+
      '<button type="button" class="button" data-contour-mode="even" aria-pressed="'+even+'">Even spacing</button>'+
      '<button type="button" class="button" data-contour-mode="manual" aria-pressed="'+!even+'">Manual</button></div>'+
      (even?'<div class="contour-numbers">'+[['start','Start'],['end','End'],['step','Step']].map(([key,label])=>
        '<label>'+label+'<input type="number" step="any" data-contour-range="'+key+'" value="'+esc(state.schedule[key])+'"></label>').join('')+
        '<span class="contour-unit" data-contour-unit></span></div>':'<span hidden data-contour-unit></span>')+
      '<div class="contour-heading"><h3>Schedule</h3><span data-contour-count translate="no"></span></div>'+
      '<div class="contour-table-scroll"><table class="contour-table"><thead><tr><th aria-label="Select slice"></th><th>Height</th><th>Result</th>'+
      (even?'':'<th aria-label="Remove slice"></th>')+'</tr></thead><tbody data-contour-rows></tbody></table></div>'+
      (even?'':'<button type="button" class="button contour-add" data-contour-add>Add height</button>')+'</section>'+
      '<details class="contour-details" data-contour-res-details '+(state.resOpen?'open':'')+'><summary>Sampling resolution</summary><div class="contour-numbers">'+
      ['X','Y','Z'].map((axis,i)=>'<label>'+axis+'<input type="number" step="any" data-contour-resolution="'+i+'" value="'+
        esc(Number.isFinite(res[i])?numberText(res,i):res[i])+'" aria-label="'+axis+' sampling resolution"></label>').join('')+'</div></details>'+
      '<details class="contour-details" data-contour-output-details '+(state.outputOpen?'open':'')+'><summary>Output destination</summary><div class="contour-options" role="group" aria-label="Output destination">'+
      '<button type="button" class="button" data-contour-destination="file" aria-pressed="'+file+'">File</button>'+
      '<button type="button" class="button" data-contour-destination="mesh" aria-pressed="'+!file+'">Mesh Container</button></div>'+
      '<label class="contour-output"><span>'+(file?'Output file':'Mesh ID')+'</span><span><input data-contour-output translate="no" value="'+esc(state.outputs[state.outputMode])+'">'+
      (file?'<button type="button" class="button" data-contour-browse>Browse…</button>':'<span class="contour-kind">Line mesh</span>')+
      '</span></label></details>'+renderExtras(params)+'</fieldset><footer class="contour-footer"><span role="status" data-contour-status></span>'+
      '<button type="button" class="button primary" data-contour-preview>Preview contours</button></footer></section>';
    host.querySelectorAll('[data-contour-mode]').forEach(b=>b.onclick=()=>changeMode(b.dataset.contourMode));
    host.querySelectorAll('[data-contour-destination]').forEach(b=>b.onclick=()=>changeDestinationMode(b.dataset.contourDestination));
    host.querySelectorAll('[data-contour-range]').forEach(input=>input.onchange=()=>changeSchedule(input));
    host.querySelectorAll('[data-contour-resolution]').forEach(input=>input.onchange=()=>{
      const index=Number(input.dataset.contourResolution),value=Number(input.value),key='res'+index;
      if(!input.value.trim()||!Number.isFinite(value)||value<=0){state.errors.set(key,'Enter positive X, Y and Z sampling resolutions.');paint();return;}
      if(!Array.isArray(params.res))params.res=[];
      state.errors.delete(key);setNumber(params.res,index,input.value,'float');updateGeometry();
    });
    q('[data-contour-output]').onchange=event=>setDestination(event.target.value);
    if(file)q('[data-contour-browse]').onclick=browse;
    if(!even)q('[data-contour-add]').onclick=addHeight;
    q('[data-contour-rows]').onclick=onTableClick;
    q('[data-contour-rows]').onchange=event=>{if(event.target.hasAttribute('data-contour-height'))changeHeight(event.target);};
    q('[data-contour-preview]').onclick=preview;
    q('[data-contour-res-details]').ontoggle=event=>{state.resOpen=event.target.open;};
    q('[data-contour-output-details]').ontoggle=event=>{state.outputOpen=event.target.open;};
    renderRows();
    onRender();
  }
  return {
    show(element,value){
      if(host===element&&params===value&&q('.contour-editor')){renderRows();return;}
      host=element;params=value;
      if(!states.has(value))states.set(value,fresh(value));
      state=states.get(value);
      if(!state.errors.has('destination')&&state.outputs[state.outputMode]!==value.out_meshfile){
        state.outputMode=isMeshPath(value.out_meshfile)?'file':'mesh';
        state.outputs[state.outputMode]=value.out_meshfile;
      }
      render();
    },
    hide(){
      if(!host)return;
      if(state.errors.size){
        const clean=fresh(params);
        state.errors.clear();
        state.schedule=clean.schedule;
        state.outputMode=clean.outputMode;
        state.outputs=clean.outputs;
      }
      host=null;params=null;state=null;overlay?.hide();
    },
    refresh(){if(host){renderRows();}},
    syncOverlay:updateOverlay,
    select,
    attachOverlay(next){overlay=next;updateOverlay();},
    applyAll(){
      if(host?.contains(document.activeElement)&&document.activeElement.matches('input'))document.activeElement.blur();
      if(!state?.errors.size)return true;
      toast(issue());return false;
    }
  };
}
