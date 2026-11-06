import {numberText,setNumber} from './numeric-json.js';
import {operationIcon} from './operation-icons.js';
import {directionMatches,pairDirection,slotError,slotFingerprint,slotId,slotInputs,suggestedCutters} from './slot-model.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=value=>Number.isFinite(value)?String(Number(value.toPrecision(10))):'';
const axes=[[1,0,0],[0,1,0],[0,0,1]];
const openings=['Negative','Positive'];

export function createSlotEditor({getContext,onChange,onPreview,onBrowse,isDiscarded,getBounds,units,onRename,toast,renderExtras,onRender}){
  const states=new WeakMap();
  let host=null,params=null,state=null,overlay=null,result=null;
  const q=selector=>host?.querySelector(selector);
  const context=()=>getContext(params);
  const inputs=()=>{const c=context();return c?slotInputs(c.doc.WorkFlow,c.key):{plates:new Map(),names:new Set()};};
  const split=()=>params.split_ratio??.5;
  const putDirection=direction=>{
    params.direction=[];
    direction.forEach((value,i)=>setNumber(params.direction,i,value,'float'));
  };
  const issue=()=>state.errors.values().next().value||slotError(params,inputs());
  function currentResult(){
    if(!result)return null;
    if(isDiscarded(result.path)){result=null;return null;}
    const c=context();
    return result.params===params&&c&&result.fingerprint===slotFingerprint(c.doc,c.key)?result:null;
  }
  function syncOverlay(fit=false){
    if(!host)return;
    overlay?.update(inputs().plates,params,state.isolate,currentResult(),getBounds(),fit);
  }
  function paint(){
    if(!host)return;
    const error=issue(),preview=currentResult(),past=result?.params===params;
    q('[data-slot-status]').textContent=state.busy?'Computing joint…':error||state.message||
      (preview?'Joint preview up to date':past?'Settings changed · preview again':'Plate and joint guides');
    q('[data-slot-status]').classList.toggle('slot-error',!!error);
    q('[data-slot-preview]').disabled=state.busy||!!error;
    q('[data-slot-body]').disabled=state.busy;
    q('[data-slot-unit]').textContent=units();
    q('[data-slot-grid]').disabled=state.busy||inputs().plates.size<2;
  }
  function changed(fit=false){
    state.message='';
    onChange();
    paint();
    syncOverlay(fit);
  }
  function selectedDirection(joint){
    if(state.custom)return 'custom';
    if(joint&&directionMatches(params.direction,joint))return Math.sign(params.direction.reduce((sum,n,i)=>sum+n*joint[i],0))<0?'reverse':'joint';
    const axis=axes.findIndex(dir=>Array.isArray(params.direction)&&params.direction.every((v,i)=>v===dir[i]));
    return axis>=0?'axis'+axis:'custom';
  }
  function setPair(a,b){
    if(a===params.A&&b===params.B)return;
    params.A=a;params.B=b;
    state.errors.delete('direction');
    const {plates,names}=inputs(),joint=pairDirection(plates.get(a),plates.get(b));
    if(joint&&!directionMatches(params.direction,joint))putDirection(joint);
    const suggestion=suggestedCutters(a,b,names);
    params.Cutters||={};
    for(const side of ['A','B'])if(!params.Cutters[side])params.Cutters[side]=suggestion[side];
    render();
    changed(true);
  }
  function setSplit(input){
    const raw=input.value.trim(),percent=Number(raw);
    if(!raw||!Number.isFinite(percent)||percent<=0||percent>=100){
      state.errors.set('split','Split must be greater than 0% and less than 100%.');
      input.setAttribute('aria-invalid','true');paint();return;
    }
    state.errors.delete('split');
    setNumber(params,'split_ratio',percent/100,'float');
    q('[data-slot-split]').value=fmt(percent);
    q('[data-slot-split]').removeAttribute('aria-invalid');
    q('[data-slot-slider]').value=String(percent);
    changed();
  }
  function setClearance(input){
    const value=Number(input.value);
    if(!input.value.trim()||!Number.isFinite(value)||value<0){
      state.errors.set('clearance','Clearance must be zero or greater.');
      input.setAttribute('aria-invalid','true');paint();return;
    }
    state.errors.delete('clearance');input.removeAttribute('aria-invalid');
    setNumber(params,'clearance',input.value,'float');
    changed();
  }
  function setNames(next){
    const previous={...params.Cutters},candidate={...previous,...next};
    const {names}=inputs();
    if(!slotId(candidate.A)||!slotId(candidate.B)||candidate.A===candidate.B||
      ['A','B'].some(side=>names.has(candidate[side])||[params.A,params.B].includes(candidate[side]))){
      state.errors.set('names','Enter two distinct, unused cutter field names.');paint();return;
    }
    state.errors.delete('names');
    params.Cutters=candidate;
    onRename(params,previous,candidate);
    changed();
  }
  async function preview(){
    if(!host||state.busy||issue())return;
    const p=params,entry=state,c=context();
    if(!c)return;
    entry.busy=true;entry.message='';paint();
    try{
      const next=await onPreview(p,c);
      if(next?.success&&next.meshes)result={...next,params:p};
      else if(next)entry.message=next.cancelled?'Preview cancelled.':next.error||'Joint preview failed. Check the run log.';
    }catch(error){entry.message=String(error.message||error);toast(entry.message);}
    finally{
      entry.busy=false;
      if(host&&p===params){paint();syncOverlay(!!currentResult());}
    }
  }
  function render(){
    const {plates,names}=inputs(),joint=pairDirection(plates.get(params.A),plates.get(params.B));
    const selected=selectedDirection(joint),suggestion=suggestedCutters(params.A,params.B,names);
    const option=(value,label,current)=>'<option value="'+esc(value)+'" '+(value===current?'selected':'')+'>'+esc(label)+'</option>';
    const directionLabel=joint&&joint.some(v=>Math.abs(v)>1-1e-6)?'XYZ'[joint.findIndex(v=>Math.abs(v)>1-1e-6)]:'Along intersection';
    const directionOptions=(joint?option('joint',directionLabel,selected)+option('reverse','Reverse intersection',selected):
      axes.map((_,i)=>option('axis'+i,'XYZ'[i],selected)).join(''))+option('custom','Custom vector',selected);
    const markup='<section class="slot-editor"><fieldset class="slot-body" data-slot-body><section class="slot-section"><h3>Choose plate pair</h3>'+
      ['A','B'].map(side=>{
        const list='slot-plate-list-'+side,other=side==='A'?'B':'A';
        return '<div class="slot-row"><label for="slot-plate-'+side+'">Plate '+side+'</label><span class="slot-plate-input"><i class="slot-swatch slot-'+side.toLowerCase()+
          '" aria-hidden="true"></i><input id="slot-plate-'+side+'" list="'+list+'" data-slot-plate="'+side+
          '" translate="no" autocomplete="off" value="'+esc(params[side])+'"><button type="button" class="slot-plate-picker" data-slot-picker="'+side+
          '" aria-label="Search Plate '+side+'">'+operationIcon('search')+'</button></span></div>'+
          '<datalist id="'+list+'">'+[...plates.keys()].filter(id=>id!==params[other]).map(id=>'<option value="'+esc(id)+'"></option>').join('')+'</datalist>';
      }).join('')+
      '<button type="button" class="button slot-grid-button" data-slot-grid>Browse pair grid…</button></section>'+
      '<section class="slot-section"><h3>Joint settings</h3><label class="slot-row"><span>Direction</span><select data-slot-direction>'+directionOptions+'</select></label>'+
      (selected==='custom'?'<div class="slot-vector">'+axes.map((_,i)=>'<label>'+'XYZ'[i]+'<input type="number" step="any" data-slot-vector="'+i+'" value="'+
        esc(Number.isFinite(params.direction?.[i])?numberText(params.direction,i):'')+'"></label>').join('')+'</div>':'')+
      ['A','B'].map(side=>'<label class="slot-row"><span>Opening '+side+'</span><select data-slot-opening="'+side+'">'+
        openings.map(value=>option(value,value,params['open_'+side])).join('')+'</select></label>').join('')+
      '<div class="slot-row"><label for="slot-split-slider">Split</label><div class="slot-split"><input id="slot-split-slider" type="range" min="0.01" max="99.99" step="0.01" data-slot-slider value="'+
      esc(fmt(split()*100))+'"><input type="number" step="any" min="0" max="100" data-slot-split aria-label="Split percentage" value="'+
      esc(fmt(split()*100))+'"><span aria-hidden="true">%</span></div></div>'+
      '<label class="slot-row"><span>Clearance</span><span class="slot-clearance"><input type="number" min="0" step="any" data-slot-clearance value="'+
      esc(params.clearance===undefined?'0':Number.isFinite(params.clearance)?numberText(params,'clearance'):'')+'"><span data-slot-unit></span></span></label></section>'+
      '<details class="slot-section slot-names" '+(state.namesOpen?'open':'')+'><summary>Cutter field names</summary>'+
      ['A','B'].map(side=>'<label class="slot-row"><span>Cutter '+side+'</span><input data-slot-name="'+side+'" translate="no" value="'+
        esc(params.Cutters?.[side])+'" placeholder="'+esc(suggestion[side])+'"></label>').join('')+
      '<button type="button" class="button slot-grid-button" data-slot-suggest>Use suggested names</button>'+
      '<p class="field-help">Later subtraction steps use these field IDs.</p></details>'+renderExtras(params)+'</fieldset>'+
      '<footer class="slot-footer"><span role="status" data-slot-status></span><button type="button" class="button primary" data-slot-preview>Preview joint</button></footer></section>';
    const oldBody=q('[data-slot-body]');
    if(oldBody){
      const template=document.createElement('template');template.innerHTML=markup;
      oldBody.replaceWith(template.content.querySelector('[data-slot-body]'));
    }else host.innerHTML=markup;
    host.querySelectorAll('[data-slot-picker]').forEach(button=>button.onclick=()=>{
      const input=q('[data-slot-plate="'+button.dataset.slotPicker+'"]');
      input.focus();input.select();
      try{input.showPicker?.();}catch{/* Search remains available by typing. */}
    });
    host.querySelectorAll('[data-slot-plate]').forEach(input=>input.onchange=()=>{
      const value=input.value.trim();
      setPair(input.dataset.slotPlate==='A'?value:params.A,input.dataset.slotPlate==='B'?value:params.B);
    });
    q('[data-slot-grid]').onclick=()=>{
      const p=params;
      onBrowse(plates,{A:p.A,B:p.B},(a,b)=>{if(params===p)setPair(a,b);});
    };
    q('[data-slot-direction]').onchange=event=>{
      const value=event.target.value;
      state.custom=value==='custom';state.errors.delete('direction');
      if(value==='joint'||value==='reverse')putDirection(value==='reverse'?joint.map(v=>v===0?0:-v):joint);
      if(value.startsWith('axis'))putDirection(axes[Number(value.at(-1))]);
      render();changed();
    };
    host.querySelectorAll('[data-slot-vector]').forEach(input=>input.onchange=()=>{
      if(!input.value.trim()||!Number.isFinite(Number(input.value))){
        state.errors.set('direction','Enter a finite, nonzero direction.');paint();return;
      }
      state.errors.delete('direction');
      params.direction=Array.isArray(params.direction)?params.direction:[0,0,0];
      setNumber(params.direction,Number(input.dataset.slotVector),input.value,'float');changed();
    });
    host.querySelectorAll('[data-slot-opening]').forEach(input=>input.onchange=()=>{
      const side=input.dataset.slotOpening,other=side==='A'?'B':'A';
      params['open_'+side]=input.value;
      params['open_'+other]=openings.find(value=>value!==input.value);
      q('[data-slot-opening="'+other+'"]').value=params['open_'+other];changed();
    });
    q('[data-slot-slider]').oninput=event=>setSplit(event.target);
    q('[data-slot-split]').onchange=event=>setSplit(event.target);
    q('[data-slot-clearance]').onchange=event=>setClearance(event.target);
    q('.slot-names').ontoggle=event=>{if(event.target.isConnected)state.namesOpen=event.target.open;};
    host.querySelectorAll('[data-slot-name]').forEach(input=>input.onchange=()=>setNames({[input.dataset.slotName]:input.value.trim()}));
    q('[data-slot-suggest]').onclick=()=>{setNames(suggestion);render();};
    q('[data-slot-preview]').onclick=preview;
    paint();onRender();
  }

  return {
    show(element,value){
      if(host===element&&params===value&&q('.slot-editor')){paint();syncOverlay();return;}
      host=element;params=value;
      if(!states.has(value))states.set(value,{isolate:false,busy:false,namesOpen:false,errors:new Map(),message:''});
      state=states.get(value);
      render();syncOverlay(true);
    },
    hide(){
      if(!host)return;
      state.errors.clear();host=null;params=null;state=null;overlay?.hide();
    },
    reset(){this.hide();result=null;},
    attachOverlay(next){overlay=next;syncOverlay(true);},
    syncOverlay,
    isolate(){if(state){state.isolate=!state.isolate;syncOverlay();}},
    applyAll(){
      if(host?.contains(document.activeElement)&&document.activeElement.matches('input'))document.activeElement.blur();
      if(!state?.errors.size)return true;
      toast(issue());return false;
    }
  };
}

export function bindSlotGrid(host,plates,selected,onSelect){
  const q=selector=>host.querySelector(selector),size=12;
  let pageA=0,pageB=0;
  const ids=[...plates.keys()];
  pageA=Math.max(0,Math.floor(ids.indexOf(selected.A)/size));
  pageB=Math.max(0,Math.floor(ids.indexOf(selected.B)/size));
  const filter=(input)=>ids.filter(id=>id.toLowerCase().includes(input.value.trim().toLowerCase()));
  function render(){
    const allA=filter(q('[data-slot-filter-a]')),allB=filter(q('[data-slot-filter-b]'));
    const a=allA.slice(pageA*size,(pageA+1)*size),b=allB.slice(pageB*size,(pageB+1)*size);
    q('[data-slot-grid-table]').innerHTML=a.length&&b.length?
      '<table><thead><tr><th>A / B</th>'+b.map(id=>'<th scope="col" translate="no">'+esc(id)+'</th>').join('')+'</tr></thead><tbody>'+
      a.map(idA=>'<tr><th scope="row" translate="no">'+esc(idA)+'</th>'+b.map(idB=>{
        const allowed=idA!==idB&&!!pairDirection(plates.get(idA),plates.get(idB)),active=idA===selected.A&&idB===selected.B;
        const label=idA+' / '+idB;
        return '<td><button type="button" data-slot-a="'+esc(idA)+'" data-slot-b="'+esc(idB)+'" aria-label="'+esc(label)+'" title="'+esc(label)+
          '" aria-pressed="'+active+'" '+(allowed?'':'disabled')+'><i aria-hidden="true"></i></button></td>';
      }).join('')+'</tr>').join('')+'</tbody></table>':'<p>No matching plate fields.</p>';
    for(const [side,all,page] of [['a',allA,pageA],['b',allB,pageB]]){
      q('[data-slot-page-'+side+']').textContent=all.length?(page*size+1)+'–'+Math.min(all.length,(page+1)*size)+' / '+all.length:'0';
      q('[data-slot-prev-'+side+']').disabled=page===0;
      q('[data-slot-next-'+side+']').disabled=(page+1)*size>=all.length;
    }
  }
  q('[data-slot-filter-a]').oninput=()=>{pageA=0;render();};
  q('[data-slot-filter-b]').oninput=()=>{pageB=0;render();};
  q('[data-slot-prev-a]').onclick=()=>{pageA--;render();};q('[data-slot-next-a]').onclick=()=>{pageA++;render();};
  q('[data-slot-prev-b]').onclick=()=>{pageB--;render();};q('[data-slot-next-b]').onclick=()=>{pageB++;render();};
  q('[data-slot-grid-table]').onclick=event=>{
    const button=event.target.closest('[data-slot-a]');
    if(button&&!button.disabled)onSelect(button.dataset.slotA,button.dataset.slotB);
  };
  render();
  q('[data-slot-filter-a]').focus();
}
