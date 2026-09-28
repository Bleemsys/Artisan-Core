import {openOperationPicker} from './operation-picker.js';
import {operationIcon,iconLicense} from './operation-icons.js';
import {createRunProgress} from './run-progress.js';
import {integratedGroups,integratedNames,definitionTypes,isMeshType,definitionTemplate,definitionError,latticeReferences} from './lattice-schema.js';
import {parseNumericJson, stringifyNumericJson, cloneNumericJson, assignNumericJson, numberType, numberText, setNumber} from './numeric-json.js';

// Load the viewer after the editor is ready so a graphics dependency failure
// cannot prevent file dialogs and workflow buttons from being connected.
let viewerReady = Promise.resolve();

(() => {
  const invoke = window.__TAURI__?.core?.invoke;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clone = cloneNumericJson;
  let applyLatticeDraft=null;
  const presetSelections = new WeakMap();
  const fileIssues = new Map();
  const defaultSetup = parseNumericJson('{"Type":"Geometry","Sample":{"Domain":[[0.0,0.0],[0.0,0.0],[0.0,0.0]],"Shape":"Box"},"Geomfile":"","Rot":[0.0,0.0,0.0],"res":[5.0,5.0,5.0],"Padding":4,"onGPU":false,"JsonWorkDir":true,"memorylimit":1073741824000}');
  const defaultPost = {CombineMeshes:true,RemovePartitionMeshFile:false,RemoveIsolatedParts:true,ExportLazPts:false};
  let doc = {Setup:clone(defaultSetup),WorkFlow:{},PostProcess:clone(defaultPost)};
  let currentPath = '', selected = null, dirty = false, toastTimer, previewWorker = null, previewAbort = null, previewCancelReject = null, previewProgressUnlisten = null, activePreviewJob = '', previewRequest = 0, loadedGeometryPath = '', loadedPreviewMode = '', loadedLayerId = 'source', viewer = null, backendPath = localStorage.getItem('artisan.backend') || '';

  let pythonPath=localStorage.getItem('artisan.python')||'';
  let preparingGeneration=false;
  const runProgress=createRunProgress({invoke,labelFor:titleFor,listen:window.__TAURI__?.event?.listen,toast,onBusy:busy=>{
    document.querySelectorAll('.project-panel,.properties-panel,.workflow-controls').forEach(el=>el.inert=busy);
    for(const id of ['new-project','open-project','save-project','json-button','choose-backend','load-geometry','empty-load','load-result'])$(id).disabled=busy;
  }});

  function markDirty(){dirty=true;$('dirty-state').textContent='Unsaved changes';$('project-name').textContent=currentPath?currentPath.split(/[\\/]/).pop():'Untitled workflow';refreshTree();refreshTimeline();}
  function stepKeys(){return Object.keys(doc.WorkFlow||{}).sort((a,b)=>Number(a)-Number(b));}
  function selectedStep(){return selected && doc.WorkFlow[selected] ? doc.WorkFlow[selected] : null;}
  function stepTitle(key){const s=doc.WorkFlow[key]||{};return Object.keys(s)[0]||'Operation';}
  function titleFor(k){const label=(window.ARTISAN_OPERATIONS||[]).find(o=>o.keyword===k)?.label;if(label)return label;return k.replace(/_/g,' ').replace(/([a-z])([A-Z])/g,'$1 $2').replace(/\bOp\b/g,'Field').trim();}
  function human(v){if(Array.isArray(v))return v.join(' × ');if(v&&typeof v==='object')return Object.keys(v).length?`${Object.keys(v).length} parameters`:'…';return String(v);}
  function toast(message){const el=$('toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2600);}
  function setStatus(text,busy=false){$('status-text').textContent=text;$('run-dot').classList.toggle('online',!busy&&text.toLowerCase().includes('ready'));}
  function nameForPath(p){return String(p||'').split(/[\\/]/).pop()||'No geometry selected';}
  function workflowJson(value=doc){return stringifyNumericJson(value)+'\n';}
  function normalizeWorkflow(value){
    if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Root must be a JSON object.');
    for(const key of ['Setup','WorkFlow','PostProcess'])if(value[key]!==undefined&&(!value[key]||typeof value[key]!=='object'||Array.isArray(value[key])))throw Error(`${key} must be a JSON object.`);
    for(const step of Object.values(value.WorkFlow||{})){
      if(!step||typeof step!=='object'||Array.isArray(step))throw Error('Each workflow step must be a JSON object.');
      for(const params of Object.values(step))if(!params||typeof params!=='object'||Array.isArray(params))throw Error('Operation parameters must be a JSON object.');
    }
    const result=assignNumericJson({},value);
    result.Setup=assignNumericJson(clone(defaultSetup),value.Setup||{});
    // Missing on import means disabled, regardless of the new-project defaults.
    if(!Object.hasOwn(value.Setup||{},'JsonWorkDir'))result.Setup.JsonWorkDir=false;
    result.WorkFlow=value.WorkFlow||{};
    result.PostProcess=assignNumericJson(clone(defaultPost),value.PostProcess||{});
    if(value.ArtGUI!==undefined){
      const state=value.ArtGUI;
      if(!state||typeof state!=='object'||state.version!==1)throw Error('Unsupported ArtGUI project metadata.');
      const ids=new Set(['source']);
      for(const key of ['geometry','supportingFiles']){
        if(!Array.isArray(state[key]))throw Error('Invalid project file list.');
        for(const f of state[key]){if(!f||typeof f.id!=='string'||! /^(result|geometry-[a-z0-9-]+|support-[a-z0-9-]+)$/.test(f.id)||ids.has(f.id)||typeof f.path!=='string'||!f.path.trim())throw Error('Invalid or duplicate project file reference.');ids.add(f.id);}
      }
    }
    return result;
  }
  function parameterPresetControl(keyword,params){
    const op=(window.ARTISAN_OPERATIONS||[]).find(o=>o.keyword===keyword);
    if(!op)return '';
    const current=presetSelections.get(params)??-1;
    return `<div class="field"><label>Example preset</label><select data-preset="${esc(keyword)}"><option value="-1" ${current<0?'selected':''}>Current parameters</option>${op.presets.map((preset,i)=>`<option value="${i}" ${current===i?'selected':''}>${esc(preset.label)}</option>`).join('')}</select><span class="field-help">Choosing an example replaces this operation’s parameters. Check its file paths before generating.</span></div>`;
  }

  function latticeDefinitions(){return stepKeys().filter(k=>doc.WorkFlow[k]?.Define_Lattice).map(key=>({key,params:doc.WorkFlow[key].Define_Lattice}));}
  function latticeTree(){
    const definitions=latticeDefinitions(),refs=[...new Set(latticeReferences(doc).map(r=>r.value).filter(v=>/\.(txt|mld)$/i.test(v)))];
    return [true,false].map(mesh=>`<div class="tree-group"><div class="project-group-heading"><span class="tree-label">${mesh?'Mesh / Conformal lattices':'Custom unit cells'}</span><button class="text-button" data-new-lattice="${mesh?'mesh':'cell'}" aria-label="Add ${mesh?'mesh or conformal lattice':'custom unit cell'}">＋ Add</button></div>${definitions.filter(({params})=>isMeshType(params.definition?.type)===mesh).map(({key,params})=>`<button class="tree-item project-file ${selected===key?'active':''}" data-lattice-step="${esc(key)}"><span class="project-file-text"><strong>${esc(params.la_name)}</strong><small>${esc(definitionTypes[params.definition?.type]||params.definition?.type||'Definition')}</small></span></button>`).join('')}${refs.filter(v=>/\.mld$/i.test(v)===mesh).map(v=>`<button class="tree-item project-file" data-lattice-reference="${esc(v)}" title="${esc(v)}"><span class="project-file-text"><strong>${esc(nameForPath(v))}</strong><small>External definition · import to edit</small></span></button>`).join('')}<button class="text-button lattice-import" data-import-lattice="${mesh?'mesh':'cell'}">Import .${mesh?'mld':'txt'}…</button></div>`).join('');
  }
  function bindLatticeTree(){
    $('project-tree').querySelectorAll('[data-new-lattice]').forEach(b=>b.onclick=()=>newLatticeDialog(b.dataset.newLattice==='mesh'));
    $('project-tree').querySelectorAll('[data-lattice-step]').forEach(b=>b.onclick=()=>{selected=b.dataset.latticeStep;refreshAll();});
    $('project-tree').querySelectorAll('[data-import-lattice]').forEach(b=>b.onclick=()=>importLattice(null,b.dataset.importLattice));
    $('project-tree').querySelectorAll('[data-lattice-reference]').forEach(b=>b.onclick=()=>importLattice(b.dataset.latticeReference));
  }
  function latticeNameError(name,params=null){
    if(!name.trim()||/[\\/]/.test(name)||/\.(txt|mld)$/i.test(name))return 'Enter a lattice name, without a file path or .txt / .mld extension.';
    if(integratedNames.includes(name)||latticeDefinitions().some(d=>d.params!==params&&d.params.la_name===name))return 'Choose a unique name that does not replace an integrated lattice.';
    return '';
  }
  function uniqueLatticeName(base){let name=base,index=1;while(latticeNameError(name))name=base+'_'+index++;return name;}
  function insertLatticeStep(step,index){const items=stepKeys().map(k=>doc.WorkFlow[k]);items.splice(index,0,step);doc.WorkFlow=Object.fromEntries(items.map((s,i)=>[String(i+1),s]));selected=String(index+1);markDirty();refreshAll();}
  function latticeInsertIndex(){const keys=stepKeys(),i=keys.findIndex(k=>doc.WorkFlow[k].Export);return i<0?keys.length:i;}
  function newLatticeDialog(mesh){
    const options=Object.entries(definitionTypes).filter(([type])=>isMeshType(type)===mesh);
    showModal(`<div class="modal-head"><div><h2>${mesh?'Define mesh / conformal lattice':'Define custom unit cell'}</h2><p>The definition is stored in your workflow.</p></div><button class="icon-button" data-close>×</button></div><div class="modal-body"><div class="field"><label for="new-lattice-type">Definition type</label><select id="new-lattice-type">${options.map(([t,label])=>`<option value="${t}">${label}</option>`).join('')}</select></div><div class="field"><label for="new-lattice-name">Lattice name</label><input id="new-lattice-name" type="text" value="${uniqueLatticeName(mesh?'MeshLattice':'CustomCell')}"></div><p id="new-lattice-error" class="lattice-error" role="status"></p></div><div class="modal-foot"><button class="button" data-close>Cancel</button><button class="button primary" id="create-lattice">Create definition</button></div>`);
    $('create-lattice').onclick=()=>{const name=$('new-lattice-name').value.trim(),error=latticeNameError(name);if(error){$('new-lattice-error').textContent=error;return;}const definition=definitionTemplate($('new-lattice-type').value);closeModal();insertLatticeStep({Define_Lattice:{la_name:name,definition}},latticeInsertIndex());};
  }
  async function importLattice(reference=null,group=null){
    if(!invoke){toast('Definition import is available in the desktop app.');return;}
    const originalDoc=doc;
    try{const file=await invoke('open_lattice_definition',{path:reference,workflowPath:currentPath||null,group});if(!file||doc!==originalDoc)return;
      const definition=parseNumericJson(file.contents),error=definitionError(definition);if(error)throw Error(error);
      const name=uniqueLatticeName(nameForPath(file.path).replace(/\.[^.]+$/,'').replace(/[^A-Za-z0-9_]/g,'_').replace(/^[^A-Za-z]+/,'')||'CustomLattice');
      const refs=reference?latticeReferences(doc).filter(r=>r.value===reference):[];
      const keys=stepKeys(),index=refs.length?Math.min(...refs.map(r=>keys.indexOf(r.step))):latticeInsertIndex();
      for(const ref of refs)ref.object[ref.key]=name;
      insertLatticeStep({Define_Lattice:{la_name:name,definition}},index);
      toast(refs.length?'Definition imported; workflow references now use its project name.':'Definition imported. Relative paths retain their original workflow meaning.');
    }catch(e){toast(`Could not import definition: ${e.message||e}`);}
  }
  function latticePicker(id,value,attributes,browseAttributes,unitOnly=false,exclude=''){
    const groups=Object.entries(integratedGroups).map(([label,names])=>['Integrated · '+label,names]);
    const definitions=latticeDefinitions().filter(({params})=>params.la_name!==exclude);
    groups.push(['Custom unit cells',definitions.filter(({params})=>!isMeshType(params.definition?.type)).map(({params})=>params.la_name)]);
    if(!unitOnly)groups.push(['Mesh / Conformal lattices',definitions.filter(({params})=>isMeshType(params.definition?.type)).map(({params})=>params.la_name)]);
    const references=[...new Set(latticeReferences(doc).map(r=>r.value).filter(v=>(unitOnly?/\.txt$/i:/\.(txt|mld)$/i).test(v)))];
    groups.push(['Definition files',references]);
    const known=groups.some(([,names])=>names.includes(value));
    return `<div class="path-row"><select id="${id}-select" data-lattice-select="${id}" aria-label="Lattice selection">${groups.filter(([,names])=>names.length).map(([label,names])=>`<optgroup label="${esc(label)}">${[...new Set(names)].map(name=>`<option value="${esc(name)}" ${value===name?'selected':''}>${esc(name)}</option>`).join('')}</optgroup>`).join('')}<option value="" ${known?'':'selected'}>Other name / file…</option></select><button class="icon-button" ${browseAttributes} aria-label="Browse lattice definition">…</button></div><input id="${id}" type="text" style="${known?'display:none':''}" ${attributes} value="${esc(value??'')}" aria-label="Custom lattice name or definition file" placeholder="Enter a lattice name or definition file">`;
  }
  function bindLatticePickers(){
    $('properties-content').querySelectorAll('[data-lattice-select]').forEach(select=>select.onchange=()=>{
      const input=$(select.dataset.latticeSelect);input.style.display=select.value?'none':'';
      if(select.value){input.value=select.value;input.dispatchEvent(new Event('change',{bubbles:true}));}
      else input.focus();
    });
  }

  function renderLatticeProperties(params){
    const value=params.definition||{},d=value.definition||{},type=value.type;
    if(!definitionTypes[type])return false;
    $('properties-title').textContent=params.la_name||'Lattice definition';$('properties-subtitle').textContent=definitionTypes[type];
    const input=(key,label,help='',kind='text')=>key==='la_name'?`<div class="field"><label for="lattice-la_name-select">${label}</label>${latticePicker('lattice-la_name',d.la_name,'data-lattice-field="la_name" data-kind="text"','data-lattice-browse="la_name"',true,params.la_name)}<p class="field-help">${help}</p></div>`:`<div class="field"><label for="lattice-${key}">${label}</label>${kind==='json'?`<textarea id="lattice-${key}" data-lattice-field="${key}" data-kind="json" class="lattice-array">${esc(stringifyNumericJson(d[key]||[]))}</textarea>`:`<div class="${['meshfile','file','la_name'].includes(key)?'path-row':''}"><input id="lattice-${key}" data-lattice-field="${key}" data-kind="${kind}" type="${kind==='number'?'number':'text'}" ${kind==='number'?'step="any" min="0"':''} ${key==='la_name'?'list="lattice-choices"':''} value="${esc(d[key]??'')}">${['meshfile','file','la_name'].includes(key)?`<button class="icon-button" data-lattice-browse="${key}" aria-label="Browse ${label}">…</button>`:''}</div>`}${help?`<p class="field-help">${help}</p>`:''}</div>`;

    let fields='';
    if(isMeshType(type)){fields=input('meshfile','Mesh file or mesh variable','Use a file (.med, .inp, .bdf, .msh, STL/OBJ/PLY) or a mesh variable created earlier in the workflow.');if(type==='ConformalLattice')fields+=input('la_name','Unit lattice','Choose an integrated name, a custom unit-cell name, or a .txt definition. Match its Hex/Tet domain to the mesh.');fields+=input('k','Joint smoothing (k)','0 means no smoothing. Higher values blend joints and add material.','number');}
    else{
      fields=`<div class="field"><label for="lattice-domain">Reference domain</label><select id="lattice-domain" data-lattice-field="ladomain" data-kind="text">${['Hex','Tet','Quad','Triangle'].map(domain=>`<option ${d.ladomain===domain?'selected':''}>${domain}</option>`).join('')}</select><p class="field-help">Hex: unit cube. Tet: standard tetrahedron. Quad: quadrilateral surface unit cell. Triangle: triangular surface unit cell.</p></div>`;
      if(type==='strut')fields+=input('pts','Node coordinates','Normalized [X, Y, Z] coordinates. Tet nodes also require X + Y + Z ≤ 1.','json')+input('cnnt','Strut connections','Each pair contains two zero-based node indices.','json');
      else if(type.startsWith('TPMS'))fields+=input('unit_x_len','X period')+input('unit_y_len','Y period')+input('unit_z_len','Z period')+input('expr','Implicit expression',type==='TPMS-Field'?'Create referenced grid fields earlier with OP_Fit_GridField. Expressions are evaluated by Artisan.':'For example: cos(x)+cos(y)+cos(z). Expressions are evaluated by Artisan.');
      else fields+=input('file','Geometry file',type==='Geom'?'Use a closed, watertight unit-cell mesh.':'Use a surface mesh to define the plate unit cell.');
    }
    $('properties-content').innerHTML=section('Definition',`<div class="field"><label for="lattice-name">Lattice name</label><input id="lattice-name" type="text" value="${esc(params.la_name)}"></div><p class="field-help">Saved as a Define_Lattice workflow step. Keep required meshes, fields and unit-cell definitions before this step.</p>`)+section('Parameters',fields)+`<p id="lattice-error" class="lattice-error" role="status">${esc(definitionError(value))}</p><div class="lattice-actions"><button class="button primary" id="apply-lattice">Apply definition</button><button class="button" id="use-lattice">Add lattice step</button><button class="button" id="export-lattice">Export definition…</button><button class="button" id="delete-lattice">Remove definition</button></div><p class="field-help">Size, thickness, rotation, translation and Fill are set in the consuming Add_Lattice step. For mesh/conformal definitions, size controls the search scale; start near the mesh element size.</p>`;
    function apply(){
      const next=clone(params.definition),name=$('lattice-name').value.trim();
      try{const nameError=latticeNameError(name,params);if(nameError)throw Error(nameError);
        for(const el of $('properties-content').querySelectorAll('[data-lattice-field]')){const key=el.dataset.latticeField;if(el.dataset.kind==='json')next.definition[key]=parseNumericJson(el.value);else if(el.dataset.kind==='number'){setNumber(next.definition,key,el.value,'float');}else next.definition[key]=el.value.trim();}
        const error=definitionError(next);if(error)throw Error(error);
        if(next.type==='ConformalLattice'&&(next.definition.la_name===name||latticeDefinitions().some(x=>x.params.la_name===next.definition.la_name&&isMeshType(x.params.definition?.type))))throw Error('A conformal definition must reference a separate unit cell, not a mesh or conformal lattice.');
        const previous=params.la_name;for(const ref of latticeReferences(doc))if(ref.value===previous)ref.object[ref.key]=name;
        params.la_name=name;params.definition=next;markDirty();$('lattice-error').classList.add('success');$('lattice-error').textContent='Definition applied.';return true;
      }catch(e){$('lattice-error').classList.remove('success');$('lattice-error').textContent=e.message;return false;}
    }
    bindLatticePickers();
    applyLatticeDraft=apply;
    $('apply-lattice').onclick=()=>{if(apply())refreshProperties();};
    $('use-lattice').onclick=()=>{if(!apply())return;const template=parseNumericJson('{"la_name":"","size":[4.0,4.0,4.0],"thk":0.3,"Rot":[0.0,0.0,0.0],"Trans":[0.0,0.0,0.0],"Inv":false,"Fill":true,"Cube_Request":{}}');template.la_name=params.la_name;template.Fill=!isMeshType(params.definition.type);const index=stepKeys().findIndex(k=>doc.WorkFlow[k].Define_Lattice===params);insertLatticeStep({Add_Lattice:template},index+1);};
    $('export-lattice').onclick=async()=>{if(!apply()||!invoke)return;try{const path=await invoke('export_lattice_definition',{contents:stringifyNumericJson(params.definition)+'\n',name:params.la_name,mesh:isMeshType(params.definition.type)});if(path)toast('Definition exported. The project keeps its inline definition.');}catch(e){toast(`Could not export: ${e.message||e}`);}};
    $('delete-lattice').onclick=()=>removeStep();
    $('properties-content').querySelectorAll('[data-lattice-browse]').forEach(b=>b.onclick=async()=>{if(!invoke)return;try{const input=$('lattice-'+b.dataset.latticeBrowse),path=await invoke('choose_lattice_input',{kind:b.dataset.latticeBrowse});if(path&&input.isConnected){input.value=path;if(b.dataset.latticeBrowse==='la_name'){input.style.display='';$('lattice-la_name-select').value='';}}}catch(e){toast(String(e));}});
    return true;
  }
  function latticeWorkflowError(){
    const definitions=latticeDefinitions(),names=new Map();
    for(const {key,params} of definitions){if(names.has(params.la_name))return `Duplicate lattice name: ${params.la_name}.`;names.set(params.la_name,key);const error=definitionTypes[params.definition?.type]?definitionError(params.definition):'';if(error)return `${params.la_name}: ${error}`;}
    const keys=stepKeys();for(const ref of latticeReferences(doc)){const key=names.get(ref.value);if(key&&keys.indexOf(key)>=keys.indexOf(ref.step))return `Define ${ref.value} before workflow step ${ref.step} uses it.`;}
    return '';
  }

  function projectFiles(){return doc.ArtGUI?.geometry||[];}
  function supportingFiles(){return doc.ArtGUI?.supportingFiles||[];}
  function ensureFiles(){doc.ArtGUI ||= {version:1,geometry:[],supportingFiles:[]};return doc.ArtGUI;}
  function fileRecord(id){return id==='source'?{id,path:doc.Setup.Geomfile||''}:projectFiles().find(f=>f.id===id)||supportingFiles().find(f=>f.id===id);}
  function fileStats(layer){return layer.metadata?`${layer.metadata.nodeCount.toLocaleString()} nodes · ${layer.metadata.elementCount.toLocaleString()} elements`:`${layer.shown.toLocaleString()} triangles`;}
  function refreshTree(){
    const item=(file,support=false)=>{
      const key=file.id==='source'?'geometry':'file:'+file.id,layer=viewer?.layers.get(file.id),loaded=layer?.path===file.path;
      return `<button class="tree-item project-file ${selected===key?'active':''}" data-file="${esc(file.id)}" title="${esc(file.path)}"><span class="tree-icon">${support?'▤':'◇'}</span><span class="project-file-text"><strong>${esc(file.path?nameForPath(file.path):'Source geometry')}</strong><small>${support?'Supporting file':file.id==='source'?'Workflow source':file.id==='result'?'Generated result':'Reference geometry'}${fileIssues.has(file.id)?' · Load failed':loaded?' · '+(layer.mesh.visible?'Shown':'Hidden'):''}</small></span></button>`;
    };
    $('project-tree').innerHTML=`<div class="tree-group"><div class="tree-label">Project</div><button class="tree-item ${selected==='setup'?'active':''}" data-select="setup"><span class="tree-icon">◈</span>Project settings</button></div>
      <div class="tree-group"><div class="project-group-heading"><span class="tree-label">Geometry</span><button class="text-button" id="add-project-geometry" aria-label="Add reference geometry">＋ Add</button></div>${item({id:'source',path:doc.Setup.Geomfile||''})}${projectFiles().map(f=>item(f)).join('')}</div>
      <div class="tree-group"><div class="project-group-heading"><span class="tree-label">Supporting files</span><button class="text-button" id="add-supporting-file" aria-label="Add supporting file">＋ Add</button></div>${supportingFiles().map(f=>item(f,true)).join('')||'<p class="project-empty">Attach field data, point clouds, or other project files.</p>'}</div>${latticeTree()}`;
    $('project-tree').querySelector('[data-select]').onclick=()=>{selected='setup';refreshAll();};
    $('project-tree').querySelectorAll('[data-file]').forEach(button=>button.onclick=()=>{
      const id=button.dataset.file;selected=id==='source'?'geometry':'file:'+id;refreshTree();refreshProperties();refreshTimeline();
      const file=fileRecord(id);if(!supportingFiles().some(f=>f.id===id)&&file?.path){const layer=viewer?.layers.get(id);if(layer?.path===file.path)viewer.setActiveLayer(id);else loadPreview(file.path,'quick',id);}
    });
    $('add-project-geometry').onclick=()=>addProjectFile(false);$('add-supporting-file').onclick=()=>addProjectFile(true);bindLatticeTree();
  }
  async function addProjectFile(support){
    if(!invoke){toast('File browsing is available in the desktop app.');return;}
    try{const path=await invoke(support?'choose_supporting_file':'choose_geometry');if(!path)return;
      const state=ensureFiles(),list=support?state.supportingFiles:state.geometry;
      let file=list.find(f=>f.path===path);if(!file){file={id:(support?'support-':'geometry-')+crypto.randomUUID(),path};list.push(file);markDirty();}
      selected='file:'+file.id;refreshAll();if(!support)await loadPreview(path,'quick',file.id);
    }catch(e){toast(`Could not add file: ${e.message||e}`);}
  }
  function geometryBounds(layer){
    if(!layer||layer.box.isEmpty())return section('Bounding box & dimensions','<p class="field-help">Load a geometry preview to see its bounds and axis lengths.</p>');
    const format=value=>Number(value.toPrecision(8)).toString(),units=viewer.settings.units;
    const rows=['x','y','z'].map(axis=>{
      // Viewer boxes are shifted for rendering; restore original file coordinates.
      const min=layer.box.min[axis]+viewer.origin[axis],max=layer.box.max[axis]+viewer.origin[axis],length=layer.box.max[axis]-layer.box.min[axis];
      return `<tr><th scope="row">${axis.toUpperCase()}</th><td>${format(min)}</td><td>${format(max)}</td><td>${format(length)}</td></tr>`;
    }).join('');
    return section('Bounding box & dimensions',`<p class="field-help">Original file coordinates · ${esc(units)}</p><table class="geometry-bounds"><thead><tr><th scope="col">Axis</th><th scope="col">Min</th><th scope="col">Max</th><th scope="col">Length</th></tr></thead><tbody>${rows}</tbody></table>`);
  }
  function showFileProperties(file,support=false){
    const host=$('properties-content'),source=file.id==='source',layer=viewer?.layers.get(file.id),loaded=!!file.path&&layer?.path===file.path;
    $('properties-title').textContent=file.path?nameForPath(file.path):'Source geometry';$('properties-subtitle').textContent=source?'Workflow source geometry':support?'Supporting file':'Project geometry';
    host.innerHTML=(fileIssues.has(file.id)?section('Preview unavailable',`<p class="project-path" role="status">${esc(fileIssues.get(file.id))}</p>`):'')+section('File',`<p class="project-path">${esc(file.path||'No source geometry selected.')}</p><p class="field-help">${source?(doc.Setup.Type==='Sample'?'The project uses a sample domain. Loading a source file switches it to Geometry mode.':'This file defines the workflow source. Domain, resolution and compute options are in Project settings.'):support?'Attached for reference. Set the relevant workflow parameter to use this file.':'Previewing a reference does not change the workflow source.'}</p>`)+
      (loaded?section('Mesh',`<p>${esc(fileStats(layer))}</p>${layer.metadata?`<p class="project-path">${esc(Object.entries(layer.metadata.types).map(([type,count])=>type+': '+count.toLocaleString()).join(' · '))}</p><p class="field-help">${layer.metadata.beamCount?'Beams display as centre lines. ':''}Solid elements display their outer surface. Sections clip the display without creating cut faces.</p>`:''}<label class="project-visible"><input id="file-visible" type="checkbox" ${layer.mesh.visible?'checked':''}> Visible in workspace</label>`):'')+
      (!support?geometryBounds(loaded?layer:null):'')+
      section('Actions',`${/\.(stl|obj|ply|inp)$/i.test(file.path)?'<button class="button" id="preview-project-file">Preview mesh</button> ':''}${source?`<button class="button" id="choose-source-geometry">${file.path?'Replace source geometry':'Load source geometry'}</button>`:'<button class="button" id="remove-project-file">Remove from project</button><p class="field-help">The file on disk is kept.</p>'}`);
    if($('preview-project-file'))$('preview-project-file').onclick=()=>loadPreview(file.path,'quick',file.id);
    if($('file-visible'))$('file-visible').onchange=e=>{layer.mesh.visible=e.target.checked;viewer.pending=[];viewer.refreshHelpers();viewer.updateSection();viewer.redrawMeasurements();viewer.refreshLayers();};
    if(source){$('choose-source-geometry').onclick=loadGeometry;return;}
    $('remove-project-file').onclick=()=>{cancelPreview();const files=ensureFiles();files.geometry=files.geometry.filter(f=>f.id!==file.id);files.supportingFiles=files.supportingFiles.filter(f=>f.id!==file.id);viewer?.removeLayer(file.id);selected='setup';markDirty();refreshAll();if(!viewer?.layers.size){$('viewport-empty').classList.remove('hidden');$('mesh-info').textContent='No model loaded';loadedGeometryPath='';$('preview-mode').disabled=true;}else if(loadedLayerId===file.id){const id=viewer.layers.keys().next().value;viewer.setActiveLayer(id);}};
  }

  function refreshTimeline(){
    const keys=stepKeys();$('operation-count').textContent=`${keys.length} ${keys.length===1?'step':'steps'}`;
    const index=keys.indexOf(selected);$('remove-step').disabled=index<0;$('move-up').disabled=index<=0;$('move-down').disabled=index<0||index>=keys.length-1;
    if(!keys.length){$('timeline').innerHTML='<div class="timeline-empty">Your workflow is empty. Add an operation to get started.</div>';return;}
    $('timeline').innerHTML=keys.map((k,i)=>`<button class="step-card ${selected===k?'selected':''}" data-step="${esc(k)}" title="${esc(stepTitle(k))}"><div class="step-top"><span>${String(i+1).padStart(2,'0')}</span><span class="step-operation-icon">${operationIcon((window.ARTISAN_OPERATIONS||[]).find(o=>o.keyword===stepTitle(k))?.icon)}</span><strong>${esc(titleFor(stepTitle(k)))}</strong></div><p>${esc(Object.values(doc.WorkFlow[k][stepTitle(k)]||{}).slice(0,3).map(human).join(' · ')||stepTitle(k))}</p></button>${i<keys.length-1?'<span class="step-arrow">›</span>':''}`).join('');
    runProgress.paintStep();
    $('timeline').querySelectorAll('[data-step]').forEach(b=>b.onclick=()=>{selected=b.dataset.step;refreshTree();refreshProperties();refreshTimeline();});
  }
  function section(title,body){return `<section class="form-section"><h3>${esc(title)}</h3>${body}</section>`;}
  function field(key,value,path,onchange,depth=0){
    const id='f_'+Math.random().toString(36).slice(2);const label=esc(titleFor(key));
    if(typeof value==='boolean')return `<div class="field"><label for="${id}">${label}</label><div class="field-row"><input id="${id}" type="checkbox" data-value="${esc(path)}" ${value?'checked':''}><span class="field-help">${value?'Enabled':'Disabled'}</span></div></div>`;
    if(Array.isArray(value)){
      if(value.length&&value.every(v=>typeof v==='number'))return `<div class="field"><label>${label}</label><div class="vector-fields">${value.map((v,i)=>`<input aria-label="${label} ${i+1}" type="number" ${numberInput(value,i)} data-vector="${esc(path)}" data-index="${i}">`).join('')}</div></div>`;
      return `<div class="field"><label for="${id}">${label} <span class="field-help">JSON array</span></label><textarea id="${id}" data-json-value="${esc(path)}">${esc(stringifyNumericJson(value))}</textarea></div>`;
    }
    if(value&&typeof value==='object'){
      const inner=Object.entries(value).map(([k,v])=>field(k,v,`${path}.${k}`,onchange,depth+1)).join('');
      return `<div class="nested-group"><div class="nested-title">${label}</div>${inner}</div>`;
    }
    if(key==='la_name'&&path!=='Define_Lattice.la_name')return `<div class="field"><label for="${id}-select">Lattice name</label>${latticePicker(id,value,`data-value="${esc(path)}"`,`data-lattice-ref-browse="${esc(path)}"`)}<p class="field-help">Choose an integrated lattice, a project definition, or Other name / file.</p></div>`;
    const pathLike=/file|path|outfile|geom|mesh|output|dir/i.test(key);
    if(typeof value==='number')return `<div class="field"><label for="${id}">${label}</label><input id="${id}" type="number" ${numberInputForPath(path)} data-value="${esc(path)}"></div>`;
    if(pathLike)return `<div class="field"><label for="${id}">${label}</label><div class="path-row"><input id="${id}" type="text" value="${esc(value??'')}" data-value="${esc(path)}"><button class="icon-button" title="Browse" data-browse="${esc(path)}">…</button></div></div>`;
    const long=String(value??'').length>46;
    return `<div class="field"><label for="${id}">${label}</label>${long?`<textarea id="${id}" data-value="${esc(path)}">${esc(value??'')}</textarea>`:`<input id="${id}" type="text" value="${esc(value??'')}" data-value="${esc(path)}">`}</div>`;
  }
  function readAt(root,path){return path.split('.').reduce((o,k)=>o?.[k],root);}
  function writeAt(root,path,value){const parts=path.split('.');let o=root;for(const p of parts.slice(0,-1))o=o[p];o[parts.at(-1)]=value;}
  function updateField(path,value){const parts=path.split('.');let root,rest;if(parts[0]==='Setup'){root=doc.Setup;rest=parts.slice(1).join('.');}else if(parts[0]==='PostProcess'){root=doc.PostProcess;rest=parts.slice(1).join('.');}else{root=selectedStep()?.[parts[0]];rest=parts.slice(1).join('.');}if(root)writeAt(root,rest,value);markDirty();refreshProperties();}
  function propertyRoot(path){const parts=path.split('.');if(parts[0]==='Setup')return [doc.Setup,parts.slice(1).join('.')];if(parts[0]==='PostProcess')return [doc.PostProcess,parts.slice(1).join('.')];return [selectedStep()?.[parts[0]],parts.slice(1).join('.')];}
  function numberParent(path){const [root,rest]=propertyRoot(path),parts=rest.split('.'),key=parts.pop();return {parent:parts.length?readAt(root,parts.join('.')):root,key};}
  function numberInput(parent,key){const type=numberType(parent,key);return `step="${type==='integer'?'1':'any'}" data-number-type="${type}" value="${esc(numberText(parent,key))}"`;}
  function numberInputForPath(path){const {parent,key}=numberParent(path);return numberInput(parent,key);}
  function attachPropertyEvents(){
    bindLatticePickers();
    $('properties-content').querySelectorAll('[data-lattice-ref-browse]').forEach(el=>el.onclick=async()=>{if(!invoke)return;try{const path=await invoke('choose_lattice_input',{kind:'la_name'});if(path)updateField(el.dataset.latticeRefBrowse,path);}catch(e){toast(String(e));}});

    $('properties-content').querySelectorAll('[data-value]').forEach(el=>el.addEventListener('change',()=>{
      if(el.type==='number'){const {parent,key}=numberParent(el.dataset.value);try{setNumber(parent,key,el.value,el.dataset.numberType);markDirty();}catch(e){toast(e.message);}el.value=numberText(parent,key);}
      else updateField(el.dataset.value,el.type==='checkbox'?el.checked:el.value);
    }));
    $('properties-content').querySelectorAll('[data-vector]').forEach(el=>el.addEventListener('change',()=>{const [root,p]=propertyRoot(el.dataset.vector),a=readAt(root,p);try{setNumber(a,el.dataset.index,el.value,el.dataset.numberType);markDirty();}catch(e){toast(e.message);}el.value=numberText(a,el.dataset.index);}));
    $('properties-content').querySelectorAll('[data-json-value]').forEach(el=>el.addEventListener('change',()=>{try{updateField(el.dataset.jsonValue,parseNumericJson(el.value));}catch(e){toast(`Invalid JSON value: ${e.message}`);}}));
    $('properties-content').querySelectorAll('[data-domain]').forEach(el=>el.addEventListener('change',()=>{const axis=Number(el.dataset.domain),side=Number(el.dataset.side);doc.Setup.Sample ||= clone(defaultSetup.Sample);doc.Setup.Sample.Domain ||= clone(defaultSetup.Sample.Domain);const bounds=doc.Setup.Sample.Domain[axis];try{setNumber(bounds,side,el.value,el.dataset.numberType);markDirty();}catch(e){toast(e.message);}el.value=numberText(bounds,side);refreshProperties();}));
    $('properties-content').querySelectorAll('[data-preset]').forEach(el=>el.addEventListener('change',()=>{const index=Number(el.value);if(index<0)return;const op=window.ARTISAN_OPERATIONS.find(o=>o.keyword===el.dataset.preset),params=parseNumericJson(op.presets[index].paramsJson);selectedStep()[op.keyword]=params;presetSelections.set(params,index);markDirty();refreshProperties();}));
    $('properties-content').querySelectorAll('[data-browse]').forEach(el=>el.onclick=async()=>{if(!invoke){toast('File browsing is available in the installed desktop app.');return;}const path=await invoke(/outfile|output/i.test(el.dataset.browse)?'choose_output':'choose_geometry');if(path){updateField(el.dataset.browse,path);if(el.dataset.browse==='Setup.Geomfile')loadPreview(path);}});
  }
  function refreshProperties(){
    applyLatticeDraft=null;
    const host=$('properties-content');
    if(selectedStep()?.Define_Lattice&&renderLatticeProperties(selectedStep().Define_Lattice))return;
    if(selected?.startsWith('file:')){const file=fileRecord(selected.slice(5));if(file){showFileProperties(file,supportingFiles().some(f=>f.id===file.id));return;}}
    if(selected==='geometry'){showFileProperties(fileRecord('source'));return;}
    if(selected==='setup'){
      $('properties-title').textContent='Project settings';$('properties-subtitle').textContent='Setup · domain and resolution';
      const s=doc.Setup, dom=s.Sample?.Domain||defaultSetup.Sample.Domain, isSample=s.Type==='Sample';
      const bounds=(label,side)=>`<div class="field"><label>${label}</label><div class="vector-fields">${[0,1,2].map(axis=>`<input type="number" ${numberInput(dom[axis],side)} aria-label="${label} ${'XYZ'[axis]}" data-domain="${axis}" data-side="${side}" ${isSample?'required':'disabled'}>`).join('')}</div></div>`;
      host.innerHTML=section('Source geometry',`<div class="field"><label for="setup-type">Type</label><select id="setup-type" data-value="Setup.Type"><option value="Sample" ${isSample?'selected':''}>Sample</option><option value="Geometry" ${s.Type==='Geometry'?'selected':''}>Geometry</option></select></div>`+(isSample?'':field('Geomfile',s.Geomfile,'Setup.Geomfile',updateField)))+
        section('Domain bounds',`<p class="field-help">${isSample?'Define lower and upper bounds for X, Y, and Z. Each upper bound must be greater than its lower bound.':'Artisan reads the bounding box from Geomfile and expands it using padding. These sample bounds are inactive in Geometry mode.'}</p>`+bounds('Lower bounds',0)+bounds('Upper bounds',1))+
        (isSample&&sampleDomainError()?`<p class="field-help" role="status">${esc(sampleDomainError())}</p>`:'')+
        section('Resolution & transform',field('Resolution',s.res,'Setup.res',updateField)+field('Rotation',s.Rot,'Setup.Rot',updateField)+field('Padding',s.Padding,'Setup.Padding',updateField))+
        section('Compute',field('Use GPU',s.onGPU,'Setup.onGPU',updateField)+field('JSON working directory',s.JsonWorkDir,'Setup.JsonWorkDir',updateField)+field('Memory limit (bytes)',s.memorylimit,'Setup.memorylimit',updateField))+
        section('Post process',Object.entries(doc.PostProcess).map(([k,v])=>field(k,v,`PostProcess.${k}`,updateField)).join(''));
    }else if(selectedStep()){
      const step=selectedStep(), commands=Object.entries(step);$('properties-title').textContent=titleFor(commands[0]?.[0]||'Operation');$('properties-subtitle').textContent=`Workflow step ${String(stepKeys().indexOf(selected)+1).padStart(2,'0')} · ${commands.map(([keyword])=>keyword).join(' / ')}`;
      host.innerHTML=commands.map(([keyword,params])=>section(titleFor(keyword),parameterPresetControl(keyword,params)+Object.entries(params).map(([k,v])=>field(k,v,`${keyword}.${k}`,updateField)).join(''))).join('');
    }else{$('properties-title').textContent='Properties';$('properties-subtitle').textContent='Select a project or workflow step';host.innerHTML='<div class="empty-properties">Select project settings or a workflow step to view and edit its parameters.</div>';}
    attachPropertyEvents();
  }
  function reindex(){const entries=stepKeys().map(k=>doc.WorkFlow[k]);doc.WorkFlow=Object.fromEntries(entries.map((s,i)=>[String(i+1),s]));if(selected&&!doc.WorkFlow[selected])selected=null;}
  function addOperation(keyword,index){
    const op=(window.ARTISAN_OPERATIONS||[]).find(o=>o.keyword===keyword);if(!op)return;
    const entries=stepKeys().map(k=>doc.WorkFlow[k]),params=parseNumericJson(op.paramsJson);
    presetSelections.set(params,0);index=Math.max(0,Math.min(entries.length,index));entries.splice(index,0,{[keyword]:params});
    doc.WorkFlow=Object.fromEntries(entries.map((step,i)=>[String(i+1),step]));selected=String(index+1);
    markDirty();refreshProperties();toast(`${titleFor(keyword)} added to workflow`);closeModal();
  }
  function showPicker(){
    if(applyLatticeDraft&&!applyLatticeDraft())return;
    const cleanup=openOperationPicker({operations:window.ARTISAN_OPERATIONS||[],steps:stepKeys().map(key=>({key,label:titleFor(stepTitle(key))})),selected,showModal,closeModal,onAdd:addOperation});
    modalCleanup=()=>{cleanup();modalCleanup=null;};
  }
  let modalCleanup=null;
  function showModal(html){modalCleanup?.();$('modal').innerHTML=html;$('modal-backdrop').classList.remove('hidden');$('modal').querySelectorAll('[data-close]').forEach(b=>b.onclick=closeModal);$('modal-backdrop').onclick=e=>{if(e.target===$('modal-backdrop'))closeModal();};}
  function closeModal(){modalCleanup?.();$('modal-backdrop').classList.add('hidden');$('modal').innerHTML='';}
  function showAbout(){
    showModal(`<div class="modal-head"><div><h2 id="about-title">About ArtGUI</h2><p>Artisan Workbench · Version 0.1.0</p></div><button class="icon-button" data-close aria-label="Close About">×</button></div>
      <div class="modal-body about-body"><p><strong>Developed by Yikun Wang</strong></p><p>ArtGUI is distributed under the MIT License.</p><p>Artisan-core is distributed under CC BY-NC-ND 3.0 for non-commercial applications, or refer to your license file.</p><p class="about-credit">Legacy icon credit: Freepik from www.flaticon.com</p>
      <div class="about-icon-credits"><p><strong>Operation and picker icons</strong><br><a href="https://lucide.dev/" target="_blank" rel="noopener noreferrer" data-about-link>Lucide</a> · Version 1.48.0 · ISC License<br>Feather-derived icons: MIT License · Cole Bemis</p><p>Bundled with ArtGUI for offline use. <a href="https://lucide.dev/license" target="_blank" rel="noopener noreferrer" data-about-link>License information ↗</a></p><details class="about-licenses"><summary>View full icon license notices</summary><pre>${esc(iconLicense)}</pre></details></div>
      <div class="about-links"><a href="https://bleemsys.com/Artisan.html" target="_blank" rel="noopener noreferrer" data-about-link>Artisan website ↗</a><a href="https://bleemsys.com/Artisan/docs/index.html" target="_blank" rel="noopener noreferrer" data-about-link>Online help manual ↗</a></div>
      <img class="about-art" src="./about-background.png" alt="Examples of lattice structures created with Artisan"></div><div class="modal-foot"><button class="button primary" data-close>Close</button></div>`);
    const modal=$('modal');modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-labelledby','about-title');
    modal.querySelectorAll('[data-about-link]').forEach(link=>link.onclick=async e=>{if(!invoke)return;e.preventDefault();try{await invoke('open_about_link',{url:link.href});}catch(error){toast(`Could not open browser: ${error.message||error}`);}});
    const keydown=e=>{if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();closeModal();}else if(e.key==='Tab'){const items=[...modal.querySelectorAll('button,a[href],summary')],first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}};
    document.addEventListener('keydown',keydown,true);
    modalCleanup=()=>{document.removeEventListener('keydown',keydown,true);for(const name of ['role','aria-modal','aria-labelledby'])modal.removeAttribute(name);modalCleanup=null;$('help-button').focus();};
    modal.querySelector('[data-close]').focus();
  }
  function openJson(){if(applyLatticeDraft&&!applyLatticeDraft())return;showModal(`<div class="modal-head"><div><h2>Workflow JSON</h2><p>Artisan's original Setup / WorkFlow / PostProcess structure is preserved.</p></div><button class="icon-button" data-close>×</button></div><div class="modal-body"><textarea id="json-editor" class="json-editor" spellcheck="false">${esc(workflowJson().trimEnd())}</textarea></div><div class="modal-foot"><button class="button" data-close>Cancel</button><button class="button primary" id="apply-json">Apply JSON</button></div>`);$('apply-json').onclick=()=>{try{const next=parseNumericJson($('json-editor').value);const normalized=normalizeWorkflow(next);resetViewer();doc=normalized;selected=null;markDirty();refreshAll();closeModal();toast('Workflow JSON applied');}catch(e){toast(`Invalid workflow JSON: ${e.message}`);};};}
  function refreshAll(){refreshTree();refreshTimeline();refreshProperties();$('project-name').textContent=currentPath?nameForPath(currentPath).replace(/\.json$/i,''):'Untitled workflow';updateGeometryLabel();}
  function updateGeometryLabel(){const p=doc.Setup.Geomfile||'';$('geometry-label').textContent=p?nameForPath(p):'Load a model to preview your design';}
  function guardUnsaved(){return !dirty||confirm('Discard unsaved changes?');}
  function resetViewer(){fileIssues.clear();cancelPreview();viewer?.clear();loadedGeometryPath='';loadedPreviewMode='';loadedLayerId='source';$('preview-mode').disabled=true;$('mesh-info').textContent='No model loaded';$('viewport-empty').classList.remove('hidden');}
  function newProject(){if(runProgress.busy||!guardUnsaved())return;runProgress.reset();resetViewer();doc={Setup:clone(defaultSetup),WorkFlow:{},PostProcess:clone(defaultPost)};currentPath='';selected='setup';dirty=false;$('dirty-state').textContent='All changes saved';$('project-name').textContent='Untitled workflow';refreshAll();}
  async function openProject(){if(!guardUnsaved())return;if(invoke){try{const f=await invoke('open_workflow');if(!f)return;loadWorkflow(f.contents,f.path);}catch(e){toast(`Could not open workflow: ${e}`);}}else{$('fallback-file').click();}}
  function loadWorkflow(text,path){try{const parsed=parseNumericJson(text);if(!parsed.Setup||!parsed.WorkFlow)throw Error('Expected Setup and WorkFlow sections.');const nextDoc=normalizeWorkflow(parsed);resetViewer();doc=nextDoc;runProgress.reset();currentPath=path||'';selected='setup';dirty=false;$('dirty-state').textContent='All changes saved';refreshAll();if(doc.Setup.Type==='Geometry'&&doc.Setup.Geomfile)loadPreview(doc.Setup.Geomfile);toast('Workflow opened');}catch(e){toast(`Could not read workflow: ${e.message}`);}}
  async function saveProject(){if(runProgress.busy)return false;if(applyLatticeDraft&&!applyLatticeDraft())return false;const contents=workflowJson().trimEnd()+'\n';if(invoke){try{const p=await invoke('save_workflow',{path:currentPath||null,contents});if(p){currentPath=p;dirty=false;$('dirty-state').textContent='All changes saved';$('project-name').textContent=nameForPath(p).replace(/\.json$/i,'');toast('Workflow saved');}return !!p;}catch(e){toast(`Could not save: ${e}`);return false;}}const blob=new Blob([contents],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=nameForPath(currentPath||'Artisan_workflow.json');a.click();URL.revokeObjectURL(a.href);dirty=false;$('dirty-state').textContent='Downloaded JSON';return true;}
  function showSettings(){selected='setup';refreshTree();refreshProperties();}
  function editSetup(){showSettings();}
  function removeStep(){if(!selectedStep())return;const definition=selectedStep().Define_Lattice;if(definition&&latticeReferences(doc).some(r=>r.value===definition.la_name)){toast('This definition is still used. Update or remove its references first.');return;}delete doc.WorkFlow[selected];reindex();markDirty();refreshAll();}
  function moveStep(offset){if(!selectedStep())return;const keys=stepKeys(),i=keys.indexOf(selected),j=Math.max(0,Math.min(keys.length-1,i+offset));if(i===j)return;const values=keys.map(k=>doc.WorkFlow[k]);[values[i],values[j]]=[values[j],values[i]];doc.WorkFlow=Object.fromEntries(values.map((v,n)=>[String(n+1),v]));selected=String(j+1);markDirty();refreshAll();}
  function clearWorkflow(){if(!stepKeys().length||!confirm('Remove every operation from this workflow?'))return;doc.WorkFlow={};selected=null;markDirty();refreshAll();}
  function backendDescription(){return backendPath+(/\.py$/i.test(backendPath)?`\nPython: ${pythonPath||'System Python (python)'}`:'');}
  function selectBackend(path,python=pythonPath){
    backendPath=path;pythonPath=python;localStorage.setItem('artisan.backend',path);localStorage.setItem('artisan.python',python);
    $('backend-indicator').textContent=nameForPath(path);$('backend-indicator').title=backendDescription();
    toast(/\.py$/i.test(path)?'Artisan Python backend selected':'Artisan executable selected');
  }
  async function chooseBackend(){
    if(!invoke){toast('Backend selection is unavailable: the Tauri bridge did not load.');return;}
    try{
      const path=await invoke('choose_backend');if(!path)return;
      if(!/\.py$/i.test(path)){selectBackend(path);return;}
      showModal(`<div class="modal-head"><div><h2>Python backend</h2><p>Choose the Python environment used to run Artisan.</p></div><button class="icon-button" data-close aria-label="Close Python backend">×</button></div><div class="modal-body"><p class="project-path">${esc(path)}</p><div class="field"><label for="backend-python">Python interpreter</label><div class="path-row"><input id="backend-python" type="text" value="${esc(pythonPath)}" placeholder="System Python (python)"><button class="icon-button" id="browse-backend-python" aria-label="Browse Python interpreter">…</button></div></div><p class="field-help">Select python.exe from the environment where Artisan and its dependencies are installed. Leave this empty to use Python from the system PATH.</p></div><div class="modal-foot"><button class="button" data-close>Cancel</button><button class="button primary" id="save-python-backend">Use Python backend</button></div>`);
      $('browse-backend-python').onclick=async()=>{try{const p=await invoke('choose_python');if(p&&$('backend-python'))$('backend-python').value=p;}catch(e){toast(`Could not choose Python: ${e}`);}};
      $('save-python-backend').onclick=()=>{selectBackend(path,$('backend-python').value.trim());closeModal();};
      $('backend-python').focus();
    }catch(e){toast(`Could not open backend picker: ${e}`);}
  }
  async function loadGeometry(){if(!invoke){toast('Geometry browsing is unavailable: the Tauri bridge did not load.');return;}try{const p=await invoke('choose_geometry');if(!p)return;doc.Setup.Type='Geometry';doc.Setup.Geomfile=p;markDirty();refreshProperties();updateGeometryLabel();await loadPreview(p);}catch(e){toast(`Could not open geometry picker: ${e}`);}}
  async function loadResult(){if(!invoke){toast('Use the desktop app to load a result file.');return;}try{const path=await invoke('choose_geometry');if(path){const state=ensureFiles();state.geometry=state.geometry.filter(f=>f.id!=='result');state.geometry.push({id:'result',path});markDirty();await loadPreview(path,'quick','result');}}catch(e){toast(`Could not load result: ${e}`);}}
  function setPreviewProgress(visible, loaded=0, total=0, label='Preparing geometry…'){
    const host=$('preview-progress'),bar=$('preview-progress-bar');
    host.classList.toggle('hidden',!visible);
    bar.max=total>0?total:1;bar.value=total>0?Math.min(loaded,total):0;
    $('preview-progress-text').textContent=label;
  }
  function formatBytes(bytes){if(!bytes)return 'unknown size';const units=['B','KB','MB','GB'];let n=bytes,i=0;while(n>=1024&&i<units.length-1){n/=1024;i++;}return `${n.toFixed(i?1:0)} ${units[i]}`;}
  function updatePreviewMode(mode,total,shown,stl){
    const button=$('preview-mode');button.disabled=!stl||total<=120000;
    if(!stl){button.textContent='Full detail';return;}
    if(total<=120000){button.textContent='Full detail shown';return;}
    button.textContent=mode==='quick'?'Load full detail':'Show quick preview';
  }
  function cancelPreview(){
    previewRequest++;if(activePreviewJob){invoke?.('cancel_geometry_preview',{jobId:activePreviewJob}).catch(()=>{});activePreviewJob='';}if(previewProgressUnlisten){previewProgressUnlisten();previewProgressUnlisten=null;}if(previewCancelReject){previewCancelReject(new DOMException('Preview cancelled','AbortError'));previewCancelReject=null;}if(previewWorker){previewWorker.terminate();previewWorker=null;}if(previewAbort){previewAbort.abort();previewAbort=null;}
    setPreviewProgress(false);$('mesh-info').textContent='Preview loading cancelled';
  }
  async function loadPreview(path,mode='quick',layerId='source'){
    if(!path||!invoke)return;
    const request=++previewRequest;
    await viewerReady;
    if(request!==previewRequest)return;
    if(!viewer){toast('This computer could not start the WebGL viewer. Workflow editing is still available.');return;}
    if(activePreviewJob){invoke('cancel_geometry_preview',{jobId:activePreviewJob}).catch(()=>{});activePreviewJob='';}
    if(previewProgressUnlisten){previewProgressUnlisten();previewProgressUnlisten=null;}
    if(previewCancelReject){previewCancelReject(new DOMException('Preview replaced','AbortError'));previewCancelReject=null;}if(previewWorker){previewWorker.terminate();previewWorker=null;}
    if(previewAbort){previewAbort.abort();previewAbort=null;}
    fileIssues.delete(layerId);
    $('mesh-info').textContent=`Preparing ${mode==='quick'?'quick preview':'full detail'}…`;
    setPreviewProgress(true,0,0,'Opening geometry…');
    let thisJobId='',thisProgressUnlisten=null;
    try{
      const ext=path.split('.').pop().toLowerCase();let positions,totalTriangles,shownTriangles,center=null,bounds=null,inp=null;
      if(ext==='inp'){
        const file=await invoke('resolve_geometry',{path,workflowPath:currentPath||null});if(request!==previewRequest)return;
        if(file.size>128*1024*1024)throw Error('INP viewing is limited to 128 MB per file.');
        inp=await loadStlWorker(window.__TAURI__.core.convertFileSrc(file.path),'full',file.size,request,true);
        positions=inp.positions;center=inp.center;bounds=inp.bounds;totalTriangles=shownTriangles=positions.length/9;
      }else if(ext==='stl'&&mode==='quick'){
        const jobId=`preview-${Date.now()}-${Math.random().toString(36).slice(2)}`;thisJobId=jobId;activePreviewJob=jobId;
        try{thisProgressUnlisten=await window.__TAURI__.event.listen('geometry-preview-progress',event=>{const p=event.payload;if(p.jobId===jobId&&request===previewRequest)setPreviewProgress(true,p.loaded,p.total,p.stage);});}catch{}
        if(request!==previewRequest){thisProgressUnlisten?.();if(activePreviewJob===jobId)activePreviewJob='';return;}
        previewProgressUnlisten=thisProgressUnlisten;
        const preview=await invoke('create_geometry_preview',{jobId,path,workflowPath:currentPath||null});
        thisProgressUnlisten?.();if(previewProgressUnlisten===thisProgressUnlisten)previewProgressUnlisten=null;if(activePreviewJob===jobId)activePreviewJob='';
        if(request!==previewRequest)return;
        const previewUrl=window.__TAURI__.core.convertFileSrc(preview.previewPath);
        const result=await loadStlWorker(previewUrl,'full',preview.previewSize,request);
        if(request!==previewRequest)return;
        positions=new Float32Array(result.positions);center=result.center;bounds=preview.boundsMin?[preview.boundsMin,preview.boundsMax]:result.bounds;totalTriangles=preview.totalTriangles;shownTriangles=preview.previewTriangles;
      }else if(ext==='stl'){
        const file=await invoke('resolve_geometry',{path,workflowPath:currentPath||null});
        if(request!==previewRequest)return;
        if(file.triangleCount>10000000)throw Error('This STL exceeds the 10-million-triangle full-detail limit. Use Quick Preview instead.');
        if(file.size>256*1024*1024&&!confirm(`This STL is ${formatBytes(file.size)}. Full detail may use several times that amount of working memory. Continue?`)){setPreviewProgress(false);$('mesh-info').textContent=(layerId==='source'?'Source · ':layerId==='result'?'Result · ':nameForPath(path)+' · ')+(loadedPreviewMode==='quick'?'Quick preview remains loaded · '+nameForPath(loadedGeometryPath):'Full-detail loading cancelled');return;}
        const url=window.__TAURI__.core.convertFileSrc(file.path);
        const result=await loadStlWorker(url,'full',file.size,request);
        if(request!==previewRequest)return;
        positions=new Float32Array(result.positions);center=result.center;bounds=result.bounds;totalTriangles=result.totalTriangles;shownTriangles=result.triangles;
      }else{
        const file=await invoke('resolve_geometry',{path,workflowPath:currentPath||null});
        if(request!==previewRequest)return;
        const url=window.__TAURI__.core.convertFileSrc(file.path);previewAbort=new AbortController();
        const response=await fetch(url,{signal:previewAbort.signal});if(!response.ok)throw Error(`Could not read geometry (${response.status}).`);
        const bytes=new Uint8Array(await response.arrayBuffer());if(request!==previewRequest)return;
        const triangles=parseMesh(path,bytes);if(!triangles.length)throw Error('No renderable triangles found.');
        positions=new Float32Array(triangles.length*9);let offset=0;for(const tri of triangles)for(const point of tri)for(const value of point)positions[offset++]=value;
        totalTriangles=shownTriangles=triangles.length;
      }
      if(request!==previewRequest)return;
      loadedGeometryPath=path;loadedLayerId=layerId;loadedPreviewMode=shownTriangles<totalTriangles?'quick':'full';viewer.setLayer(layerId,positions,{center,bounds,path,mode:loadedPreviewMode,total:totalTriangles,...(inp?{lines:inp.lines,edges:inp.edges,metadata:inp.metadata,topology:inp.topology}:{})});
      $('viewport-empty').classList.add('hidden');
      $('mesh-info').textContent=(layerId==='source'?'Source · ':layerId==='result'?'Result · ':nameForPath(path)+' · ')+(loadedPreviewMode==='quick'?`Quick preview · ${shownTriangles.toLocaleString()} of ${totalTriangles.toLocaleString()} triangles · ${nameForPath(path)}`:`Full detail · ${totalTriangles.toLocaleString()} triangles · ${nameForPath(path)}`);
      if(inp)$('mesh-info').textContent=`${nameForPath(path)} · ${fileStats(viewer.layers.get(layerId))}`;
      updatePreviewMode(loadedPreviewMode,totalTriangles,shownTriangles,ext==='stl');setPreviewProgress(false);refreshTree();refreshProperties();
      previewWorker=null;previewAbort=null;
    }catch(e){
      thisProgressUnlisten?.();if(previewProgressUnlisten===thisProgressUnlisten)previewProgressUnlisten=null;if(activePreviewJob===thisJobId)activePreviewJob='';
      if(request!==previewRequest||e?.name==='AbortError')return;
      if(previewWorker){previewWorker.terminate();previewWorker=null;}previewAbort=null;setPreviewProgress(false);
      fileIssues.set(layerId,String(e?.message||e));refreshTree();refreshProperties();$('mesh-info').textContent='Could not preview this geometry';toast(`Preview failed: ${e?.message||e}`);
    }
  }
  function loadStlWorker(url,mode,fileSize,request,inp=false){
    return new Promise((resolve,reject)=>{
      const worker=new Worker(new URL(inp?'./inp-worker.js':'./preview-worker.js',import.meta.url),inp?{type:'module'}:{});previewWorker=worker;previewCancelReject=reject;
      worker.onmessage=e=>{
        if(request!==previewRequest){worker.terminate();return;}
        const data=e.data;
        if(data.type==='progress')setPreviewProgress(true,data.loaded,data.total,data.stage||'Preparing mesh…');
        else if(data.type==='done'){worker.terminate();previewWorker=null;previewCancelReject=null;resolve(data);}
        else if(data.type==='error'){worker.terminate();previewWorker=null;previewCancelReject=null;reject(new Error(data.message));}
      };
      worker.onerror=e=>{worker.terminate();previewWorker=null;previewCancelReject=null;reject(new Error(e.message||'STL preview worker failed.'));};
      worker.postMessage({url,mode,fileSize});
    });
  }
  function parseMesh(path,bytes){const ext=path.split('.').pop().toLowerCase(),text=()=>new TextDecoder().decode(bytes);let tris=[];
    if(ext==='stl'){
        if(bytes.length>=84){const n=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).getUint32(80,true);if(84+n*50===bytes.length){const d=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);for(let i=0;i<n;i++){let o=84+i*50+12;let tri=[];for(let j=0;j<3;j++){tri.push([d.getFloat32(o,true),d.getFloat32(o+4,true),d.getFloat32(o+8,true)]);o+=12;}tris.push(tri);}}}
      if(!tris.length){const t=text(),re=/vertex\s+([-+\deE.]+)\s+([-+\deE.]+)\s+([-+\deE.]+)/gi;let m,tri=[];while((m=re.exec(t))){tri.push(m.slice(1).map(Number));if(tri.length===3){tris.push(tri);tri=[];}}}
    }else if(ext==='obj'){const vs=[[0,0,0]];for(const line of text().split(/\r?\n/)){const a=line.trim().split(/\s+/);if(a[0]==='v')vs.push(a.slice(1,4).map(Number));if(a[0]==='f'){const ids=a.slice(1).map(s=>Number(s.split('/')[0])).map(n=>n<0?vs.length+n:n);for(let i=1;i<ids.length-1;i++)tris.push([vs[ids[0]],vs[ids[i]],vs[ids[i+1]]]);}}}
    else if(ext==='ply'){const t=text(),at=t.indexOf('end_header');if(at>=0){const header=t.slice(0,at),body=t.slice(at+10).trim().split(/\r?\n/),nv=Number(header.match(/element vertex (\d+)/)?.[1]||0),nf=Number(header.match(/element face (\d+)/)?.[1]||0),vs=[[0,0,0]];for(let i=0;i<nv;i++)vs.push(body[i].trim().split(/\s+/).slice(0,3).map(Number));for(let i=0;i<nf;i++){const a=body[nv+i].trim().split(/\s+/).map(Number),ids=a.slice(1,1+a[0]).map(n=>n+1);for(let j=1;j<ids.length-1;j++)tris.push([vs[ids[0]],vs[ids[j]],vs[ids[j+1]]]);}}}
    return tris;
  }
  function sampleDomainError(){
    if(doc.Setup.Type!=='Sample')return '';
    const domain=doc.Setup.Sample?.Domain;
    if(!Array.isArray(domain)||domain.length!==3||domain.some(pair=>!Array.isArray(pair)||pair.length!==2||!pair.every(Number.isFinite)))return 'Sample requires finite lower and upper bounds on all three axes.';
    const invalid=domain.map((pair,i)=>pair[1]<=pair[0]?'XYZ'[i]:null).filter(Boolean);
    return invalid.length?`Set upper bounds greater than lower bounds for ${invalid.join(', ')} before generating.`:'';
  }
  async function generate(){
    if(runProgress.busy||preparingGeneration)return;
    if(applyLatticeDraft&&!applyLatticeDraft())return;
    const latticeError=latticeWorkflowError();if(latticeError){toast(latticeError);return;}
    const domainError=sampleDomainError();if(domainError){selected='setup';refreshAll();toast(domainError);return;}
    if(!stepKeys().length){toast('Add at least one operation before generating.');return;}
    if(!invoke||!backendPath){toast('Choose ArtisanMain.exe or ArtisanMain.py with Backend… first.');return;}
    preparingGeneration=true;$('generate').disabled=true;
    try{if(!(await saveProject()))return;
      await runProgress.run({contents:workflowJson(Object.fromEntries(Object.entries(doc).filter(([key])=>key!=='ArtGUI'))).trimEnd(),backendPath,pythonPath:pythonPath||null,workflowPath:currentPath},doc.WorkFlow);
    }finally{preparingGeneration=false;$('generate').disabled=false;}
  }
  async function init(){
    $('backend-indicator').textContent=backendPath?nameForPath(backendPath):'Not connected';if(backendPath)$('backend-indicator').title=backendDescription();
    $('help-button').onclick=showAbout;
    $('new-project').onclick=newProject;$('open-project').onclick=openProject;$('save-project').onclick=saveProject;$('json-button').onclick=openJson;$('add-operation-bottom').onclick=showPicker;$('reset-properties').onclick=editSetup;$('remove-step').onclick=removeStep;$('move-up').onclick=()=>moveStep(-1);$('move-down').onclick=()=>moveStep(1);$('clear-workflow').onclick=clearWorkflow;$('choose-backend').onclick=chooseBackend;$('load-geometry').onclick=$('empty-load').onclick=loadGeometry;$('fit-view').onclick=()=>viewer?.fit();$('view-cube').onclick=()=>viewer?.reset();$('load-result').onclick=loadResult;$('preview-mode').onclick=()=>{if(loadedGeometryPath)loadPreview(loadedGeometryPath,loadedPreviewMode==='quick'?'full':'quick',loadedLayerId);};$('cancel-preview').onclick=cancelPreview;$('generate').onclick=generate;
    document.body.insertAdjacentHTML('beforeend','<input id="fallback-file" type="file" accept=".json,application/json" hidden>');$('fallback-file').onchange=e=>{const f=e.target.files[0];if(f){const r=new FileReader();r.onload=()=>loadWorkflow(r.result,f.name);r.readAsText(f);}};
    document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();saveProject();}if(e.key==='Escape')closeModal();});refreshAll();selected='setup';refreshTree();refreshProperties();
    viewerReady=(async()=>{
      try{
        const {GeometryViewer}=await import('./viewer.js');
        viewer=new GeometryViewer($('model-canvas'),{
          toast,
          onLayersChanged:()=>{refreshTree();if(selected==='geometry'||selected?.startsWith('file:'))refreshProperties();},
          onLayerSelected:(id,layer)=>{if(!layer)return;loadedLayerId=id;loadedGeometryPath=layer.path;loadedPreviewMode=layer.mode;updatePreviewMode(layer.mode,layer.total,layer.shown,/\.stl$/i.test(layer.path));$('mesh-info').textContent=`${id==='source'?'Source':id==='result'?'Result':nameForPath(layer.path)} · ${layer.mode==='quick'?'Quick preview':'Full detail'} · ${layer.metadata?fileStats(layer):layer.shown.toLocaleString()+' of '+layer.total.toLocaleString()+' triangles'}`;refreshTree();},
          exportImage:invoke?async blob=>{const path=await invoke('save_view_image',{pngData:Array.from(new Uint8Array(await blob.arrayBuffer()))});if(path)toast('Viewport image saved.');}:null
        });
      }catch(e){
        console.error('ArtGUI 3D viewer startup failed:',e);
        $('mesh-info').textContent='3D preview could not start. Workflow editing is available.';
        $('viewport-empty').querySelector('strong').textContent='3D preview unavailable';
        $('viewport-empty').querySelector('span').textContent='You can still select geometry and edit your workflow.';
        $('preview-mode').disabled=true;
      }
    })();
    // Keep editing and file dialogs usable if packaged backend discovery is slow.
    if(invoke&&!backendPath){invoke('packaged_backend').then(p=>{if(p){backendPath=p;localStorage.setItem('artisan.backend',p);$('backend-indicator').textContent=nameForPath(p);$('backend-indicator').title=p;}}).catch(()=>{});}
  }
  init().catch(e=>{console.error('ArtGUI interface startup failed:',e);setStatus('Interface could not start');toast(`Interface startup failed: ${e.message||e}`);});
})();
