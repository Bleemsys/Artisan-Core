import {geometryPanel} from './geometry-editor.js';
import {latticePanel} from './lattice-panel.js';
import {transitionPanel} from './transition-panel.js';
import {createTransitionPreview} from './transition-preview.js';
import {transitionKeywords,transitionColours,transitionFieldError,setTransitionNumber,setPlaneAxis,flipPlane} from './transition-model.js';
import {geometryKeywords,geometrySource,geometryOperationError} from './geometry-model.js';
import {slicePanel,parallelSlices} from './slice-panel.js';
import {spatialKeywords,spatialTargets,applySpatialGeometry,newSpatialBox,replaceSpatialShape,axisQuaternion,quaternionGeometry,normalFrame} from './spatial-model.js';
import {cloneNumericJson,assignNumericJson,setNumber,numberText,stringifyNumericJson,parseNumericJson} from './numeric-json.js';
import {geometryError} from './region-model.js';
import * as THREE from './vendor/three.module.js';
// Emit English source strings so the language observer can reverse them too.
const t=s=>s;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const restore=(p,s)=>{for(const k of Object.keys(p))delete p[k];assignNumericJson(p,cloneNumericJson(s));};
const norm=s=>String(s).replace(/^\\\\\?\\/,'').replaceAll('\\','/').replace(/\/\.\//g,'/').replace(/^\.\//,'').toLowerCase();
export function createSpatialEditor({getViewer,getSetup,onChange,onRefresh,loadMesh,browseMesh,latticePicker,browseLattice,getLatticeType=()=>null,getLatticePreviewKey=()=>'',getUsedFieldIds=()=>[],getGeometries=()=>[],onOperationChange=()=>{},onPreview=async()=>{},toast}){
 const states=new WeakMap();let params=null,keyword='',host=null,box=null,state=null,overlay=null,targets=[],regions=[],pending=null,controller=null;
 let miniature=null;
 const context=()=>{
  const viewer=getViewer(),setup=getSetup(),layer=viewer?.layers?.get('source');let domain=setup?.Sample?.Domain;
  if(setup?.Type==='Geometry'&&layer&&norm(layer.path)===norm(setup.Geomfile)){const b=layer.box.clone().translate(viewer.origin);domain=[0,1,2].map(i=>[b.min.getComponent(i),b.max.getComponent(i)]);}
  return {domain,meshBounds:source=>{const l=[...(viewer?.layers?.values()||[])].find(l=>norm(l.path)===norm(source));return l?[l.box.min.clone().add(viewer.origin).toArray(),l.box.max.clone().add(viewer.origin).toArray()]:null;}};
 };
 const current=()=>targets.find(x=>x.id===state?.selected);
 const history=s=>{if(state.previewMessage)state.previewMessage='Settings changed · preview needs update';state.undo.push(cloneNumericJson(s));if(state.undo.length>30)state.undo.shift();};
 function sync(){
  if(!params)return;
  const result=spatialTargets(keyword,params,context());targets=result.targets;
  if(transitionKeywords.includes(keyword))targets.forEach(x=>{x.label=keyword==='Lin_Interpolate'?(x.id==='plane:1'?'Plane A':'Plane B'):keyword==='HS_Interpolate'?'Transition plane':'Attractor';if(x.kind==='plane'){x.geometry.size[0]*=2;x.geometry.size[1]*=2;}});
  if(!current())state.selected=targets[0]?.id;
  const target=current();if(target&&!target.modes.includes(state.mode))state.mode='move';
  regions=targets.map((x,i)=>({name:x.label,geometry:x.geometry,guideKind:x.kind==='plane'?'plane':undefined,previewSource:x.source,...(transitionKeywords.includes(keyword)?{colour:transitionColours[x.id==='plane:2'?1:0]}:{})}));
  if(overlay){overlay.update(regions,targets.indexOf(target),{mode:state.mode,snap:state.snap,hidden:new Set(targets.map((x,i)=>state.hidden.has(x.id)?i:-1).filter(i=>i>=0))});if(!state.visible)overlay.hide();}
  if(target&&state.visible)document.getElementById('viewport-empty')?.classList.add('hidden');
  return result;
 }
 function changed(){if(state.previewMessage)state.previewMessage='Settings changed · preview needs update';onChange();if(transitionKeywords.includes(keyword)||keyword==='Add_Lattice')render();else onRefresh();}
 function syncRaw(){
  host?.querySelectorAll('[data-vector],[data-value],[data-json-value]').forEach(input=>{
   const path=input.dataset.vector||input.dataset.value||input.dataset.jsonValue;if(!path?.startsWith(keyword+'.'))return;
   const keys=path.split('.').slice(1);let parent=params;for(const k of keys.slice(0,-1))parent=parent?.[k];const key=keys.at(-1),v=parent?.[key];if(v===undefined)return;
   if(input.dataset.vector&&Array.isArray(v))input.value=numberText(v,input.dataset.index);
   else if(input.dataset.jsonValue)input.value=stringifyNumericJson(v);
   else if(typeof v==='number')input.value=numberText(parent,key);
  });
  box?.querySelectorAll('[data-transition-number]').forEach(input=>{const keys=input.dataset.transitionNumber.split('.');let parent=params;for(const k of keys.slice(0,-1))parent=parent?.[k];if(Number.isFinite(parent?.[keys.at(-1)]))input.value=numberText(parent,keys.at(-1));});
  const slider=box?.querySelector('[data-transition-radius]');if(slider&&params.r>0){slider.max=Math.max(Number(slider.max),params.r*1.1);slider.value=params.r;}
  miniature?.update(targets,state?.selected,context().domain);
 }
 function edit(g){
  const target=current();if(!target)return;
  const before=cloneNumericJson(params);try{applySpatialGeometry(keyword,params,target,g,state.mode);if(!pending)pending=before;target.geometry=g;regions[targets.indexOf(target)].geometry=g;syncRaw();updateReadout(g);}
  catch(e){restore(params,before);toast(e.message);}
 }
 function commit(){if(!params||!pending)return;history(pending);pending=null;changed();}
 function cancel(){if(params&&pending){restore(params,pending);pending=null;syncRaw();render();}}
 function mutate(fn){const before=cloneNumericJson(params);try{fn();if(state.previewMessage)state.previewMessage='Settings changed · preview needs update';history(before);changed();}catch(e){restore(params,before);toast(e.message);render();}}
 function input(path,label,value){return `<div class="field"><label>${t(label)}</label>${Array.isArray(value)?`<div class="region-vector">${value.map((v,i)=>`<label><span>${'XYZ'[i]}</span><input type="number" step="any" data-spatial-number="${path}.${i}" aria-label="${esc(t(label))} ${'XYZ'[i]}" value="${esc(v)}"></label>`).join('')}</div>`:`<input type="number" step="any" data-spatial-number="${path}" aria-label="${esc(t(label))}" value="${esc(value)}">`}</div>`;}
 function shapeFields(target){
  const g=target.geometry;if(geometryKeywords.includes(keyword)&&g.type==='Sphere')return input('radius','Radius',g.radius)+input('center','Center',g.center);let html=input('center','Position',g.center);
  if(target.kind==='plane')return html+input('normal','Plane normal',new THREE.Vector3(0,0,1).applyQuaternion(axisQuaternion(g)).toArray());
  if(g.type==='Box')html+=input('size','Full dimensions',g.size)+`<details><summary>${t('Orientation')}</summary>${input('rotation_axis','Rotation axis',g.rotation_axis||[0,0,1])}${input('rotation_degrees','Angle (degrees)',g.rotation_degrees||0)}</details>`;
  if(g.type==='Cylinder')html+=input('radius','Radius',g.radius)+input('height','Full height',g.height)+input('axis','Cylinder axis',g.axis);
  if(g.type==='Sphere')html+=input('radius',target.kind==='attractor'?'Influence radius':'Radius',g.radius);
  return html;
 }
 function updateReadout(g){const summary=box?.querySelector('[data-slice-thickness="'+current()?.slice+'"]');if(summary&&g.size)summary.textContent=Number(g.size[2].toPrecision(6));const offset=box?.querySelector('[data-slice-offset]');if(offset&&document.activeElement!==offset)offset.value=new THREE.Vector3(...g.center).dot(new THREE.Vector3(0,0,1).applyQuaternion(axisQuaternion(g)));box?.querySelectorAll('[data-spatial-number]').forEach(el=>{if(document.activeElement===el)return;const path=el.dataset.spatialNumber.split('.');el.value=path.reduce((o,k)=>o?.[k],g)??el.value;});}
 function render(){
  if(!params||!host)return;const lattice=keyword==='Add_Lattice',transition=transitionKeywords.includes(keyword),compact=lattice||transition,scrollTop=host.scrollTop,focusIndex=box?.contains(document.activeElement)?document.activeElement.dataset.transitionFocus:null;const result=sync(),target=current();box?.remove();box=document.createElement('section');box.className='spatial-editor region-section';box.dataset.spatialKeyword=keyword;
  const boolean=['Add_Geometry','Subtract_Geometry','Intersect_Geometry'].includes(keyword),isMesh=boolean&&!params.Source&&params.Name&&!['Box','Sphere','Cylinder'].includes(params.Name);
  box.innerHTML=`<h3>${t('Precision editing')}</h3><p class="field-help">${t('Guides show the operation inputs. Generate the workflow to see the computed result.')}</p>
   ${boolean?`<div class="region-shapes">${['Box','Cylinder','Sphere'].map(type=>`<button type="button" class="button ${params.Name===type&&!params.Source?'selected':''}" data-spatial-shape="${type}">${t(type)}</button>`).join('')}<button type="button" class="button" data-spatial-browse ${browseMesh?'':'disabled'}>${t('Choose mesh…')}</button></div>`:''}
   ${keyword==='Proc_BoxSlices'?`<div class="region-tools"><button type="button" class="button" data-spatial-add>${t('Add slice')}</button><button type="button" class="button" data-spatial-duplicate ${target?'':'disabled'}>${t('Duplicate slice')}</button><button type="button" class="button" data-spatial-remove ${target&&params.Boxes?.length>1?'':'disabled'}>${t('Remove slice')}</button></div>`:''}
   ${targets.length?`<div class="field"><label for="spatial-target">${t('Editing target')}</label><select id="spatial-target" data-spatial-target>${targets.map(x=>`<option translate="${x.kind==='plane'||x.kind==='attractor'?'yes':'no'}" value="${esc(x.id)}" ${x.id===state.selected?'selected':''}>${esc(x.label)}</option>`).join('')}</select></div>`:''}
   ${result.messages.map(e=>`<p class="field-help" role="status">${e.id?`<span translate="no">${esc(e.id)}</span>: `:''}${esc(t(e.message))}</p>`).join('')}
   ${isMesh?`<button type="button" class="button" data-spatial-load>${t('Load source mesh preview')}</button><p class="field-help">${t('The coloured mesh is a transformed preview; the source file stays unchanged.')}</p>`:''}
   ${target?`<p class="field-help">${t('Coordinates and dimensions use the current model units.')}</p>`+shapeFields(target)+`<div class="region-tools" role="group" aria-label="${t('Viewport editing tool')}">${target.modes.map(m=>`<button type="button" class="button ${state.mode===m?'selected':''}" data-spatial-tool="${m}" aria-pressed="${state.mode===m}">${t({move:'Move',resize:'Resize',rotate:'Rotate'}[m])}</button>`).join('')}<button type="button" class="button" data-spatial-fit>${t('Fit guides')}</button><button type="button" class="button" data-spatial-pick>${t('Pick center')}</button></div><div class="region-snap"><label for="spatial-snap">${t('Drag snap')}</label><input id="spatial-snap" data-spatial-snap type="number" min="0" step="any" value="${state.snap}"><span>${t('0 = off · Shift rotates by 15°')}</span></div><label class="project-visible"><input type="checkbox" data-spatial-visible ${state.visible?'checked':''}> ${t('Show editing guides')}</label>`:''}
   ${keyword==='Proc_BoxSlices'||params.Name==='Box'?`<p class="field-help">${t('Full dimensions are shown here. Artisan length values below are half-lengths.')}</p>`:''}
   <div class="region-tools"><button type="button" class="button" data-spatial-undo ${state.undo.length?'':'disabled'}>${t('Undo')}</button><button type="button" class="button" data-spatial-revert>${t('Revert edits')}</button></div>`;
  if(boolean){
   box.classList.add('geometry-editor');
   box.innerHTML=geometryPanel({keyword,params,state,target,shapeFields,messages:result.messages,geometries:getGeometries()});
  }
  if(keyword==='Proc_BoxSlices'){
   box.classList.add('slice-editor');
   box.innerHTML=slicePanel({params,targets,target,state,input,messages:result.messages});
  }
  if(transition){box.classList.add('transition-editor');box.innerHTML=transitionPanel({keyword,params,state,target,messages:result.messages,latticePicker});}
  if(lattice){box.classList.add('transition-editor','lattice-editor');let previewKey='';try{previewKey=getLatticePreviewKey(params);}catch{}box.innerHTML=latticePanel({params,state,target,latticePicker,definitionType:getLatticeType(params),previewKey});}
  host.prepend(box);
  box.querySelector('[data-geometry-tools]')?.addEventListener('toggle',e=>{state.geometryToolsOpen=e.target.open;});
  box.querySelectorAll('[data-geometry-section]').forEach(d=>d.addEventListener('toggle',()=>{(state.geometrySections ||= {})[d.dataset.geometrySection]=d.open;}));
  box.querySelectorAll('[data-geometry-operation]').forEach(b=>b.onclick=()=>{if(b.dataset.geometryOperation!==keyword)onOperationChange(keyword,b.dataset.geometryOperation,params);});
  box.querySelector('[data-geometry-field]')?.addEventListener('change',e=>mutate(()=>{params.push2GeomField=e.target.value==='geometry';}));
  box.querySelectorAll('[data-geometry-tab]').forEach(b=>{
   b.onclick=()=>{state.geometryTab=b.dataset.geometryTab;render();box.querySelector('[data-geometry-tab="'+state.geometryTab+'"]')?.focus();};
   b.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const tabs=[...box.querySelectorAll('[data-geometry-tab]')],i=tabs.indexOf(b);tabs[e.key==='Home'?0:e.key==='End'?tabs.length-1:(i+(e.key==='ArrowRight'?1:tabs.length-1))%tabs.length].click();};
  });
  const changeShape=type=>mutate(()=>{
   state.geometryDrafts ||= new Map();state.geometryDrafts.set(geometrySource(params)==='Primitive'?params.Name:geometrySource(params),cloneNumericJson(params));
   const saved=state.geometryDrafts.get(type);if(saved){delete params.Source;params.Name=saved.Name;params.Paras=cloneNumericJson(saved.Paras);}else replaceSpatialShape(params,type,getSetup()?.Sample?.Domain);
   state.geometryTab='Primitive';state.mode='move';
  });
  box.querySelector('[data-geometry-shape]')?.addEventListener('change',e=>{if(e.target.value)changeShape(e.target.value);});
  const setMesh=path=>{if(!path.trim())throw Error('Choose a mesh or a primitive shape.');
   state.geometryDrafts ||= new Map();state.geometryDrafts.set(geometrySource(params)==='Primitive'?params.Name:geometrySource(params),cloneNumericJson(params));
   const saved=state.geometryDrafts.get('Mesh');delete params.Source;params.Name=path.trim();
   if(saved?.Name===params.Name)params.Paras=cloneNumericJson(saved.Paras);
   else{params.Paras={Scale:[1,1,1],Trans:[0,0,0],Rot:[0,0,0]};for(const a of Object.values(params.Paras))a.forEach((v,i)=>setNumber(a,i,v,'float'));}
   state.geometryTab='Mesh';state.mode='move';
  };
  box.querySelector('[data-geometry-mesh]')?.addEventListener('change',e=>mutate(()=>setMesh(e.target.value)));
  box.querySelector('[data-geometry-project-mesh]')?.addEventListener('change',e=>{if(e.target.value)mutate(()=>setMesh(e.target.value));});
  box.querySelectorAll('[data-geometry-number]').forEach(el=>el.onchange=()=>mutate(()=>{
   const keys=el.dataset.geometryNumber.split('.');let parent=params;
   if(keys[0]==='Paras'){params.Paras ||= {};const k=keys[1];params.Paras[k] ||= k==='Scale'?[1,1,1]:[0,0,0];}
   for(const k of keys.slice(0,-1))parent=parent[k];setNumber(parent,keys.at(-1),el.value,'float');
   const error=geometryOperationError(params);if(error)throw Error(error);
  }));
  box.querySelectorAll('[data-geometry-transition]').forEach(b=>b.onclick=()=>mutate(()=>{
   if(b.dataset.geometryTransition==='sharp'){if(params.k_factor>0)state.smoothing=params.k_factor;setNumber(params,'k_factor',0,'float');}
   else setNumber(params,'k_factor',params.k_factor>0?params.k_factor:state.smoothing||.5,'float');
  }));
  box.querySelector('[data-geometry-preview]')?.addEventListener('click',async()=>{
   const p=params,s=state,k=keyword;s.previewBusy=true;s.previewMessage='Computing preview…';render();
   try{const result=await onPreview(k,p);if(k==='Add_Lattice'&&result?.success&&typeof result.latticePreviewKey==='string')s.latticePreviewKey=result.latticePreviewKey;s.previewMessage=result?.success?(result.previewWarning||'Preview updated'):result?.cancelled?'Preview stopped':'Preview not updated';}
   catch(e){s.previewMessage=String(e.message||e);toast(s.previewMessage);}
   finally{s.previewBusy=false;if(params===p)render();}
  });
  box.querySelector('[data-slice-add-menu]')?.addEventListener('click',()=>{state.addMenu=!state.addMenu;render();});
  box.querySelectorAll('[data-slice-visible]').forEach(el=>el.onchange=()=>{const id='slice:'+el.dataset.sliceVisible;el.checked?state.hidden.delete(id):state.hidden.add(id);sync();});
  box.querySelectorAll('[data-slice-select]').forEach(b=>b.onclick=()=>{state.selected=b.dataset.sliceSelect;state.mode='move';state.custom=false;state.parallel=false;render();});
  box.querySelector('[data-slice-size]')?.addEventListener('toggle',e=>{state.sizeOpen=e.target.open;});
  box.querySelector('[data-slice-source]')?.addEventListener('change',e=>mutate(()=>{params.Source=e.target.value;}));
  box.querySelector('[data-slice-output]')?.addEventListener('change',e=>mutate(()=>{
   params.Target=e.target.value;
   if(params.Target==='FieldContainer')for(const b of params.Boxes||[])if(!b.FieldID)b.FieldID=unique();
  }));
  box.querySelector('[data-slice-outfile]')?.addEventListener('change',e=>mutate(()=>{if(!e.target.value.trim())throw Error('Output file is required.');params.outfile=e.target.value.trim();}));
  box.querySelector('[data-slice-name]')?.addEventListener('change',e=>mutate(()=>{
   const name=e.target.value.trim(),old=params.Boxes[target.slice].FieldID;
   if(name===old)return;
   if(!name||[...getUsedFieldIds(),...params.Boxes.filter((b,i)=>i!==target.slice).map(b=>b.FieldID)].includes(name))throw Error('Choose a nonempty, unique field ID.');
   params.Boxes[target.slice].FieldID=name;
  }));
  box.querySelectorAll('[data-slice-plane]').forEach(b=>b.onclick=()=>{
   const plane=b.dataset.slicePlane;if(plane==='Custom'){state.custom=true;render();return;}
   mutate(()=>{const g=cloneNumericJson(target.geometry);Object.assign(g,quaternionGeometry(normalFrame({XY:[0,0,1],YZ:[1,0,0],ZX:[0,1,0]}[plane],0,true)));applySpatialGeometry(keyword,params,target,g,'rotate');state.custom=false;});
  });
  box.querySelector('[data-slice-offset]')?.addEventListener('change',e=>mutate(()=>{
   const v=Number(e.target.value);if(!e.target.value.trim()||!Number.isFinite(v))throw Error('Position must be a finite number.');
   const g=cloneNumericJson(target.geometry),n=new THREE.Vector3(0,0,1).applyQuaternion(axisQuaternion(g)),c=new THREE.Vector3(...g.center);g.center=c.addScaledVector(n,v-c.dot(n)).toArray();applySpatialGeometry(keyword,params,target,g,'move');
  }));
  box.querySelector('[data-slice-parallel]')?.addEventListener('click',()=>{state.parallel=true;state.addMenu=false;render();});
  box.querySelector('[data-slice-cancel]')?.addEventListener('click',()=>{state.parallel=false;render();});
  box.querySelector('[data-slice-create]')?.addEventListener('click',()=>mutate(()=>{
   const count=Number(box.querySelector('#slice-count').value),spacing=Number(box.querySelector('#slice-spacing').value);
   const template=target?params.Boxes[target.slice]:newSpatialBox(getSetup()?.Sample?.Domain);
   const additions=parallelSlices(template,count,spacing,[...getUsedFieldIds(),...(params.Boxes||[]).map(b=>b.FieldID)],params.outfile===undefined);
   const first=(params.Boxes||[]).length;(params.Boxes ||= []).push(...additions);state.selected='slice:'+first;state.parallel=false;state.mode='move';
  }));
  box.querySelector('[data-spatial-target]')?.addEventListener('change',e=>{state.selected=e.target.value;state.mode='move';render();});
  box.querySelectorAll('[data-spatial-tool]').forEach(b=>b.onclick=()=>{state.mode=b.dataset.spatialTool;render();});
  box.querySelectorAll('[data-spatial-shape]').forEach(b=>b.onclick=()=>{if(params.Name===b.dataset.spatialShape&&!params.Source)return;mutate(()=>replaceSpatialShape(params,b.dataset.spatialShape,getSetup()?.Sample?.Domain));});
  box.querySelector('[data-spatial-browse]')?.addEventListener('click',async()=>{const p=params;try{const path=await browseMesh?.();if(!path||params!==p)return;if(params.Name!==path||params.Source)mutate(()=>setMesh(path));await loadMesh(path);if(params===p)render();}catch(e){toast(e.message);}});
  box.querySelector('[data-spatial-fit]')?.addEventListener('click',()=>{state.visible=true;render();overlay?.frame(compact?{guidesOnly:true}:undefined);});
  box.querySelector('[data-spatial-pick]')?.addEventListener('click',()=>{state.mode='move';state.visible=true;state.hidden.delete(state.selected);render();overlay?.pickCenter();});
  box.querySelector('[data-spatial-visible]')?.addEventListener('change',e=>{state.visible=e.target.checked;sync();});
  box.querySelector('[data-spatial-snap]')?.addEventListener('change',e=>{const n=Number(e.target.value);if(e.target.value.trim()&&Number.isFinite(n)&&n>=0){state.snap=n;sync();}else e.target.value=state.snap;});
  box.querySelector('[data-spatial-load]')?.addEventListener('click',async e=>{const p=params,source=p.Name;try{e.target.disabled=true;await loadMesh(source);if(params===p)render();}catch(error){toast(error.message);}finally{if(params===p&&e.target.isConnected)e.target.disabled=false;}});
  box.querySelector('[data-spatial-undo]').onclick=()=>{const old=state.undo.pop();if(old){restore(params,old);if(compact)state.transitionLinked=params.size?.every(v=>v===params.size[0])??false;state.hidden.clear();changed();}};
  box.querySelector('[data-spatial-revert]').onclick=()=>mutate(()=>{restore(params,state.baseline);state.hidden.clear();});
  function unique(){const used=new Set([...getUsedFieldIds(),...(params.Boxes||[]).map(b=>b.FieldID)]);let i=1;while(used.has('Slice'+i))i++;return 'Slice'+i;}
  box.querySelector('[data-spatial-add]')?.addEventListener('click',()=>mutate(()=>{const b={...newSpatialBox(getSetup()?.Sample?.Domain)};if(params.outfile===undefined)b.FieldID=unique();(params.Boxes ||= []).push(b);state.addMenu=false;state.selected='slice:'+(params.Boxes.length-1);state.mode='move';}));
  box.querySelector('[data-spatial-duplicate]')?.addEventListener('click',()=>mutate(()=>{const b=cloneNumericJson(params.Boxes[target.slice]);if(params.outfile===undefined)b.FieldID=unique();else delete b.FieldID;params.Boxes.push(b);state.selected='slice:'+(params.Boxes.length-1);}));
  box.querySelector('[data-spatial-remove]')?.addEventListener('click',()=>mutate(()=>{if(params.Boxes.length>1){params.Boxes.splice(target.slice,1);state.hidden=new Set([...state.hidden].map(id=>Number(id.split(':')[1])).filter(i=>i!==target.slice).map(i=>'slice:'+(i>target.slice?i-1:i)));}}));
  box.querySelectorAll('[data-spatial-number]').forEach(el=>el.onchange=()=>{
   const g=cloneNumericJson(current().geometry),keys=el.dataset.spatialNumber.split('.'),before=cloneNumericJson(params),oldMode=state.mode;
   try{if(keys[0]==='normal'){const n=new THREE.Vector3(0,0,1).applyQuaternion(axisQuaternion(g)).toArray();setNumber(n,keys[1],el.value,'float');if(!Math.hypot(...n))throw Error('Plane needs a finite point and a nonzero normal.');Object.assign(g,quaternionGeometry(normalFrame(n,0,true)));}
    else{let o=g;for(const k of keys.slice(0,-1))o=o[k];setNumber(o,keys.at(-1),el.value,'float');}
    state.mode=keys[0]==='center'?'move':['radius','height','size'].includes(keys[0])?'resize':'rotate';const error=geometryError(g);if(error)throw Error(error);applySpatialGeometry(keyword,params,current(),g,state.mode);history(before);state.mode=oldMode;changed();
   }catch(e){restore(params,before);toast(e.message);render();}finally{state.mode=oldMode;}
  });
  if(compact){
   bindTransition();
   const controls=[...box.querySelectorAll('button,input,select,textarea,summary')];controls.forEach((el,i)=>el.dataset.transitionFocus=String(i));
   if(focusIndex!==undefined&&focusIndex!==null){const el=controls[Number(focusIndex)];if(el&&!el.disabled)el.focus({preventScroll:true});}
   host.scrollTop=scrollTop;
   box.onkeydown=e=>{if(e.key!=='Tab'||!e.target.matches('input,select,textarea'))return;const visible=controls.filter(el=>!el.disabled&&el.getClientRects().length),next=visible[visible.indexOf(e.target)+(e.shiftKey?-1:1)]?.dataset.transitionFocus;if(next===undefined)return;e.preventDefault();e.target.blur();box.querySelector(`[data-transition-focus="${next}"]`)?.focus();};
  }
 }
 function bindTransition(){
  const $=selector=>box.querySelector(selector);
  const activeNormal=()=>keyword==='Lin_Interpolate'?(state.selected==='plane:2'?'n_vec_02':'n_vec_01'):'n_vec';
  const select=id=>{state.selected=id;state.mode='move';state.visible=true;state.hidden.delete(id);render();};
  const placeholder=$('.transition-guide canvas');
  if(placeholder){
   if(miniature)placeholder.replaceWith(miniature.canvas);else miniature=createTransitionPreview(placeholder,select);
   miniature?.update(targets,state.selected,context().domain);
   if(!miniature){placeholder.hidden=true;placeholder.parentElement.classList.add('unavailable');placeholder.parentElement.querySelector('span').textContent='Use the 3D workspace to inspect the input guide.';}
  }
  box.querySelectorAll('[data-transition-tab]').forEach(button=>{
   button.onclick=()=>{state.transitionTab=button.dataset.transitionTab;render();$(`[data-transition-tab="${state.transitionTab}"]`)?.focus();};
   button.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const tabs=[...box.querySelectorAll('[data-transition-tab]')],i=tabs.indexOf(button);tabs[e.key==='Home'?0:e.key==='End'?tabs.length-1:(i+(e.key==='ArrowRight'?1:tabs.length-1))%tabs.length].click();};
  });
  $('[data-transition-lattice-edit]').onclick=()=>{state.transitionTab='Lattice';render();$('[data-lattice-select], [data-transition-name]')?.focus();};
  box.querySelectorAll('[data-transition-target]').forEach(button=>button.onclick=()=>select(button.dataset.transitionTarget));
  $('[data-transition-edit]')?.addEventListener('click',()=>{state.visible=true;state.transitionToolsOpen=true;render();overlay?.frame({guidesOnly:true});$('.transition-tools-details')?.scrollIntoView?.({block:'nearest'});const label=current()?.label;const handle=[...document.querySelectorAll('.region-labels button')].find(el=>el.textContent===label);handle?.focus({preventScroll:true});});
  box.querySelectorAll('[data-transition-pick]').forEach(button=>button.onclick=()=>{select(button.dataset.transitionPick);overlay?.pickCenter();});
  box.querySelectorAll('[data-transition-number]').forEach(input=>input.onchange=()=>mutate(()=>setTransitionNumber(params,input.dataset.transitionNumber,input.value,{linked:state.transitionLinked})));
  $('[data-transition-link]')?.addEventListener('click',()=>{if(state.transitionLinked){state.transitionLinked=false;render();}else mutate(()=>{setTransitionNumber(params,'size.0',params.size?.[0],{linked:true});state.transitionLinked=true;});});
  box.querySelectorAll('[data-transition-axis]').forEach(button=>button.onclick=()=>{if(button.dataset.transitionAxis==='Custom'){$(`[data-transition-number="${activeNormal()}.0"]`)?.focus();return;}mutate(()=>setPlaneAxis(params,activeNormal(),button.dataset.transitionAxis));});
  $('[data-transition-flip]')?.addEventListener('click',()=>mutate(()=>flipPlane(params,activeNormal())));
  box.querySelectorAll('[data-transition-option]').forEach(input=>input.onchange=()=>mutate(()=>{params[input.dataset.transitionOption]=input.checked;}));
  $('[data-transition-name]')?.addEventListener('change',e=>mutate(()=>{params.la_name=e.target.value.trim();const issue=transitionFieldError('la_name',params);if(issue)throw Error(issue);}));
  $('[data-lattice-select]')?.addEventListener('change',e=>{const input=$('[data-transition-name]');input.style.display=e.target.value?'none':'';if(e.target.value){input.value=e.target.value;input.dispatchEvent(new input.ownerDocument.defaultView.Event('change',{bubbles:true}));}else input.focus();});
  $('[data-transition-browse]')?.addEventListener('click',async()=>{const original=params;try{const path=await browseLattice?.();if(path&&params===original)mutate(()=>{params.la_name=path;});}catch(e){toast(e.message||String(e));}});
  $('.transition-advanced').addEventListener('toggle',e=>state.transitionAdvanced=e.target.open);
  $('.transition-tools-details')?.addEventListener('toggle',e=>state.transitionToolsOpen=e.target.open);
  $('[data-transition-request]').onchange=e=>mutate(()=>{const next=parseNumericJson(e.target.value);const issue=transitionFieldError('Cube_Request',{Cube_Request:next});if(issue)throw Error(issue);params.Cube_Request=next;});
  const slider=$('[data-transition-radius], [data-lattice-thickness]');if(slider){
   slider.oninput=()=>{pending ||= cloneNumericJson(params);setNumber(params,slider.hasAttribute('data-lattice-thickness')?'thk':'r',slider.value,'float');sync();syncRaw();const numeric=$('[data-transition-number=thk]');if(numeric)numeric.value=numberText(params,'thk');};
   slider.onchange=()=>commit();
   slider.onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();cancel();}};
   slider.onpointercancel=()=>cancel();
  }
 }
 return {
  attachOverlay(o){overlay=o;if(params)render();},
  show(element,k,p){const different=params!==p;if(different&&params) this.hide();host=element;params=p;if(keyword!==k&&state)state.previewMessage='';keyword=k;if(!states.has(p))states.set(p,{selected:null,mode:'move',snap:0,visible:true,hidden:new Set(),undo:[],baseline:cloneNumericJson(p),transitionTab:k==='Add_Lattice'?'Lattice':'Transition',transitionLinked:p.size?.every(v=>v===p.size[0])??false});state=states.get(p);if(geometryKeywords.includes(k)){const source=geometrySource(p);if(state.geometryTab===undefined||source!==state.lastGeometrySource)state.geometryTab=source;state.lastGeometrySource=source;}render();controller?.abort();controller=new AbortController();
   // Capture snapshots before the existing raw-parameter handlers run.
   host.addEventListener('change',e=>{if(!e.target.closest('.spatial-editor'))history(params);},{capture:true,signal:controller.signal});
   // Bubble after the raw input's existing handler, so its value is committed
   // before guides rebuild. A capture-phase microtask can run too early for
   // trusted browser events and overwrite the value being committed.
   host.addEventListener('change',e=>{if(!e.target.closest('.spatial-editor')&&params===p){render();syncRaw();}},{signal:controller.signal});
   if(different&&targets.length)overlay?.frame();
  },
  hide(){overlay?.hide();controller?.abort();miniature?.dispose();miniature=null;params=null;host=null;box=null;pending=null;targets=[];regions=[];},
  refresh(){if(params)render();},select(i){if(targets[i]){state.selected=targets[i].id;state.mode='move';render();}},drag:edit,commit,cancel,
  supports:k=>spatialKeywords.includes(k),
 };
}
