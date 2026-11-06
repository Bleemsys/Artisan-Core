import {operationIcon} from './operation-icons.js';
import {cloneNumericJson,assignNumericJson,setNumber,numberText} from './numeric-json.js';
import {domainGeometry,setDomainGeometry,selectSetupSource,setSpacing,validDomain,validVector,samplingError,setupError,memoryBytes} from './setup-model.js';

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const restore=(o,copy)=>{for(const k of Object.keys(o))delete o[k];assignNumericJson(o,cloneNumericJson(copy));};
export function createSetupEditor({getViewer,getMeshBounds,onChange,browseMesh,loadMesh,toast,renderExtra=()=>'',bindExtra=()=>{}}){
 const states=new WeakMap();let setup=null,post=null,host=null,state=null,overlay=null,pending=null,suspended=false;
 const $=s=>host?.querySelector(s);
 const snapshot=()=>({setup:cloneNumericJson(setup),post:cloneNumericJson(post)});
 const focusAttributes=['id','data-setup-bound','data-setup-number','data-setup-post','data-setup-source','data-setup-link','data-setup-device','data-setup-path-mode','data-setup-workdir','data-setup-mesh','data-setup-browse','data-setup-undo','data-setup-fit'];
 function focusToken(el){if(el?.tagName==='SUMMARY'&&el.parentElement.dataset.setupSection)return ['summary',el.parentElement.dataset.setupSection];const key=focusAttributes.find(k=>el?.hasAttribute(k));return key?[key,el.getAttribute(key)]:null;}
 function focusTarget(token){if(!token)return null;const [key,value]=token;return key==='summary'?host.querySelector(`[data-setup-section="${value}"] > summary`):[...host.querySelectorAll(`[${key}]`)].find(el=>el.getAttribute(key)===value);}
 function record(previous){state.undo.push(previous);if(state.undo.length>30)state.undo.shift();}
 function currentDomain(){return setup.Type==='Sample'?setup.Sample?.Domain:getMeshBounds(setup.Geomfile);}
 function sync(){
  if(!setup)return;
  const d=currentDomain(),g=domainGeometry(d);
  overlay?.update(g,{editable:!!host&&!suspended&&setup.Type==='Sample',passive:!host||suspended,mode:state.mode,snap:state.snap,visible:state.guides,res:setup.res,padding:setup.Padding});
  if(host&&!suspended&&g&&setup.Type==='Sample'&&state.guides&&overlay&&!state.framed){state.framed=true;overlay.frame();}
  if(g&&state.guides)document.getElementById('viewport-empty')?.classList.add('hidden');
 }
 function bindSetup(s,p){
  setup=s;post=p;
  if(!states.has(s))states.set(s,{sections:{domain:true,sampling:true,compute:false,output:false},linked:s.res?.every(n=>n===s.res[0])??false,guides:true,snap:0,mode:'resize',undo:[],customPath:typeof s.JsonWorkDir==='string'?s.JsonWorkDir:''});
  state=states.get(s);
 }
 function mutate(fn){const before=snapshot();try{fn();record(before);onChange();render();}catch(e){restore(setup,before.setup);restore(post,before.post);render();const alert=$('[data-setup-error]');if(alert)alert.textContent=e.message;toast(e.message);}}
 const num=(path,label,value,extra='')=>`<div class="field"><label for="setup-${path.replaceAll('.','-')}">${label}</label><input id="setup-${path.replaceAll('.','-')}" data-setup-number="${path}" type="number" step="any" value="${esc(value)}" ${extra}></div>`;
 function vectors(key,label,values){return `<div class="field"><label>${label}</label><div class="setup-vector">${['X','Y','Z'].map((a,i)=>`<label><span>${a}</span><input data-setup-number="${key}.${i}" aria-label="${label} ${a}" type="number" step="any" value="${esc(values?.[i])}"></label>`).join('')}</div></div>`;}
 function toggle(key,label,help=''){return `<div class="setup-toggle"><label><input type="checkbox" data-setup-post="${key}" ${post[key]?'checked':''}><span>${label}</span></label>${help?`<p class="field-help">${help}</p>`:''}</div>`;}
 function render(){
  if(!setup||!host)return;
  const scrollTop=host.scrollTop,active=document.activeElement;
  const focus=host.contains(active)?focusToken(active):null;
  const s=setup,st=state,isBox=s.Type==='Sample',d=currentDomain(),g=domainGeometry(d),error=setupError(s),spacing=s.res||[];
  const section=(key,n,title,summary,body)=>`<details class="setup-section" data-setup-section="${key}" ${st.sections[key]?'open':''}><summary><span class="setup-number" aria-hidden="true">${n}</span><span><strong>${title}</strong><small>${summary}</small></span></summary><div class="setup-section-body">${body}</div></details>`;
  const bounds=isBox?`<table class="setup-bounds"><thead><tr><th>Axis</th><th>Minimum</th><th>Maximum</th></tr></thead><tbody>${['X','Y','Z'].map((a,i)=>`<tr><th scope="row">${a}</th>${[0,1].map(side=>`<td><input data-setup-bound="${i}.${side}" aria-label="${a} ${side?'maximum':'minimum'}" type="number" step="any" value="${esc(s.Sample?.Domain?.[i]?.[side]??0)}"></td>`).join('')}</tr>`).join('')}</tbody></table>`:g?`<table class="setup-bounds"><thead><tr><th>Axis</th><th>Minimum</th><th>Maximum</th></tr></thead><tbody>${['X','Y','Z'].map((a,i)=>`<tr><th>${a}</th><td translate="no">${esc(Number(d[i][0].toPrecision(7)))}</td><td translate="no">${esc(Number(d[i][1].toPrecision(7)))}</td></tr>`).join('')}</tbody></table>`:'<p class="field-help">Load the source mesh to see its bounds.</p>';
  const source=`<div class="field"><label>Source</label><div class="setup-sources" role="group" aria-label="Domain source">${[['Geometry','Mesh'],['Sample','Box domain']].map(([v,label])=>`<button class="button ${s.Type===v?'selected':''}" type="button" data-setup-source="${v}" aria-pressed="${s.Type===v}">${label}</button>`).join('')}</div></div>`+
   (!isBox?`<div class="field"><label for="setup-mesh">Source mesh</label><div class="path-row"><input id="setup-mesh" data-setup-mesh type="text" value="${esc(s.Geomfile||'')}"><button type="button" class="icon-button" data-setup-browse aria-label="Browse source mesh">${operationIcon('file-input')}</button></div></div>${s.Geomfile?'<button type="button" class="button" data-setup-load>Load source preview</button>':''}`:'')+bounds+
   (g?`<p class="setup-dimensions"><span>Dimensions</span> <span data-setup-dimensions translate="no">${g.size.map(n=>Number(n.toPrecision(7))).join(' × ')}</span> <span>· model units</span></p>`:'')+
   `<p class="field-help">${isBox?'Bounds update as you drag.':'Bounds come from the source mesh. Padding adds grid layers around them.'}</p>`+
   `<details class="setup-rotation" ${st.rotation?'open':''}><summary>Rotation</summary>${vectors('Rot','Setup rotation (radians)',s.Rot||[0,0,0])}<p class="field-help">Preview bounds are shown before setup rotation. Artisan applies rotation during generation.</p></details>`+
   `<div class="setup-view-controls"><label><input type="checkbox" data-setup-guides ${st.guides?'checked':''}> Show domain guides</label>${isBox?`<label>Drag snap<input data-setup-snap type="number" min="0" step="any" value="${st.snap}"></label>`:''}</div>`;
  const sampling=`<div class="setup-spacing-label"><label>Grid spacing <span class="field-help">(model units)</span></label><button type="button" class="button ${st.linked?'selected':''}" data-setup-link aria-pressed="${st.linked}">${operationIcon('network')}<span>Link X Y Z</span></button></div>${vectors('res','Grid spacing',spacing)}<p class="field-help">Smaller spacing captures finer detail.</p><div class="setup-padding">${num('Padding','Padding',s.Padding,'min="0"')}<span>grid layers</span></div><p class="field-help">Lattice cell size is set in lattice operations.</p><p class="field-help">The viewport grid guide is simplified for display.</p>`;
  const paths=typeof s.JsonWorkDir==='string'?'custom':s.JsonWorkDir?'workflow':'launch';
  const compute=`<div class="field"><label for="setup-device">Compute device</label><select id="setup-device" data-setup-device><option value="cpu" ${s.onGPU?'':'selected'}>CPU</option><option value="gpu" ${s.onGPU?'selected':''}>GPU</option></select><p class="field-help">GPU support depends on the selected backend and operation.</p></div><div class="setup-memory">${num('memorylimit','Memory budget',s.memorylimit/1073741824,'min="0"')}<span>GiB</span></div><p class="field-help">A partitioning budget, not a guaranteed peak memory limit.</p><div class="field"><label for="setup-path-mode">Resolve relative paths from</label><select id="setup-path-mode" data-setup-path-mode><option value="workflow" ${paths==='workflow'?'selected':''}>Workflow folder</option><option value="launch" ${paths==='launch'?'selected':''}>Launch folder</option><option value="custom" ${paths==='custom'?'selected':''}>Custom folder</option></select></div>${paths==='custom'?`<div class="field"><label for="setup-workdir">Working folder</label><input id="setup-workdir" type="text" data-setup-workdir value="${esc(s.JsonWorkDir)}"></div>`:''}`;
  const output=toggle('CombineMeshes','Combine meshes')+toggle('CleanExportedMesh','Clean exported mesh','Merge duplicate vertices and remove degenerate triangles. Holes are not repaired.')+toggle('RemovePartitionMeshFile','Remove partition mesh files')+toggle('RemoveIsolatedParts','Remove isolated parts')+toggle('ExportLazPts','Export LAZ points')+renderExtra(s,post);
  host.innerHTML=`<div class="guided-setup">${section('domain',1,'Domain',isBox?'Box domain':'Mesh domain',source)}${section('sampling',2,'Sampling','Set the sampling resolution',sampling)}${section('compute',3,'Compute',`<span>${s.onGPU?'GPU':'CPU'}</span><span translate="no"> · ${Number((s.memorylimit/1073741824).toPrecision(6))} GiB</span>`,compute)}${section('output',4,'Output & cleanup',post.CombineMeshes?'Combine meshes':'Separate meshes',output)}<p class="setup-error" data-setup-error role="alert">${esc(error)}</p><div class="setup-actions"><button type="button" class="button" data-setup-undo ${st.undo.length?'':'disabled'}>Undo</button><button type="button" class="button primary" data-setup-fit ${g?'':'disabled'}>${operationIcon('scan')}<span>Fit domain</span></button></div></div>`;
  host.querySelectorAll('[data-setup-section]').forEach(el=>el.addEventListener('toggle',()=>st.sections[el.dataset.setupSection]=el.open));
  $('.setup-rotation').addEventListener('toggle',e=>st.rotation=e.target.open);
  host.querySelectorAll('[data-setup-source]').forEach(b=>b.onclick=()=>{if(s.Type===b.dataset.setupSource)return;mutate(()=>selectSetupSource(s,b.dataset.setupSource,getMeshBounds(s.Geomfile)));});
  host.querySelectorAll('[data-setup-bound]').forEach(input=>input.onchange=()=>mutate(()=>{
   const [axis,side]=input.dataset.setupBound.split('.').map(Number);s.Sample ||= {Shape:'Box'};s.Sample.Domain ||= [[0,0],[0,0],[0,0]];const pair=s.Sample.Domain[axis] ||= [0,0];
   setNumber(pair,side,input.value,'float');if(pair[1]<=pair[0])throw Error('Each maximum bound must be greater than its minimum.');
  }));
  host.querySelectorAll('[data-setup-number]').forEach(input=>input.onchange=()=>mutate(()=>{
   const [key,index]=input.dataset.setupNumber.split('.');
   if(key==='res'){setSpacing(s,Number(index),input.value,st.linked);return;}
   if(key==='memorylimit'){setNumber(s,key,memoryBytes(input.value),'integer');return;}
   if(key==='Padding'){setNumber(s,key,input.value,'integer');if(s.Padding<0)throw Error('Padding must be a nonnegative number of grid layers.');return;}
   s[key] ||= [0,0,0];setNumber(s[key],index,input.value,'float');
  }));
  $('[data-setup-link]').onclick=()=>{if(st.linked){st.linked=false;render();}else mutate(()=>{setSpacing(s,0,s.res?.[0],true);st.linked=true;});};
  $('[data-setup-device]').onchange=e=>mutate(()=>{s.onGPU=e.target.value==='gpu';});
  $('[data-setup-path-mode]').onchange=e=>{const mode=e.target.value;mutate(()=>{s.JsonWorkDir=mode==='custom'?st.customPath||'':mode==='workflow';});};
  if($('[data-setup-workdir]'))$('[data-setup-workdir]').onchange=e=>mutate(()=>{s.JsonWorkDir=e.target.value.trim();st.customPath=s.JsonWorkDir;});
  host.querySelectorAll('[data-setup-post]').forEach(el=>el.onchange=()=>mutate(()=>{post[el.dataset.setupPost]=el.checked;}));
  const setMesh=path=>mutate(()=>{s.Geomfile=path;s.Type='Geometry';});
  if($('[data-setup-mesh]'))$('[data-setup-mesh]').onchange=e=>setMesh(e.target.value.trim());
  if($('[data-setup-browse]'))$('[data-setup-browse]').onclick=async()=>{const original=setup;try{const path=await browseMesh();if(!path||setup!==original||!host)return;setMesh(path);await loadMesh(path);}catch(e){toast(e.message||String(e));}};
  if($('[data-setup-load]'))$('[data-setup-load]').onclick=async()=>{try{await loadMesh(s.Geomfile);}catch(e){toast(e.message||String(e));}};
  $('[data-setup-guides]').onchange=e=>{st.guides=e.target.checked;sync();};
  if($('[data-setup-snap]'))$('[data-setup-snap]').onchange=e=>{const n=Number(e.target.value);if(!e.target.value.trim()||!Number.isFinite(n)||n<0){e.target.value=st.snap;return;}st.snap=n;sync();};
  $('[data-setup-fit]').onclick=()=>{st.guides=true;render();overlay?.frame();};
  $('[data-setup-undo]').onclick=()=>{const previous=st.undo.pop();if(previous){restore(s,previous.setup);restore(post,previous.post);st.linked=s.res?.every(n=>n===s.res[0]);onChange();render();}};
  bindExtra();sync();
  const focused=focusTarget(focus);if(focused&&!focused.disabled)focused.focus({preventScroll:true});
  host.scrollTop=scrollTop;
  // Commit a field before moving focus: a change may replace the old form nodes.
  host.onkeydown=e=>{
   if(e.key!=='Tab'||!e.target.matches('input,select,textarea'))return;
   const controls=[...host.querySelectorAll('input,select,textarea,button,summary')].filter(el=>!el.disabled&&el.getClientRects().length);
   const next=focusToken(controls[controls.indexOf(e.target)+(e.shiftKey?-1:1)]);if(!next)return;
   e.preventDefault();e.target.blur();focusTarget(next)?.focus();
  };
 }
 return {
  show(element,s,p){if(setup!==s&&setup)this.hide();host=element;bindSetup(s,p);render();},
  showGuides(s,p){if(setup!==s&&setup)this.hide();if(pending)this.cancel();if(host)host.onkeydown=null;host=null;bindSetup(s,p);sync();},
  hide(){overlay?.hide();if(host)host.onkeydown=null;setup=null;post=null;host=null;pending=null;},
  attachOverlay(o){overlay=o;if(setup)sync();},
  refresh(){if(host)render();else sync();},
  suspend(value){suspended=value;sync();},
  tool(mode){if(!host||suspended||!setup||setup.Type!=='Sample'||!['move','resize'].includes(mode))return;state.mode=mode;sync();},
  drag(g){if(!host||suspended||!setup||setup.Type!=='Sample')return;pending ||= snapshot();setDomainGeometry(setup,g);host?.querySelectorAll('[data-setup-bound]').forEach(input=>{const [a,b]=input.dataset.setupBound.split('.');input.value=numberText(setup.Sample.Domain[a],b);});const dims=$('[data-setup-dimensions]');if(dims)dims.textContent=g.size.map(n=>Number(n.toPrecision(7))).join(' × ');},
  commit(){if(!pending||!setup)return;record(pending);pending=null;onChange();render();},
  cancel(){if(!pending||!setup)return;restore(setup,pending.setup);restore(post,pending.post);pending=null;render();},
 };
}
