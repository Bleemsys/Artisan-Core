import {createFieldMergeEditor} from './field-merge-editor.js';
import {fieldMergeKeyword,fieldMergeKeys,fieldMergeModeKeys,fieldMergeWorkflowError,fieldMergePreviewWorkflow,fieldMergeFingerprint} from './field-merge-model.js';
import {createGeometryFieldEditor} from './geometry-field-editor.js';
import {geometryFieldKeywords,geometryFieldTitles,geometryFieldWorkflowError,geometryFieldPreviewWorkflow,geometryFieldFingerprint,isDistanceField} from './geometry-field-model.js';
import {workflowPanelSubtitle} from './workflow-panel-subtitle.js';
import {createContourEditor} from './contour-editor.js';
import {bindSlotGrid,createSlotEditor} from './slot-editor.js';
import {slotKeyword,renameSlotFields,slotFingerprint,slotPreviewWorkflow,slotWorkflowError} from './slot-model.js';
import {readStlStream} from './stl-stream.mjs';
import {stlByteRanges} from './stl-source.mjs';
import {contourKeyword,contourFingerprint,contourMeshIds,contourPreviewWorkflow,contourResults,contourWorkflowError} from './contour-model.js';
import {primitiveMeshKeywords,primitiveMeshInfo,primitiveMeshKeys,primitiveMeshWorkflowError,primitiveMeshPreviewWorkflow,primitiveMeshFingerprint} from './primitive-mesh-model.js';
import {createPrimitiveMeshEditor} from './primitive-mesh-editor.js';
import {validateObjectOpacities,geometryOpacity,saveGeometryOpacity,applyGeometryOpacities} from './object-opacity.js';
import {validateGeometryColours,geometryColour,saveGeometryColour,applyGeometryColours} from './geometry-colours.js';
import {scalarFieldKeyword, prepareFieldOperation, newScalarRegion, fieldParameterInfo, fieldOperationHelp} from './field-workflow.js';
import {mesherKeywords,mesherKind,mesherTitle,earlierInputs,meshOutput,sizeFieldView,mesherRunWorkflow,applyMesherDraft,mesherFingerprint as quadFingerprint,mesherWorkflowError as quadWorkflowError,isMeshPath} from './size-field-mesher-model.js';
import {createSizeFieldMesherEditor} from './size-field-mesher-editor.js';
import {initLanguage, translate as t} from './i18n.js';
import {createRegionEditor} from './region-editor.js';
import {latticeKnown,latticeError,latticeWorkflowError as latticePanelWorkflowError,latticePreviewWorkflow,latticePreviewKey} from './lattice-model.js';
import {createSpatialEditor} from './spatial-editor.js';
import {transitionKeywords,transitionKnown,transitionError,transitionWorkflowError,transitionPreviewWorkflow} from './transition-model.js';
import {createSetupEditor} from './setup-editor.js';
import {spatialKeywords,replaceSpatialShape} from './spatial-model.js';
import {geometryKeywords,geometryOperationError,geometryPreviewWorkflow} from './geometry-model.js';
import {createMorphEditor} from './morph-editor.js';
import {morphKeyword,newMorph,morphWorkflowError,resolveMask,newMaskDefinition,morphPreviewWorkflow,maskRegions} from './morph-model.js';
import {meshSource,geometryType} from './region-model.js';
import {scalarWorkflowError,fieldPreviewWorkflow,newPrimitiveRegion} from './region-model.js';
import {ARTGUI_VERSION} from './version.js';
import {createFieldInspector} from './field-inspector.js';
import {createPointCloudInspector,validatePointReferences} from './point-cloud-inspector.js';
import {csvReferences} from './csv-references.mjs';
import {createWorkspacePanel} from './workspace-panel.js';
import {openOperationPicker} from './operation-picker.js';
import {isFieldFile, exportMode, setExportMode, exportError, exportWorkflowError, parseGridFieldIds} from './export-options.js';
import {operationIcon,iconLicense} from './operation-icons.js';
import {createRunProgress} from './run-progress.js';
import {createResourceMonitor} from './resource-monitor.js';
import {admitFullDetail,initialGeometryMode} from './preview-policy.mjs';
import {loadIndexedGeometry} from './full-detail-load.mjs';
import {integratedGroups,integratedNames,definitionTypes,isMeshType,definitionTemplate,definitionError,latticeReferences} from './lattice-schema.js';
import {createLatticeDefinitionEditor,supportsCellDesigner} from './lattice-definition-editor.js';
import {openStrutCellEditor} from './strut-cell-editor.js';
import {blankStrutDefinition} from './strut-cell-model.js';
import {openTpmsCellEditor} from './tpms-cell-editor.js';
import {newTpmsDefinition} from './tpms-cell-model.js';
import {openMeshCellEditor} from './mesh-cell-editor.js';
import {blankMeshDefinition,MESH_CELL_TYPES,MESH_CELL_LIMITS} from './mesh-cell-model.js';
import {parseNumericJson, stringifyNumericJson, cloneNumericJson, assignNumericJson, numberType, numberText, setNumber} from './numeric-json.js';

// Load the viewer after the editor is ready so a graphics dependency failure
// cannot prevent file dialogs and workflow buttons from being connected.
let viewerReady = Promise.resolve();

(() => {
  initLanguage();
  const invoke = window.__TAURI__?.core?.invoke;
  createResourceMonitor({invoke});
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clone = cloneNumericJson;
  let applyLatticeDraft=null;
  let adaptivePreview=null, cleaningScratch=false;
  const presetSelections = new WeakMap();
  const exportDrafts = new WeakMap();
  const fileIssues = new Map();
  const defaultSetup = parseNumericJson('{"Type":"Geometry","Sample":{"Domain":[[0.0,0.0],[0.0,0.0],[0.0,0.0]],"Shape":"Box"},"Geomfile":"","Rot":[0.0,0.0,0.0],"res":[5.0,5.0,5.0],"Padding":4,"onGPU":false,"JsonWorkDir":true,"memorylimit":1073741824000}');
  const defaultPost = {CombineMeshes:true,CleanExportedMesh:false,RemovePartitionMeshFile:false,RemoveIsolatedParts:true,ExportLazPts:false};
  let doc = {Setup:clone(defaultSetup),WorkFlow:{},PostProcess:clone(defaultPost)};
  let currentPath = '', selected = null, dirty = false, toastTimer, previewWorker = null, previewAbort = null, previewCancelReject = null, previewProgressUnlisten = null, activePreviewJob = '', previewRequest = 0, previewSelection = 0, loadedGeometryPath = '', loadedPreviewMode = '', loadedLayerId = 'source', viewer = null, backendPath = localStorage.getItem('artisan.backend') || '';

  const fieldInspector=createFieldInspector({invoke,isTemporary:isScratchPreview,isDiscarded:isDiscardedPreview,getViewer:()=>viewer,getReferences:()=>doc.ArtGUI?.fields||[],
    addReference:ref=>{const files=ensureFiles();files.fields ||= [];files.fields.push(ref);markDirty();},
    removeReference:id=>{if(doc.ArtGUI?.fields)doc.ArtGUI.fields=doc.ArtGUI.fields.filter(f=>f.id!==id);if(selected==='field:'+id)selected='setup';markDirty();},
    onSelect:id=>{selected='field:'+id;refreshAll();},onChange:()=>{refreshTree();if(selected?.startsWith('field:'))refreshProperties();},onReferenceChanged:markDirty,toast});

  const slotContext=params=>{
    const key=stepKeys().find(step=>doc.WorkFlow[step]?.[slotKeyword]===params);
    return key?{doc,key}:null;
  };
  const slotEditor=createSlotEditor({
    getContext:slotContext,onChange:markDirty,onRender:attachPropertyEvents,onPreview:previewSlotJoint,toast,
    onBrowse:showSlotGrid,
    onRename:(params,previous,next)=>{const c=slotContext(params);if(c)renameSlotFields(c.doc.WorkFlow,c.key,previous,next);},
    renderExtras:params=>{
      const known=['A','B','direction','open_A','open_B','split_ratio','clearance','Cutters'];
      const extra=Object.entries(params).filter(([key])=>!known.includes(key))
        .map(([key,value])=>field(key,value,slotKeyword+'.'+key,updateField)).join('');
      const presets=parameterPresetControl(slotKeyword,params);
      return extra||presets?'<details class="slot-section"><summary>Additional parameters</summary>'+presets+extra+'</details>':'';
    },
    isDiscarded:isDiscardedPreview,units:()=>viewer?.settings.units||'model units',
    getBounds:()=>doc.Setup.Type==='Sample'?doc.Setup.Sample?.Domain:setupMeshBounds(doc.Setup.Geomfile)
  });
  const contourContext=params=>{
    const key=stepKeys().find(step=>doc.WorkFlow[step]?.[contourKeyword]===params);
    return key?{doc,key}:null;
  };
  const contourEditor=createContourEditor({
    getContext:contourContext,onChange:markDirty,onRender:attachPropertyEvents,onPreview:previewContours,toast,
    renderExtras:params=>{
      const extra=Object.entries(params).filter(([key])=>!['res','PlaneHeights','out_meshfile'].includes(key))
        .map(([key,value])=>field(key,value,contourKeyword+'.'+key,updateField)).join('');
      const presets=parameterPresetControl(contourKeyword,params);
      return extra||presets?'<details class="contour-details"><summary>Additional parameters</summary>'+presets+extra+'</details>':'';
    },
    onBrowse:path=>{if(!invoke)throw Error('File browsing is available in the desktop app.');return invoke('choose_output',{kind:'contour',path});},
    isDiscarded:isDiscardedPreview,units:()=>viewer?.settings.units||'model units',
    getBounds:()=>doc.Setup.Type==='Sample'?doc.Setup.Sample?.Domain:setupMeshBounds(doc.Setup.Geomfile)
  });
  const fieldMergeContext=params=>{for(const key of stepKeys())if(doc.WorkFlow[key]?.[fieldMergeKeyword]===params)return {doc,key,keyword:fieldMergeKeyword};return null;};
  const fieldMergeEditor=createFieldMergeEditor({getContext:fieldMergeContext,onChange:markDirty,toast,onRender:attachPropertyEvents,inspector:fieldInspector,meshBounds:influenceMeshBounds,
    onReveal:params=>{const c=fieldMergeContext(params);if(c){selected=c.key;refreshAll();}},
    latticePicker:(path,value)=>latticePicker('fm-lattice-'+path.replaceAll('.','-'),value,`data-fm-text="${path}"`,`data-fm-lattice-browse="${path}"`).replace('aria-label="Lattice selection"',`aria-label="${path==='la_name'?'Target lattice':'Bridge lattice'}"`),
    browseLattice:async()=>{if(!invoke)throw Error('Definition import is available in the desktop app.');return invoke('choose_lattice_input',{kind:'la_name'});},
    browseFile:async()=>{if(!invoke)throw Error('File browsing is available in the desktop app.');return invoke('choose_supporting_file');},
    fit:()=>viewer?.fit(),onGenerate:generateFieldMerge,
    sourceVisible:()=>!!viewer?.layers.get('source')?.mesh.visible,sourceAvailable:()=>!!viewer?.layers.has('source'),setSourceVisible:v=>viewer?.setLayerVisible('source',v),
    renderExtras:params=>{
      const extra=Object.entries(params).filter(([key])=>!fieldMergeKeys.includes(key)).map(([key,value])=>field(key,value,`${fieldMergeKeyword}.${key}`,updateField)).join('');
      const op=Object.entries(params.OP_para||{}).filter(([key])=>!fieldMergeModeKeys.includes(key)).map(([key,value])=>field(key,value,`${fieldMergeKeyword}.OP_para.${key}`,updateField)).join('');
      const bridge=Object.entries(params.OP_para?.Transition||{}).filter(([key])=>!['la_name','size','thk','Weight','f_trans'].includes(key)).map(([key,value])=>field(key,value,`${fieldMergeKeyword}.OP_para.Transition.${key}`,updateField)).join('');
      return parameterPresetControl(fieldMergeKeyword,params)+extra+op+bridge;
    }
  });
  async function generateFieldMerge(params,c){
    if(runProgress.busy||preparingGeneration)return;
    if(!invoke||!backendPath)throw Error('Choose an Artisan backend with Backend… first.');
    const originalDoc=doc,fingerprint=fieldMergeFingerprint(doc,c.key),domainIssue=sampleDomainError();if(domainIssue)throw Error(domainIssue);
    const output=await scratchPreviewPath(c.key,'field_merge.h5');
    const isCurrent=()=>doc===originalDoc&&fieldMergeContext(params)&&fieldMergeFingerprint(doc,c.key)===fingerprint;
    if(!output||!isCurrent())return;
    const preview=fieldMergePreviewWorkflow(doc,c.key,output);
    const result=await runPanelWorkflow(preview,isCurrent,output);
    if(!result?.success)return result;
    if(!isCurrent()||isDiscardedPreview(output))return;
    const info=await fieldInspector.load(output,null,'lattice',{strictField:true,select:false});
    if(!info)throw Error('The preview was generated but its field could not be opened.');
    if(doc!==originalDoc||!fieldMergeContext(params)||fieldMergeFingerprint(doc,c.key)!==fingerprint)return;
    fieldInspector.setVisible(true);selected=c.key;refreshAll();return {...result,fieldPath:output,field:'lattice'};
  }

  const geometryFieldContext=params=>{for(const key of stepKeys())for(const keyword of geometryFieldKeywords)if(doc.WorkFlow[key]?.[keyword]===params)return {doc,key,keyword};return null;};
  function influenceMeshBounds(path){const norm=s=>String(s||'').replaceAll('\\','/').toLowerCase(),layer=[...(viewer?.layers.values()||[])].find(l=>norm(l.path)===norm(path));if(!layer||layer.box.isEmpty())return null;const b=layer.box.clone().translate(viewer.origin);return [b.min.toArray(),b.max.toArray()];}
  const geometryFieldEditor=createGeometryFieldEditor({getContext:geometryFieldContext,onChange:markDirty,toast,onRender:attachPropertyEvents,inspector:fieldInspector,meshBounds:influenceMeshBounds,
    onReveal:params=>{const c=geometryFieldContext(params);if(c){selected=c.key;refreshAll();}},
    browse:async()=>{if(!invoke)throw Error('File browsing is available in the desktop app.');return invoke('choose_geometry');},
    selectedSource:()=>viewer?.layers.get(viewer.activeLayer)?.path||loadedGeometryPath||doc.Setup.Geomfile||projectFiles()[0]?.path,
    loadSource:async path=>{if(!invoke)throw Error('Mesh preview is available in the desktop app.');if(!path||!/[.](stl|obj|ply|inp)$/i.test(path))throw Error('Preview needs an STL, OBJ, PLY or INP file. Computed mesh IDs are evaluated by Artisan.');await loadPreview(path,'auto','source');viewer?.setLayerVisible('source',true);},
    sourceVisible:()=>!!viewer?.layers.get('source')?.mesh.visible,sourceAvailable:()=>!!viewer?.layers.has('source'),setSourceVisible:v=>viewer?.setLayerVisible('source',v),
    units:()=>viewer?.settings.units||'model units',fit:()=>viewer?.fit(),onGrid:()=>{selected='setup';refreshAll();},onGenerate:generateGeometryField,
    renderExtras:(keyword,params)=>{const known=isDistanceField(keyword)?['inp_meshfile','out_gridfieldFile']:['Name','Paras','min','max','min_val','max_val','min_max_opt'];const keys={Box:['ori','normal','length','z_angle'],Sphere:['ori','r'],Cylinder:['pa','pb','r']}[params.Name]||[];
      const extra=Object.entries(params).filter(([key])=>!known.includes(key)).map(([key,value])=>field(key,value,`${keyword}.${key}`,updateField)).join('');
      const paras=!isDistanceField(keyword)&&params.Paras?Object.entries(params.Paras).filter(([key])=>!keys.includes(key)).map(([key,value])=>field(key,value,`${keyword}.Paras.${key}`,updateField)).join(''):'';
      const flags=!isDistanceField(keyword)?field('min_max_opt',params.min_max_opt,`${keyword}.min_max_opt`,updateField):'';
      return extra||paras||flags?`<details class="pm-viewport-tools"><summary>Advanced</summary>${extra}${paras}${flags}</details>`:'';}
  });
  async function generateGeometryField(params,c){
    if(runProgress.busy||preparingGeneration)return;
    if(!invoke||!backendPath)throw Error('Choose an Artisan backend with Backend… first.');
    const originalDoc=doc,original=geometryFieldFingerprint(doc,c.key),domainIssue=sampleDomainError();if(domainIssue)throw Error(domainIssue);
    const output=await scratchPreviewPath(c.key,isDistanceField(c.keyword)?'distance_field.h5':'offset_field.h5');
    const isCurrent=()=>doc===originalDoc&&geometryFieldFingerprint(doc,c.key)===original;
    if(!output||!isCurrent())return;
    const preview=geometryFieldPreviewWorkflow(doc,c.key,output);
    const result=await runPanelWorkflow(preview.workflow,isCurrent,output);
    if(!result?.success)return result;
    if(!isCurrent()||isDiscardedPreview(output))return;
    const info=await fieldInspector.load(output,null,preview.field,{strictField:true,select:false,distance:isDistanceField(c.keyword)});
    if(!info)throw Error('The preview was generated but its field could not be opened.');
    if(doc!==originalDoc||geometryFieldFingerprint(doc,c.key)!==original)return;
    fieldInspector.setVisible(true);selected=c.key;refreshAll();return {...result,fieldPath:output,field:preview.field};
  }

  const primitiveMeshPaths=new WeakMap();
  const primitiveMeshContext=params=>{
    for(const key of stepKeys())for(const keyword of primitiveMeshKeywords)if(doc.WorkFlow[key]?.[keyword]===params)return {doc,key,keyword};
    return null;
  };
  const primitiveMeshEditor=createPrimitiveMeshEditor({getContext:primitiveMeshContext,onChange:markDirty,toast,onRender:attachPropertyEvents,
    onViewDisplay:mode=>{if(viewer&&viewer.display!==mode)viewer.setDisplay(mode);if(viewer)$('display-select').value=mode;},
    onKeywordChange:(previous,next,params)=>{
      const key=stepKeys().find(key=>doc.WorkFlow[key]?.[previous]===params);if(!key)return;
      doc.WorkFlow[key]=Object.fromEntries(Object.entries(doc.WorkFlow[key]).map(([k,p])=>k===previous?[next,params]:[k,p]));
      $('properties-title').textContent=primitiveMeshInfo[next].name;$('properties-subtitle').textContent=workflowPanelSubtitle(doc.WorkFlow,key);
    },
    onReveal:params=>{const c=primitiveMeshContext(params);if(c){selected=c.key;refreshAll();}},
    onBrowse:async path=>{if(!invoke)throw Error('File browsing is available in the desktop app.');return invoke('choose_output',{kind:'primitive_mesh',path:/[.](inp|med|vtk|msh)$/i.test(path)?path:'PrimitiveMesh.inp'});},
    onGenerate:generatePrimitiveMesh,isDiscardedPreview,
    renderExtras:(keyword,params)=>{
      const extra=Object.entries(params).filter(([key])=>!primitiveMeshKeys.includes(key)).map(([key,value])=>field(key,value,`${keyword}.${key}`,updateField)).join('');
      const presets=parameterPresetControl(keyword,params);return extra||presets?`<details class="transition-other"><summary>Additional parameters</summary>${presets}${extra}</details>`:'';
    }
  });
  async function generatePrimitiveMesh(params,c,temporary=false){
    if(runProgress.busy||preparingGeneration)return;
    if(!invoke||!backendPath)throw Error('Choose an Artisan backend with Backend… first.');
    const originalDoc=doc,fingerprint=primitiveMeshFingerprint(c.keyword,params);
    const filePath=/[.](inp|med|vtk|msh)$/i.test(params.Mesh_file)?params.Mesh_file:null;
    const output=temporary?await scratchPreviewPath(c.key,'mesh.inp'):
      await invoke('choose_output',{kind:'primitive_mesh',path:primitiveMeshPaths.get(params)||filePath||primitiveMeshInfo[c.keyword].shape+'Mesh.inp'});
    const isCurrent=()=>doc===originalDoc&&primitiveMeshContext(params)?.key===c.key&&primitiveMeshContext(params)?.keyword===c.keyword&&primitiveMeshFingerprint(c.keyword,params)===fingerprint;
    if(!output||!isCurrent())return;
    const preview=primitiveMeshPreviewWorkflow(doc,c.key,output);
    const result=await runPanelWorkflow(preview,isCurrent,temporary?output:null);
    if(!result?.success)return result;
    if(!isCurrent()||isDiscardedPreview(output))return;
    if(!temporary)primitiveMeshPaths.set(params,output);
    if(/[.](inp|stl|obj|ply)$/i.test(output)){
      try{fieldInspector.setVisible(false);viewer?.setLayerVisible('source',false);await openResult(output);viewer?.setDisplay('edges');if(viewer)$('display-select').value='edges';}
      catch(error){toast('Mesh generated. Preview could not be opened: '+String(error.message||error));}
    }
    selected=c.key;refreshAll();return {...result,meshPath:output};
  }

  let mesherReturn=null;
  const mesherPreviewPaths=new WeakMap(),mesherFieldViews=new WeakMap();
  const mesherContext=params=>{
    for(const key of stepKeys())for(const keyword of mesherKeywords)if(doc.WorkFlow[key]?.[keyword]===params)return {doc,key,keyword};
    return null;
  };
  const mesherEditor=createSizeFieldMesherEditor({getContext:mesherContext,onRender:attachPropertyEvents,toast,
    onCommit:(params,draft)=>{const c=mesherContext(params);if(!c)throw Error('This meshing step is no longer in the workflow.');applyMesherDraft(params,draft,doc.WorkFlow,c.key,c.keyword);markDirty();},
    renderPresets:(params,keyword)=>parameterPresetControl(keyword,params),
    onBrowse:async(name,params,keyword,raw)=>{
      if(!invoke)throw Error('File browsing is available in the desktop app.');
      const tet=mesherKind(keyword)==='tet';
      return name==='mesh_file'?invoke('choose_geometry'):invoke('choose_output',{
        kind:name==='quality_report'?(tet?'tet_report':'quad_report'):tet?'tet_mesh':raw.split_to_triangles?'triangle_mesh':'quad_mesh',
        path:raw[name]||(name==='quality_report'?(tet?'TetDomains_quality.json':'QuadSurface_quality.json'):(tet?'TetDomains.inp':'QuadSurface.inp'))});
    },
    onEditField:(field,params)=>{mesherReturn=params;selected=field.key;refreshAll();},
    onReveal:params=>{const c=mesherContext(params);if(c){selected=c.key;refreshAll();}},
    onView:viewSizeFieldMesh,isDiscardedPreview,onBeforeGenerate:()=>!applyLatticeDraft||applyLatticeDraft(),onGenerate:generateSizeFieldMesh,
    getFieldInfo:(params,id)=>{const view=mesherFieldViews.get(params);return view?.doc===doc&&view.fieldId===id?fieldInspector.describe(view.path,view.storedId):null;},
    onReport:readSizeFieldReport,
    onOpenReport:(entry,keyword)=>showModal(`<div class="modal-head"><div><h2>${mesherKind(keyword)==='tet'?'Tet volume quality report':'Quad surface quality report'}</h2><p translate="no">${esc(entry.path)}</p></div><button class="icon-button" data-close aria-label="Close">×</button></div><div class="modal-body"><pre class="log-output">${esc(JSON.stringify(entry.report,null,2))}</pre></div><div class="modal-foot"><button class="button primary" data-close>Close</button></div>`)
  });
  async function readSizeFieldReport(params,context=mesherContext(params),path=params.quality_report){
    if(!invoke)throw Error('Quality reports are available in the desktop app.');
    if(!context)throw Error('This meshing step is no longer in the workflow.');
    const value=await invoke(mesherKind(context.keyword)==='tet'?'read_tet_report':'read_quad_report',{path,workflowPath:currentPath||null,backendPath:backendPath||null,jsonWorkDir:doc.Setup.JsonWorkDir??null});
    return {...value,meshPath:mesherPreviewPaths.get(params)||meshOutput(doc.WorkFlow,context.key,params)};
  }
  async function viewSizeFieldMesh(mode,params,record,view={}){
    if(!invoke)throw Error('Field and mesh viewing are available in the desktop app.');
    if(runProgress.busy||preparingGeneration)throw Error('Wait for Artisan to finish exporting.');
    const c=mesherContext(params);if(!c)return;
    const originalDoc=doc,outputContext={workflowPath:currentPath||null,backendPath:backendPath||null,jsonWorkDir:doc.Setup.JsonWorkDir??null};
    if(mode==='field'){
      const descriptor=sizeFieldView(doc.WorkFlow,c.key,view.size_field??params.size_field,doc.ArtGUI?.fields||[]);
      if(!descriptor?.path)throw Error('No saved HDF5 data is available for this size field. Export or load the selected field before viewing it.');
      const path=await invoke('resolve_field_output',{path:descriptor.path,...outputContext});
      if(doc!==originalDoc||!mesherContext(params))return;
      mesherReturn=params;
      const info=await fieldInspector.load(path,null,descriptor.storedId,{strictField:true});
      if(info&&doc===originalDoc){mesherFieldViews.set(params,{...descriptor,path,doc});fieldInspector.setVisible(true);}
      return info;
    }
    if(mode==='source'){
      const source=view.mesh_file??params.mesh_file,producer=earlierInputs(doc.WorkFlow,c.key).meshes.find(mesh=>mesh.id===source);
      const path=isMeshPath(source)?source:producer?.path;
      if(!path)throw Error('This source mesh is computed by Artisan. Export it before previewing it.');
      fieldInspector.setVisible(false);viewer?.setLayerVisible('result',false);await loadPreview(path,'auto','source');viewer?.setLayerVisible('source',true);return;
    }
    const path=record?.meshPath||mesherPreviewPaths.get(params)||meshOutput(doc.WorkFlow,c.key,params);
    if(!path)throw Error('Generate this mesh or add an INP mesh export before viewing it.');
    if(!/[.](inp|stl|obj|ply)$/i.test(path))throw Error('Preview supports INP, STL, OBJ and PLY. Export an INP copy to inspect element edges.');
    const resolved=await invoke('resolve_export_output',{path,...outputContext});
    if(doc!==originalDoc||!mesherContext(params))return;
    fieldInspector.setVisible(false);viewer?.setLayerVisible('source',false);await openResult(resolved);viewer?.setLayerVisible('result',true);viewer?.setDisplay('edges');if(viewer)$('display-select').value='edges';selected=c.key;refreshAll();
  }
  async function generateSizeFieldMesh(params,c,temporary=false){
    if(runProgress.busy||preparingGeneration)return;
    if(!invoke||!backendPath)throw Error('Choose an Artisan backend with Backend… first.');
    const originalDoc=doc,original=quadFingerprint(doc,c.key),tet=mesherKind(c.keyword)==='tet';
    let meshPath=temporary?await scratchPreviewPath(c.key,'mesh.inp'):
      isMeshPath(params.export_mesh)?params.export_mesh:mesherPreviewPaths.get(params)||meshOutput(doc.WorkFlow,c.key,params);
    if(!temporary&&!meshPath)meshPath=await invoke('choose_output',{kind:tet?'tet_mesh':params.split_to_triangles?'triangle_mesh':'quad_mesh',path:tet?'TetDomains.inp':'QuadSurface.inp'});
    const isCurrent=()=>doc===originalDoc&&mesherContext(params)?.key===c.key&&quadFingerprint(doc,c.key)===original;
    if(!meshPath||!isCurrent())return;
    const reportPath=(!temporary&&params.quality_report)||meshPath.replace(/[.][^./\\]+$/,'')+'_quality.json';
    const preview=mesherRunWorkflow(doc,c.key,c.keyword,meshPath,reportPath);
    const result=await runPanelWorkflow(preview,isCurrent,temporary?meshPath:null);
    if(!result?.success)return result;
    if(!isCurrent()||isDiscardedPreview(meshPath))return;
    if(!temporary)mesherPreviewPaths.set(params,meshPath);
    let record=null,reportError='';
    try{record=await readSizeFieldReport(params,c,reportPath);record.meshPath=meshPath;}catch(error){reportError='Mesh generated, but its quality report could not be loaded: '+String(error.message||error);}
    if(/[.](inp|stl|obj|ply)$/i.test(meshPath))try{await viewSizeFieldMesh('mesh',params,{meshPath});}catch(error){toast(String(error.message||error));}
    selected=c.key;refreshAll();return {...result,meshPath,record,reportError};
  }

  function setupMeshBounds(path){
    const layer=viewer?.layers.get('source'),norm=s=>String(s||'').replaceAll('\\','/').toLowerCase();
    if(!layer||!path||norm(layer.path)!==norm(path)||layer.box.isEmpty())return null;
    const box=layer.box.clone().translate(viewer.origin);return [0,1,2].map(i=>[box.min.getComponent(i),box.max.getComponent(i)]);
  }
  const setupEditor=createSetupEditor({getViewer:()=>viewer,getMeshBounds:setupMeshBounds,
    onChange:()=>{markDirty();updateGeometryLabel();},toast,
    browseMesh:async()=>{if(!invoke)throw Error('Mesh browsing is available in the desktop app.');return invoke('choose_geometry');},
    loadMesh:async path=>{if(!invoke)throw Error('Mesh preview is available in the desktop app.');await loadPreview(path);},
    renderExtra:(s,p)=>{
      const knownSetup=['Type','Sample','Geomfile','Rot','res','Padding','onGPU','JsonWorkDir','memorylimit'],knownPost=['CombineMeshes','CleanExportedMesh','RemovePartitionMeshFile','RemoveIsolatedParts','ExportLazPts'];
      return Object.entries(s).filter(([k])=>!knownSetup.includes(k)).map(([k,v])=>field(k,v,'Setup.'+k,updateField)).join('')+Object.entries(p).filter(([k])=>!knownPost.includes(k)).map(([k,v])=>field(k,v,'PostProcess.'+k,updateField)).join('');
    },bindExtra:attachPropertyEvents});

  const regionEditor=createRegionEditor({getViewer:()=>viewer,getSetup:()=>doc.Setup,
    getGeometries:()=>[{path:doc.Setup.Geomfile},...(doc.ArtGUI?.geometry||[])].filter(f=>f.path),
    onChange:markDirty,onRender:renderMorphReturn,onGrid:()=>{selected='setup';refreshAll();},onViewField:viewField,toast,
    browseMesh:async()=>{if(!invoke)throw Error('Mesh browsing is available in the desktop app.');return invoke('choose_geometry');},
    loadMesh:async path=>{if(!invoke)throw Error('Mesh preview is available in the desktop app.');if(!path||!/[.](stl|obj|ply|inp)$/i.test(path))throw Error('Preview needs an STL, OBJ, PLY or INP file. Computed mesh IDs are evaluated by Artisan.');
      let ref=projectFiles().find(f=>f.path===path);
      if(!ref){ref={id:'geometry-'+crypto.randomUUID(),path};ensureFiles().geometry.push(ref);markDirty();}
      await loadPreview(path,'auto',ref.id);
    },onPreview:previewScalarField});

  const spatialEditor=createSpatialEditor({getViewer:()=>viewer,getSetup:()=>doc.Setup,onChange:markDirty,onRefresh:refreshProperties,toast,
    getGeometries:()=>[{path:doc.Setup.Geomfile},...projectFiles()].filter(f=>f.path),
    onOperationChange:(old,next,params)=>{const step=selectedStep();if(!geometryKeywords.includes(next)||step?.[old]!==params)return;if(Object.hasOwn(step,next)){toast('This step already contains that operation.');return;}doc.WorkFlow[selected]=Object.fromEntries(Object.entries(step).map(([k,v])=>[k===old?next:k,v]));markDirty();refreshProperties();},
    onPreview:previewGeometry,
    getLatticeType:p=>latticeDefinitions().find(d=>d.params.la_name===p.la_name)?.params.definition?.type,
    getLatticePreviewKey:p=>latticePreviewKey(doc,stepKeys().find(k=>doc.WorkFlow[k]?.Add_Lattice===p)),
    latticePicker:p=>latticePicker('transition-lattice',p.la_name,'data-transition-name','data-transition-browse'),
    browseLattice:async()=>{if(!invoke)throw Error('Definition import is available in the desktop app.');return invoke('choose_lattice_input',{kind:'la_name'});},
    browseMesh:async()=>{if(!invoke)throw Error('Mesh browsing is available in the desktop app.');return invoke('choose_geometry');},
    getUsedFieldIds:()=>{const ids=[];const visit=o=>{if(o&&typeof o==='object')for(const [k,v] of Object.entries(o)){if(['FieldID','field_id'].includes(k)&&typeof v==='string')ids.push(v);else if(v&&typeof v==='object')visit(v);}};visit(doc.WorkFlow);return ids;},
    loadMesh:async path=>{if(!invoke)throw Error('Mesh preview is available in the desktop app.');if(!/[.](stl|obj|ply|inp)$/i.test(path))throw Error('Preview needs an STL, OBJ, PLY or INP file. Computed mesh IDs are evaluated by Artisan.');await loadPreview(path,'auto','spatial-source');}});

  let morphReturn=null;
  const morphContext=params=>({workflow:doc.WorkFlow,key:stepKeys().find(k=>doc.WorkFlow[k]?.[morphKeyword]===params),setup:doc.Setup});
  const morphEditor=createMorphEditor({getContext:morphContext,getViewer:()=>viewer,onChange:markDirty,
    onGrid:()=>{selected='setup';refreshAll();},onViewField:viewField,onPreview:previewMorph,toast,
    onEditMask:(id,params)=>{const context=morphContext(params),mask=resolveMask(doc.WorkFlow,context.key,id);if(mask?.regions){morphReturn=params;selected=mask.key;refreshAll();}},
    onCreateMask:(role,params,index)=>{
      const context=morphContext(params);if(!context.key)return;
      const mask=newMaskDefinition(role,doc.Setup,doc.WorkFlow),entries=stepKeys().map(k=>doc.WorkFlow[k]),at=stepKeys().indexOf(context.key);
      if(role==='moving')params.moving_regions[index].mask=mask.field_id;else params[role]=mask.field_id;
      entries.splice(at,0,{[scalarFieldKeyword]:mask});doc.WorkFlow=Object.fromEntries(entries.map((s,i)=>[String(i+1),s]));
      morphReturn=params;selected=String(at+1);markDirty();refreshProperties();toast('Mask inserted before morph. Set its shape, then return to morph.');
    },loadMaskMeshes:async params=>{
      if(!invoke)throw Error('Mesh loading is available in the desktop app.');
      const context=morphContext(params),ids=[params.domain_mask,params.fixed_mask,...(params.moving_regions||[]).map(r=>r.mask)].filter(Boolean);
      const paths=[...new Set(ids.flatMap(id=>maskRegions(doc.WorkFlow,context.key,id)).filter(r=>geometryType(r.geometry)==='Mesh').map(r=>meshSource(r.geometry)))];
      if(!paths.length){toast('These masks use primitive regions, or their geometry is computed by Artisan.');return;}
      for(const path of paths){if(!/[.](stl|obj|ply|inp)$/i.test(path))continue;let ref=projectFiles().find(f=>f.path===path);if(!ref){ref={id:'geometry-'+crypto.randomUUID(),path};ensureFiles().geometry.push(ref);markDirty();}await loadPreview(path,'auto',ref.id);}
    }});

  function renderMorphReturn(){
    if(morphReturn&&stepKeys().some(k=>doc.WorkFlow[k]?.[morphKeyword]===morphReturn)){
      const button=document.createElement('button');button.className='button morph-return';button.textContent='← Return to morph';button.onclick=()=>{selected=morphContext(morphReturn).key;morphReturn=null;refreshAll();};$('properties-content').prepend(button);
    }
  }

  // Resize the existing viewer in place; its camera, layers and field session stay alive.
  const workspace=document.querySelector('.workspace'),expandWorkspace=$('expand-workspace');
  createWorkspacePanel(workspace);
  let workspaceExpanded=false;
  function setWorkspaceExpanded(expanded){
    workspaceExpanded=expanded;
    workspace.classList.toggle('workspace-expanded',expanded);
    expandWorkspace.setAttribute('aria-pressed',String(expanded));
    expandWorkspace.setAttribute('aria-label',expanded?'Restore workspace layout':'Expand workspace');
    expandWorkspace.title=expanded?'Restore workspace layout (Esc)':'Expand workspace';
    $('workspace-size-label').textContent=expanded?'Restore layout':'Expand';
    $('workspace-size-icon').setAttribute('d',expanded?'M3 7h4V3m6 0v4h4M7 17v-4H3m14 0h-4v4':'M7 3H3v4m10-4h4v4M3 13v4h4m10-4v4h-4');
    if(expanded)expandWorkspace.setAttribute('aria-keyshortcuts','Escape');
    else expandWorkspace.removeAttribute('aria-keyshortcuts');
  }
  expandWorkspace.onclick=()=>setWorkspaceExpanded(!workspaceExpanded);
  document.addEventListener('keydown',event=>{
    if(event.key!=='Escape'||event.defaultPrevented||event.isComposing||!workspaceExpanded)return;
    // Let dialogs, editors, viewer menus and measurement tools handle Escape first.
    if(!$('modal-backdrop').classList.contains('hidden')||
       event.target.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"])')||
       $('viewer-toolbar').querySelector('details[open]')||viewer&&viewer.measureMode!=='off')return;
    event.preventDefault();event.stopImmediatePropagation();
    setWorkspaceExpanded(false);expandWorkspace.focus();
  });

  let pythonPath=localStorage.getItem('artisan.python')||'';
  let preparingGeneration=false;
  const runProgress=createRunProgress({invoke,labelFor:titleFor,listen:window.__TAURI__?.event?.listen,toast,onBusy:busy=>{
    document.querySelectorAll('.project-panel,.properties-panel,.workflow-controls').forEach(el=>el.inert=busy);
    primitiveMeshEditor.suspend(busy);geometryFieldEditor.suspend(busy);fieldMergeEditor.suspend(busy);setupEditor.suspend(busy);
    if(busy){viewer?.regionOverlay?.hide();viewer?.morphOverlay?.hide();viewer?.spatialOverlay?.hide();}else{regionEditor.refresh();morphEditor.refresh();spatialEditor.refresh();setupEditor.refresh();mesherEditor.refresh();}
    for(const id of ['new-project','open-project','save-project','save-project-as','json-button','choose-backend','load-geometry','empty-load','load-result','view-generated-field'])$(id).disabled=busy;
  }});

  function markDirty(){dirty=true;$('project-name').translate=!currentPath;$('dirty-state').textContent='Unsaved changes';$('project-name').textContent=currentPath?currentPath.split(/[\\/]/).pop():'Untitled workflow';refreshTree();refreshTimeline();}
  function stepKeys(){return Object.keys(doc.WorkFlow||{}).sort((a,b)=>Number(a)-Number(b));}
  function selectedStep(){return selected && doc.WorkFlow[selected] ? doc.WorkFlow[selected] : null;}
  function stepTitle(key){const s=doc.WorkFlow[key]||{};return Object.keys(s)[0]||'Operation';}
  function titleFor(k){const label=(window.ARTISAN_OPERATIONS||[]).find(o=>o.keyword===k)?.label;if(label)return label;return k.replace(/_/g,' ').replace(/([a-z])([A-Z])/g,'$1 $2').replace(/\bOp\b/g,'Field').trim();}
  function human(v){if(Array.isArray(v))return v.some(item=>item&&typeof item==='object')?`${v.length} ${v.length===1?'item':'items'}`:v.join(' × ');if(v&&typeof v==='object')return Object.keys(v).length?`${Object.keys(v).length} parameters`:'…';return String(v);}
  function toast(message){const el=$('toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2600);}
  function setStatus(text,busy=false){$('status-text').textContent=text;$('run-dot').classList.toggle('online',!busy&&text.toLowerCase().includes('ready'));}
  const pointCloudInspector=createPointCloudInspector({invoke,getViewer:()=>viewer,getReferences:()=>doc.ArtGUI?.pointClouds||[],
    getCsvReferences:()=>csvReferences(doc),getWorkflowPath:()=>currentPath||null,
    addReference:ref=>{ensureFiles().pointClouds ||= [];doc.ArtGUI.pointClouds.push(ref);markDirty();},
    removeReference:id=>{doc.ArtGUI.pointClouds=doc.ArtGUI.pointClouds.filter(r=>r.id!==id);if(selected==='points:'+id)selected='setup';markDirty();},
    onSelect:id=>{selected='points:'+id;refreshAll();},onChange:()=>{refreshTree();if(selected?.startsWith('points:'))refreshProperties();},onReferenceChanged:markDirty,
    showModal,closeModal,toast,ready:()=>viewerReady,pauseMemory:(assessment,signal)=>pauseFullDetailMemory(assessment,previewRequest,signal)});
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
    for(const step of Object.values(result.WorkFlow)){
      for(const [keyword,params] of Object.entries(step))prepareFieldOperation(keyword,params);
      const params=step.Gen_ConformalLatticeMesh;
      if(params&&!Object.hasOwn(params,'Rot'))params.Rot=parseNumericJson('[0.0,0.0,0.0]');
    }
    result.PostProcess=assignNumericJson(clone(defaultPost),value.PostProcess||{});
    if(value.ArtGUI!==undefined){
      const state=value.ArtGUI;
      if(!state||typeof state!=='object'||state.version!==1)throw Error('Unsupported ArtGUI project metadata.');
      validateGeometryColours(state);
      const ids=new Set(['source']);
      for(const key of ['geometry','supportingFiles']){
        if(!Array.isArray(state[key]))throw Error('Invalid project file list.');
        for(const f of state[key]){if(!f||typeof f.id!=='string'||! /^(result|geometry-[a-z0-9-]+|support-[a-z0-9-]+)$/.test(f.id)||ids.has(f.id)||typeof f.path!=='string'||!f.path.trim())throw Error('Invalid or duplicate project file reference.');ids.add(f.id);}
      }
    }
    if(result.ArtGUI?.fields!==undefined){
      const fields=result.ArtGUI.fields,ids=new Set([...result.ArtGUI.geometry,...result.ArtGUI.supportingFiles].map(f=>f.id));
      if(!Array.isArray(fields)||fields.length>32)throw Error('Invalid field file list.');
      for(const f of fields){if(!f||typeof f.id!=='string'||!/^field-[a-z0-9-]+$/.test(f.id)||ids.has(f.id)||typeof f.path!=='string'||!f.path.trim()||(f.fieldId!==undefined&&typeof f.fieldId!=='string')||(f.blockId!==undefined&&(!Number.isSafeInteger(f.blockId)||f.blockId<0)))throw Error('Invalid field file reference.');ids.add(f.id);}
    }
    if(result.ArtGUI?.pointClouds!==undefined)validatePointReferences(result.ArtGUI.pointClouds,[...result.ArtGUI.geometry,...result.ArtGUI.supportingFiles,...(result.ArtGUI.fields||[])].map(f=>f.id));
    if(result.ArtGUI)validateObjectOpacities(result.ArtGUI);
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
    return [true,false].map(mesh=>`<div class="tree-group"><div class="project-group-heading"><span class="tree-label">${mesh?'Mesh / Conformal lattices':'Custom unit cells'}</span><button class="text-button" data-new-lattice="${mesh?'mesh':'cell'}" aria-label="Add ${mesh?'mesh or conformal lattice':'custom unit cell'}">＋ Add</button></div>${definitions.filter(({params})=>isMeshType(params.definition?.type)===mesh).map(({key,params})=>`<button class="tree-item project-file ${selected===key?'active':''}" data-lattice-step="${esc(key)}"><span class="project-file-text"><strong translate="no">${esc(params.la_name)}</strong><small>${esc(definitionTypes[params.definition?.type]||params.definition?.type||'Definition')}</small></span></button>`).join('')}${refs.filter(v=>/\.mld$/i.test(v)===mesh).map(v=>`<button class="tree-item project-file" data-lattice-reference="${esc(v)}" title="${esc(v)}"><span class="project-file-text"><strong translate="no">${esc(nameForPath(v))}</strong><small>External definition · import to edit</small></span></button>`).join('')}<button class="text-button lattice-import" data-import-lattice="${mesh?'mesh':'cell'}">Import .${mesh?'mld':'txt'}…</button></div>`).join('');
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
  function editCellDefinition(params=null,initial=null){
    if(runProgress.busy||preparingGeneration){toast('Wait for generation to finish before editing the cell.');return;}
    const originalDoc=doc,original=params?stringifyNumericJson(params):null;
    const name=initial?.name??params?.la_name??uniqueLatticeName('CustomCell');
    const definition=initial?.definition??params?.definition??blankStrutDefinition();
    const openEditor=MESH_CELL_TYPES.includes(definition.type)?openMeshCellEditor:definition.type==='TPMS'?openTpmsCellEditor:openStrutCellEditor;
    const validateContext=()=>{if(doc!==originalDoc||params&&(!latticeDefinitions().some(d=>d.params===params)||stringifyNumericJson(params)!==original))throw Error('The project definition changed while this draft was open. Reopen the cell before applying.');if(runProgress.busy||preparingGeneration)throw Error('Wait for generation to finish before applying the cell.');};
    const loadCellMesh=async(path,signal)=>{const file=await invoke('resolve_geometry',{path,workflowPath:currentPath||null});if(file.size>MESH_CELL_LIMITS.fileBytes)throw Error('Mesh files are limited to 32 MB.');const response=await fetch(window.__TAURI__.core.convertFileSrc(file.path),{signal});if(!response.ok)throw Error('Could not read the selected mesh.');return{path:file.path,name:nameForPath(file.path),buffer:await response.arrayBuffer()};};
    try{return openEditor({name,definition,
      consumers:params?latticeReferences(doc).filter(r=>r.value===params.la_name).map(r=>'Step '+r.step):[],
      validateName:value=>latticeNameError(value,params),validateContext,
      onLoadMesh:invoke?loadCellMesh:undefined,
      onImportMesh:invoke?async()=>{const path=await invoke('choose_cell_mesh');return path?{path}:null;}:undefined,
      onSaveAsset:invoke?async payload=>{validateContext();return invoke('save_cell_mesh',{...payload,workflowPath:currentPath||null});}:undefined,
      onImport:async()=>{if(!invoke)throw Error('File import is available in the desktop app. Paste a definition into the JSON field here.');const file=await invoke('open_lattice_definition',{path:null,workflowPath:currentPath||null,group:'cell'});return file?.contents;},
      onApply:draft=>{
        if(doc!==originalDoc||params&&(!latticeDefinitions().some(d=>d.params===params)||stringifyNumericJson(params)!==original))throw Error('The project definition changed while this draft was open. Reopen the cell before applying.');
        const error=latticeNameError(draft.name,params)||definitionError(draft.definition);if(error)throw Error(error);
        if(!params){insertLatticeStep({Define_Lattice:{la_name:draft.name,definition:draft.definition}},latticeInsertIndex());}
        else{
          const previous=params.la_name,changed=previous!==draft.name||stringifyNumericJson(params.definition)!==stringifyNumericJson(draft.definition);
          for(const ref of latticeReferences(doc))if(ref.value===previous)ref.object[ref.key]=draft.name;
          params.la_name=draft.name;params.definition=draft.definition;
          if(changed)markDirty();
          refreshAll();
        }
        toast('Cell definition applied. Generate and reload affected results to update them.');
      }});
    }catch(error){toast(error.message||String(error));}
  }
  function newLatticeDialog(mesh){
    const options=Object.entries(definitionTypes).filter(([type])=>isMeshType(type)===mesh);
    showModal(`<div class="modal-head"><div><h2>${mesh?'Define mesh / conformal lattice':'Define custom unit cell'}</h2><p>The definition is stored in your workflow.</p></div><button class="icon-button" data-close>×</button></div><div class="modal-body"><div class="field"><label for="new-lattice-type">Definition type</label><select id="new-lattice-type">${options.map(([t,label])=>`<option value="${t}">${label}</option>`).join('')}</select></div><div class="field"><label for="new-lattice-name">Lattice name</label><input id="new-lattice-name" type="text" value="${uniqueLatticeName(mesh?'MeshLattice':'CustomCell')}"></div><p id="new-lattice-error" class="lattice-error" role="status"></p></div><div class="modal-foot"><button class="button" data-close>Cancel</button><button class="button primary" id="create-lattice">Create definition</button></div>`);
    $('create-lattice').onclick=()=>{const name=$('new-lattice-name').value.trim(),error=latticeNameError(name);if(error){$('new-lattice-error').textContent=error;return;}const type=$('new-lattice-type').value;closeModal();if(type==='strut'||type==='TPMS'||MESH_CELL_TYPES.includes(type)){editCellDefinition(null,{name,definition:type==='strut'?blankStrutDefinition():type==='TPMS'?newTpmsDefinition():blankMeshDefinition(type)});return;}const definition=definitionTemplate(type);insertLatticeStep({Define_Lattice:{la_name:name,definition}},latticeInsertIndex());};
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
      if(supportsCellDesigner(definition.type,definition.definition.ladomain))editCellDefinition(selectedStep().Define_Lattice);
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

  const latticeDefinitionEditor=createLatticeDefinitionEditor({
    getContext:params=>{const key=stepKeys().find(k=>doc.WorkFlow[k]?.Define_Lattice===params);return key?{doc,key}:null;},
    validateName:latticeNameError,
    renderLatticePicker:(params,value)=>latticePicker('lattice-la_name',value,'data-lattice-field="la_name" data-kind="text"','data-lattice-browse="la_name"',true,params.la_name),
    onApply:(params,draft)=>{
      const previous=params.la_name;
      for(const ref of latticeReferences(doc))if(ref.value===previous)ref.object[ref.key]=draft.name;
      params.la_name=draft.name;params.definition=draft.definition;markDirty();
      if(selectedStep()?.Define_Lattice===params)$('properties-title').textContent=draft.name;
      if(latticeReferences(doc).some(ref=>ref.value===draft.name))toast('Cell definition changed · generate and reload affected results.');
    },
    onEdit:(params,draft)=>editCellDefinition(params,draft),
    onUse:params=>{
      const template=parseNumericJson('{"la_name":"","size":[4.0,4.0,4.0],"thk":0.3,"Rot":[0.0,0.0,0.0],"Trans":[0.0,0.0,0.0],"Inv":false,"Fill":true,"Cube_Request":{}}');
      template.la_name=params.la_name;template.Fill=!isMeshType(params.definition.type);
      const index=stepKeys().findIndex(k=>doc.WorkFlow[k].Define_Lattice===params);insertLatticeStep({Add_Lattice:template},index+1);
    },
    onExport:async params=>{
      if(!invoke){toast('Definition export is available in the desktop app.');return;}
      const path=await invoke('export_lattice_definition',{contents:stringifyNumericJson(params.definition)+'\n',name:params.la_name,mesh:isMeshType(params.definition.type)});
      if(path)toast('Definition exported. The project keeps its inline definition.');
    },
    onRemove:()=>removeStep(),
    onNavigate:key=>{selected=key;refreshAll();},
    onReveal:params=>{const key=stepKeys().find(k=>doc.WorkFlow[k]?.Define_Lattice===params);if(key){selected=key;refreshAll();}},
    onBrowse:async kind=>{if(!invoke){toast('File browsing is available in the desktop app.');return null;}return invoke('choose_lattice_input',{kind});},
    notify:toast
  });
  applyLatticeDraft=()=>latticeDefinitionEditor.applyAll()&&mesherEditor.applyAll()&&primitiveMeshEditor.applyAll()&&geometryFieldEditor.applyAll()&&fieldMergeEditor.applyAll()&&contourEditor.applyAll()&&slotEditor.applyAll();
  function renderLatticeProperties(params){
    if(!definitionTypes[params.definition?.type])return false;
    $('properties-title').translate=!params.la_name;$('properties-title').textContent=params.la_name||'Lattice definition';
    $('properties-subtitle').textContent=workflowPanelSubtitle(doc.WorkFlow,selected);
    latticeDefinitionEditor.show($('properties-content'),params);return true;
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
    pointCloudInspector.setActive(selected?.startsWith('points:')?selected.slice(7):null);
    const item=(file,support=false)=>{
      const key=file.id==='source'?'geometry':'file:'+file.id,layer=viewer?.layers.get(file.id),loaded=layer?.path===file.path;
      return `<button class="tree-item project-file ${selected===key?'active':''}" data-file="${esc(file.id)}" title="${esc(file.path)}"><span class="tree-icon">${support?'▤':'◇'}</span><span class="project-file-text"><strong ${file.path?'translate="no"':''}>${esc(file.path?nameForPath(file.path):'Source geometry')}</strong><small>${support?'Supporting file':file.id==='source'?'Workflow source':file.id==='result'?'Generated result':'Reference geometry'}${fileIssues.has(file.id)?' · Load failed':loaded?' · '+(layer.mesh.visible?'Shown':'Hidden'):''}</small></span></button>`;
    };
    $('project-tree').innerHTML=`<div class="tree-group"><div class="tree-label">Project</div><button class="tree-item ${selected==='setup'?'active':''}" data-select="setup"><span class="tree-icon">◈</span>Project settings</button></div>
      <div class="tree-group"><div class="project-group-heading"><span class="tree-label">Geometry</span><button class="text-button" id="add-project-geometry" aria-label="Add reference geometry">＋ Add</button></div>${item({id:'source',path:doc.Setup.Geomfile||''})}${projectFiles().map(f=>item(f)).join('')}</div>
${pointCloudInspector.treeHtml()}<div class="tree-group"><div class="project-group-heading"><span class="tree-label">Supporting files</span><button class="text-button" id="add-supporting-file" aria-label="Add supporting file">＋ Add</button></div>${supportingFiles().map(f=>item(f,true)).join('')||'<p class="project-empty">Attach field data, point clouds, or other project files.</p>'}</div>${latticeTree()}${fieldInspector.treeHtml()}`;
    $('project-tree').querySelector('[data-select]').onclick=()=>{selected='setup';refreshAll();};
    $('project-tree').querySelectorAll('[data-file]').forEach(button=>button.onclick=()=>{
      const id=button.dataset.file;selected=id==='source'?'geometry':'file:'+id;refreshTree();refreshProperties();refreshTimeline();
      const file=fileRecord(id);if(!supportingFiles().some(f=>f.id===id)&&file?.path){const layer=viewer?.layers.get(id);if(layer?.path===file.path)viewer.setActiveLayer(id);else loadPreview(file.path,'auto',id);}
    });
    pointCloudInspector.bindTree();fieldInspector.bindTree();$('add-project-geometry').onclick=()=>addProjectFile(false);$('add-supporting-file').onclick=()=>addProjectFile(true);bindLatticeTree();
  }
  async function addProjectFile(support){
    if(!invoke){toast('File browsing is available in the desktop app.');return;}
    try{const path=await invoke(support?'choose_supporting_file':'choose_geometry');if(!path)return;
      if(support&&/\.(csv|tsv)$/i.test(path)){await pointCloudInspector.importSource(path);return;}
      const state=ensureFiles(),list=support?state.supportingFiles:state.geometry;
      let file=list.find(f=>f.path===path);if(!file){file={id:(support?'support-':'geometry-')+crypto.randomUUID(),path};list.push(file);markDirty();}
      selected='file:'+file.id;refreshAll();if(!support)await loadPreview(path,'auto',file.id);
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
    $('properties-title').translate=!file.path;$('properties-title').textContent=file.path?nameForPath(file.path):'Source geometry';$('properties-subtitle').textContent=source?'Workflow source geometry':support?'Supporting file':'Project geometry';
    const opacityControl=`<div class="field"><label for="file-opacity">Opacity</label><div class="geometry-colour-row"><input id="file-opacity" type="range" min="0" max="100" step="1" value="${Math.round(geometryOpacity(doc,file.id,viewer?.layerOpacity(file.id)??1)*100)}"><output id="file-opacity-value" for="file-opacity" translate="no">${Math.round(geometryOpacity(doc,file.id,viewer?.layerOpacity(file.id)??1)*100)}%</output></div></div>`;
    host.innerHTML=(fileIssues.has(file.id)?section('Preview unavailable',`<p class="project-path" role="status">${esc(fileIssues.get(file.id))}</p>`):'')+section('File',`<p class="project-path">${esc(file.path||'No source geometry selected.')}</p><p class="field-help">${source?(doc.Setup.Type==='Sample'?'The project uses a sample domain. Loading a source file switches it to Geometry mode.':'This file defines the workflow source. Domain, resolution and compute options are in Project settings.'):support?'Attached for reference. Set the relevant workflow parameter to use this file.':'Previewing a reference does not change the workflow source.'}</p>`)+
      (loaded?section('Mesh',`<p>${esc(fileStats(layer))}</p>${layer.metadata?`<p class="project-path">${esc(Object.entries(layer.metadata.types).map(([type,count])=>type+': '+count.toLocaleString()).join(' · '))}</p><p class="field-help">${layer.metadata.beamCount?'Beams display as centre lines. ':''}Solid elements display their outer surface. Sections clip the display without creating cut faces.</p>`:''}<label class="project-visible"><input id="file-visible" type="checkbox" ${layer.mesh.visible?'checked':''}> Visible in workspace</label>`):'')+
      (!support?section('Display',`<div class="field"><label for="file-colour">Display colour</label><div class="geometry-colour-row"><input id="file-colour" type="color" value="${esc(geometryColour(doc,file.id,viewer?.layerColor(file.id)||'#ededed'))}"><output id="file-colour-value" for="file-colour" translate="no">${esc(geometryColour(doc,file.id,viewer?.layerColor(file.id)||'#ededed'))}</output></div><p class="field-help">Saved with this project.</p></div>${opacityControl}`)+geometryBounds(loaded?layer:null):/\.(stl|obj|ply|inp)$/i.test(file.path)?section('Display',opacityControl)+geometryBounds(loaded?layer:null):'')+
      section('Actions',`${/\.(stl|obj|ply|inp)$/i.test(file.path)?'<button class="button" id="preview-project-file">Preview mesh</button> ':''}${source?`<button class="button" id="choose-source-geometry">${file.path?'Replace source geometry':'Load source geometry'}</button>`:'<button class="button" id="remove-project-file">Remove from project</button><p class="field-help">The file on disk is kept.</p>'}`);
    if($('file-colour'))$('file-colour').oninput=e=>{if(viewer)viewer.setLayerColor(file.id,e.target.value);else{if(saveGeometryColour(doc,file.id,e.target.value))markDirty();$('file-colour-value').textContent=e.target.value;}};
    if($('file-opacity'))$('file-opacity').oninput=e=>{const opacity=Number(e.target.value)/100;if(viewer)viewer.setOpacity(file.id,opacity);else{if(saveGeometryOpacity(doc,file.id,opacity))markDirty();$('file-opacity-value').textContent=Math.round(opacity*100)+'%';}};
    if($('preview-project-file'))$('preview-project-file').onclick=()=>loadPreview(file.path,'auto',file.id);
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
    const help=fieldParameterInfo(path).help;
    return fieldControl(key,value,path,onchange,depth)+(help?`<p class="field-help">${esc(help)}</p>`:'');
  }
  function fieldControl(key,value,path,onchange,depth=0){
    const id='f_'+Math.random().toString(36).slice(2);const info=fieldParameterInfo(path),label=esc(info.label||titleFor(key));
    if(path===`${scalarFieldKeyword}.regions`&&Array.isArray(value)&&value.every(region=>region&&typeof region==='object'&&!Array.isArray(region))){
      return `<div class="field"><label>${label}</label>${value.map((region,index)=>`<div class="nested-group"><div class="nested-title"><span>Region</span> <span translate="no">${index+1}</span></div>${Object.entries(region).map(([k,v])=>field(k,v,`${path}.${index}.${k}`,onchange,depth+1)).join('')}<button class="button subtle" type="button" data-remove-region="${index}">Remove region</button></div>`).join('')}<button class="button subtle" type="button" id="add-scalar-region">Add region</button></div>`;
    }
    if(info.choices){
      const choices=info.choices.includes(value)?info.choices:[value,...info.choices];
      return `<div class="field"><label for="${id}">${label}</label><select id="${id}" data-value="${esc(path)}">${choices.map(choice=>`<option value="${esc(choice)}" ${choice===value?'selected':''}>${esc(choice)}</option>`).join('')}</select></div>`;
    }
    if(info.nullable&&(value===null||typeof value==='number'))return `<div class="field"><label for="${id}">${label}</label><input id="${id}" type="number" step="any" value="${value===null?'':esc(value)}" placeholder="Automatic" data-nullable-number="${esc(path)}"></div>`;
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
    if(path==='ExportMeshID.MeshID'){
      const ids=contourMeshIds(doc.WorkFlow,selected);
      if(ids.length)return `<div class="field"><label for="${id}">Mesh ID</label><input id="${id}" type="text" list="${id}-contours" translate="no" value="${esc(value??'')}" data-value="${path}"><datalist id="${id}-contours">${ids.map(mesh=>`<option value="${esc(mesh)}"></option>`).join('')}</datalist></div>`;
    }
    const pathLike=/file|path|outfile|geom|mesh|output|dir/i.test(key);
    if(typeof value==='number')return `<div class="field"><label for="${id}">${label}</label><input id="${id}" type="number" ${numberInputForPath(path)} data-value="${esc(path)}"></div>`;
    if(pathLike)return `<div class="field"><label for="${id}">${label}</label><div class="path-row"><input id="${id}" type="text" value="${esc(value??'')}" data-value="${esc(path)}"><button class="icon-button" title="Browse" data-browse="${esc(path)}">…</button></div></div>`;
    const long=String(value??'').length>46;
    return `<div class="field"><label for="${id}">${label}</label>${long?`<textarea id="${id}" data-value="${esc(path)}">${esc(value??'')}</textarea>`:`<input id="${id}" type="text" value="${esc(value??'')}" data-value="${esc(path)}">`}</div>`;
  }
  function readAt(root,path){return path.split('.').reduce((o,k)=>o?.[k],root);}
  function writeAt(root,path,value){const parts=path.split('.');let o=root;for(const p of parts.slice(0,-1))o=o[p];o[parts.at(-1)]=value;}
  function updateField(path,value){const parts=path.split('.');let root,rest;if(parts[0]==='Setup'){root=doc.Setup;rest=parts.slice(1).join('.');}else if(parts[0]==='PostProcess'){root=doc.PostProcess;rest=parts.slice(1).join('.');}else{root=selectedStep()?.[parts[0]];rest=parts.slice(1).join('.');}if(root){
      writeAt(root,rest,value);
      if(path==='ExportMeshID.MeshID'&&contourMeshIds(doc.WorkFlow,selected).includes(value))root.elem_type='Line';
    }markDirty();refreshProperties();}
  function propertyRoot(path){const parts=path.split('.');if(parts[0]==='Setup')return [doc.Setup,parts.slice(1).join('.')];if(parts[0]==='PostProcess')return [doc.PostProcess,parts.slice(1).join('.')];return [selectedStep()?.[parts[0]],parts.slice(1).join('.')];}
  function numberParent(path){const [root,rest]=propertyRoot(path),parts=rest.split('.'),key=parts.pop();return {parent:parts.length?readAt(root,parts.join('.')):root,key};}
  function numberInput(parent,key){const type=numberType(parent,key);return `step="${type==='integer'?'1':'any'}" data-number-type="${type}" value="${esc(numberText(parent,key))}"`;}
  function numberInputForPath(path){const {parent,key}=numberParent(path);return numberInput(parent,key);}
  function exportParameterError(params){return exportDrafts.get(params)?.error||exportError(params);}
  function renderExportProperties(params){
    const mode=exportMode(params),hasFields=mode!=='mesh',draft=exportDrafts.get(params);
    const pathInput=(key,label,help)=>`<div class="field"><label for="export-${key}">${label}</label><div class="path-row"><input id="export-${key}" type="text" data-export-value="${key}" value="${esc(params[key]??'')}" aria-describedby="export-error"><button class="icon-button" data-export-browse="${key}" aria-label="Choose ${label}">…</button></div><p class="field-help">${help}</p></div>`;
    return `<div data-export-editor><div class="field"><label for="export-mode">Output mode</label><select id="export-mode"><option value="mesh" ${mode==='mesh'?'selected':''}>Mesh only</option><option value="field" ${mode==='field'?'selected':''}>HDF5 field only</option><option value="both" ${mode==='both'?'selected':''}>Mesh plus HDF5 field</option></select><p class="field-help">Selecting Mesh only removes fieldfile and GridFieldIDs.</p></div>`+
      pathInput('outfile',mode==='field'?'Field output (outfile)':'Mesh output (outfile)',mode==='field'?'Use .h5 or .hdf5 to save sampled grid values and coordinates.':'Use a supported mesh extension, for example .stl, .obj or .ply.')+
      (mode==='both'?pathInput('fieldfile','Additional field output (fieldfile)','Use .h5 or .hdf5. Artisan writes this field file alongside the mesh.'):'')+
      (hasFields||Object.hasOwn(params,'GridFieldIDs')?`<div class="field"><label for="export-gridfields">Grid field IDs (GridFieldIDs, optional)</label><textarea id="export-gridfields" aria-describedby="export-gridfields-help export-error">${esc(draft?.text??JSON.stringify(params.GridFieldIDs??[],null,2))}</textarea><p class="field-help" id="export-gridfields-help">Enter a JSON array, for example ["SizeField"]. Use field IDs created before this step. The current lattice field is included automatically when present; [] adds no named fields.</p></div>`:'')+
      `<p id="export-error" class="lattice-error" role="status">${esc(exportParameterError(params))}</p>${hasFields?'<button class="button subtle" id="view-export-field">View exported field…</button>':''}</div>`+
      Object.entries(params).filter(([key])=>!['outfile','fieldfile','GridFieldIDs'].includes(key)).map(([key,value])=>field(key,value,`Export.${key}`,updateField)).join('');
  }
  function attachExportEvents(){
    const params=selectedStep()?.Export;if(!params||!$('export-mode'))return;
    const paint=()=>{const error=exportParameterError(params);$('export-error').textContent=error;const ids=$('export-gridfields');if(ids)ids.setAttribute('aria-invalid',exportDrafts.has(params)?'true':'false');};
    $('export-mode').onchange=event=>{const mode=event.target.value;setExportMode(params,mode);if(mode==='mesh')exportDrafts.delete(params);markDirty();refreshProperties();};
    $('properties-content').querySelectorAll('[data-export-value]').forEach(input=>input.onchange=()=>{params[input.dataset.exportValue]=input.value;markDirty();refreshProperties();});
    const ids=$('export-gridfields');if(ids)ids.oninput=()=>{
      try{const names=parseGridFieldIds(ids.value);if(names.length)params.GridFieldIDs=names;else delete params.GridFieldIDs;exportDrafts.delete(params);}
      catch(error){exportDrafts.set(params,{text:ids.value,error:error.message});}
      markDirty();paint();
    };
    $('properties-content').querySelectorAll('[data-export-browse]').forEach(button=>button.onclick=async()=>{
      if(!invoke){toast('File browsing is available in the installed desktop app.');return;}
      const key=button.dataset.exportBrowse,originalDoc=doc;
      try{const path=await invoke('choose_output',{kind:key==='fieldfile'||exportMode(params)==='field'?'field':'mesh',path:typeof params[key]==='string'?params[key]:null});if(path&&doc===originalDoc&&selectedStep()?.Export===params){params[key]=path;markDirty();refreshProperties();}}
      catch(error){toast(`Could not choose output: ${error.message||error}`);}
    });
    if($('view-export-field'))$('view-export-field').onclick=async()=>{
      if(!invoke){toast('Field reading is available in the desktop app.');return;}
      if(runProgress.busy){toast('Wait for Artisan to finish exporting.');return;}
      const error=exportParameterError(params);if(error){toast(error);return;}
      try{const output=exportMode(params)==='both'?params.fieldfile:params.outfile;const path=await invoke('resolve_field_output',{path:output,workflowPath:currentPath||null,backendPath:backendPath||null,jsonWorkDir:doc.Setup.JsonWorkDir??null});await fieldInspector.load(path);}catch(error){toast(`Could not open exported field: ${error.message||error}`);}
    };
    paint();
  }

  function attachPropertyEvents(){
    bindLatticePickers();
    attachExportEvents();
    if($('add-scalar-region'))$('add-scalar-region').onclick=()=>{selectedStep()[scalarFieldKeyword].regions.push(newScalarRegion());markDirty();refreshProperties();};
    $('properties-content').querySelectorAll('[data-remove-region]').forEach(button=>button.onclick=()=>{selectedStep()[scalarFieldKeyword].regions.splice(Number(button.dataset.removeRegion),1);markDirty();refreshProperties();});
    $('properties-content').querySelectorAll('[data-nullable-number]').forEach(input=>input.onchange=()=>{const path=input.dataset.nullableNumber,{parent,key}=numberParent(path);try{if(!input.value.trim())updateField(path,null);else{setNumber(parent,key,input.value,'float');markDirty();}}catch(error){toast(error.message);refreshProperties();}});
    $('properties-content').querySelectorAll('[data-lattice-ref-browse]').forEach(el=>el.onclick=async()=>{if(!invoke)return;try{const path=await invoke('choose_lattice_input',{kind:'la_name'});if(path)updateField(el.dataset.latticeRefBrowse,path);}catch(e){toast(String(e));}});

    $('properties-content').querySelectorAll('[data-value]').forEach(el=>el.addEventListener('change',()=>{
      if(el.type==='number'){const {parent,key}=numberParent(el.dataset.value);try{setNumber(parent,key,el.value,el.dataset.numberType);markDirty();}catch(e){toast(e.message);}el.value=numberText(parent,key);}
      else updateField(el.dataset.value,el.type==='checkbox'?el.checked:el.value);
    }));
    $('properties-content').querySelectorAll('[data-vector]').forEach(el=>el.addEventListener('change',()=>{const [root,p]=propertyRoot(el.dataset.vector),a=readAt(root,p);try{setNumber(a,el.dataset.index,el.value,el.dataset.numberType);markDirty();}catch(e){toast(e.message);}el.value=numberText(a,el.dataset.index);}));
    $('properties-content').querySelectorAll('[data-json-value]').forEach(el=>el.addEventListener('change',()=>{try{updateField(el.dataset.jsonValue,parseNumericJson(el.value));}catch(e){toast(`Invalid JSON value: ${e.message}`);}}));
    $('properties-content').querySelectorAll('[data-domain]').forEach(el=>el.addEventListener('change',()=>{const axis=Number(el.dataset.domain),side=Number(el.dataset.side);doc.Setup.Sample ||= clone(defaultSetup.Sample);doc.Setup.Sample.Domain ||= clone(defaultSetup.Sample.Domain);const bounds=doc.Setup.Sample.Domain[axis];try{setNumber(bounds,side,el.value,el.dataset.numberType);markDirty();}catch(e){toast(e.message);}el.value=numberText(bounds,side);refreshProperties();}));
    $('properties-content').querySelectorAll('[data-preset]').forEach(el=>el.addEventListener('change',()=>{const index=Number(el.value);if(index<0)return;const op=window.ARTISAN_OPERATIONS.find(o=>o.keyword===el.dataset.preset),params=parseNumericJson(op.presets[index].paramsJson);prepareFieldOperation(op.keyword,params);selectedStep()[op.keyword]=params;presetSelections.set(params,index);markDirty();refreshProperties();}));
    $('properties-content').querySelectorAll('[data-browse]').forEach(el=>el.onclick=async()=>{if(!invoke){toast('File browsing is available in the installed desktop app.');return;}const output=fieldParameterInfo(el.dataset.browse).output||/outfile|output/i.test(el.dataset.browse);const args=el.dataset.browse==='ExportMeshID.out_meshfile'&&selectedStep()?.ExportMeshID?.elem_type==='Line'
      ?{kind:'line_mesh',path:selectedStep().ExportMeshID.out_meshfile}
      :output&&el.dataset.browse==='Gen_TetMesh_SizeField.export_mesh'?{kind:'mesh',path:'TetDomains.inp'}:undefined;
      const path=await invoke(output||args?'choose_output':'choose_geometry',args);if(path){updateField(el.dataset.browse,path);if(el.dataset.browse==='Setup.Geomfile')loadPreview(path);}});
  }
  function refreshProperties(){
    workspace.classList.toggle('lattice-definition-mode',!!definitionTypes[selectedStep()?.Define_Lattice?.definition?.type]);
    $('properties-content').classList.remove('ld-host');
    let returnButton=$('quad-return');if(!returnButton){returnButton=document.createElement('button');returnButton.id='quad-return';returnButton.className='button subtle quad-return';returnButton.textContent='Return to meshing';document.querySelector('.properties-panel').insertBefore(returnButton,$('properties-content'));}
    const returnKey=mesherReturn&&mesherContext(mesherReturn)?.key;returnButton.hidden=!returnKey||selected===returnKey;returnButton.onclick=()=>{if(returnKey){selected=returnKey;mesherReturn=null;refreshAll();}};
    const singleOperation=Object.keys(selectedStep()||{}).length===1;
    const slotParams=singleOperation&&selectedStep()?.[slotKeyword];
    if(!slotParams)slotEditor.hide();
    workspace.classList.toggle('slot-mode',!!slotParams);
    const contourParams=singleOperation&&selectedStep()?.[contourKeyword];
    if(!contourParams)contourEditor.hide();
    workspace.classList.toggle('contour-mode',!!contourParams);
    const fieldMergeParams=selectedStep()?.[fieldMergeKeyword];
    if(!fieldMergeParams)fieldMergeEditor.hide();
    workspace.classList.toggle('field-merge-mode',!!fieldMergeParams);
    const geometryFieldEntry=Object.entries(selectedStep()||{}).find(([keyword])=>geometryFieldKeywords.includes(keyword));
    if(!geometryFieldEntry)geometryFieldEditor.hide();
    workspace.classList.toggle('geometry-field-mode',!!geometryFieldEntry);
    const primitiveEntry=Object.entries(selectedStep()||{}).find(([keyword])=>primitiveMeshKeywords.includes(keyword));
    if(!primitiveEntry)primitiveMeshEditor.hide();
    workspace.classList.toggle('primitive-mesh-mode',!!primitiveEntry);
    const mesherEntry=Object.entries(selectedStep()||{}).find(([keyword])=>mesherKeywords.includes(keyword));
    const mesherParams=mesherEntry?.[1];if(!mesherParams)mesherEditor.hide();
    workspace.classList.toggle('size-mesher-mode',!!mesherParams);
    if(selected!=='setup')setupEditor.showGuides(doc.Setup,doc.PostProcess);
    workspace.classList.toggle('setup-editor-mode',selected==='setup');
    // Reset filename/lattice-name protection before the region and morph fast paths.
    $('properties-title').translate=true;$('properties-subtitle').translate=!selectedStep();
    const scalarParams=selectedStep()?.[scalarFieldKeyword];
    const morphParams=selectedStep()?.[morphKeyword];
    const spatialEntry=Object.entries(selectedStep()||{}).find(([k])=>spatialKeywords.includes(k));
    if(!spatialEntry)spatialEditor.hide();
    workspace.classList.toggle('scalar-region-mode',!!scalarParams||!!morphParams||!!spatialEntry);
    workspace.classList.toggle('geometry-operation-mode',!!spatialEntry&&geometryKeywords.includes(spatialEntry[0]));
    workspace.classList.toggle('transition-operation-mode',!!spatialEntry&&(transitionKeywords.includes(spatialEntry[0])||spatialEntry[0]==='Add_Lattice'));
    if(!morphParams)morphEditor.hide();
    if(!scalarParams)regionEditor.hide();
    else{
      workspace.classList.remove('point-cloud-mode');

      $('properties-title').textContent='Scalar field from regions';
      $('properties-subtitle').textContent=workflowPanelSubtitle(doc.WorkFlow,selected);
      const footer=document.querySelector('.properties-footer');if(footer?.lastChild)footer.lastChild.textContent=' Shapes define regions; the body is unchanged';
      regionEditor.show($('properties-content'),scalarParams);
      return;
    }
    if(morphParams){
      workspace.classList.remove('point-cloud-mode');
      $('properties-title').textContent='Morph implicit field';$('properties-subtitle').textContent=workflowPanelSubtitle(doc.WorkFlow,selected);
      const footer=document.querySelector('.properties-footer');if(footer?.lastChild)footer.lastChild.textContent=' Guides show requested movement; compute the deformation to check it';
      morphEditor.show($('properties-content'),morphParams);return;
    }
    workspace.classList.toggle('point-cloud-mode',!!selected?.startsWith('points:'));
    if(selected?.startsWith('points:')){pointCloudInspector.renderProperties(selected.slice(7));return;}

    const host=$('properties-content');
    const footer=document.querySelector('.properties-footer');if(footer?.lastChild)footer.lastChild.textContent=selected?.startsWith('field:')?' Field display settings; exported values stay unchanged':' Changes update the workflow JSON';
    if(selected?.startsWith('field:')){fieldInspector.renderProperties(selected.slice(6));return;}

    if(slotParams){$('properties-title').textContent=titleFor(slotKeyword);$('properties-subtitle').textContent=workflowPanelSubtitle(doc.WorkFlow,selected);slotEditor.show(host,slotParams);return;}
    if(contourParams){$('properties-title').textContent=titleFor(contourKeyword);$('properties-subtitle').textContent=workflowPanelSubtitle(doc.WorkFlow,selected);contourEditor.show(host,contourParams);return;}
    if(fieldMergeParams){$('properties-title').textContent=titleFor(fieldMergeKeyword);$('properties-subtitle').textContent=workflowPanelSubtitle(doc.WorkFlow,selected);fieldMergeEditor.show(host,fieldMergeParams);return;}
    if(geometryFieldEntry){$('properties-title').textContent=geometryFieldTitles[geometryFieldEntry[0]];$('properties-subtitle').textContent=workflowPanelSubtitle(doc.WorkFlow,selected);geometryFieldEditor.show(host,...geometryFieldEntry);return;}
    if(primitiveEntry){
      $('properties-title').textContent=primitiveMeshInfo[primitiveEntry[0]].name;$('properties-subtitle').textContent=workflowPanelSubtitle(doc.WorkFlow,selected);
      primitiveMeshEditor.show(host,...primitiveEntry);return;
    }
    if(mesherParams){
      $('properties-title').textContent=mesherTitle(mesherEntry[0]);$('properties-subtitle').textContent=workflowPanelSubtitle(doc.WorkFlow,selected);
      mesherEditor.show(host,mesherParams);attachPropertyEvents();return;
    }

    if(selectedStep()?.Define_Lattice&&renderLatticeProperties(selectedStep().Define_Lattice))return;
    if(selected?.startsWith('file:')){const file=fileRecord(selected.slice(5));if(file){showFileProperties(file,supportingFiles().some(f=>f.id===file.id));return;}}
    if(selected==='geometry'){showFileProperties(fileRecord('source'));return;}
    if(selected==='setup'){
      $('properties-title').textContent='Project settings';$('properties-subtitle').textContent='Domain, sampling and generation';
      setupEditor.show(host,doc.Setup,doc.PostProcess);return;
    }else if(selectedStep()){
      const step=selectedStep(), commands=Object.entries(step);$('properties-title').textContent=titleFor(commands[0]?.[0]||'Operation');$('properties-subtitle').textContent=workflowPanelSubtitle(doc.WorkFlow,selected);
      host.innerHTML=commands.map(([keyword,params])=>keyword==='Proc_BoxSlices'?'':keyword==='Add_Lattice'&&spatialEntry?.[0]===keyword?latticeOtherProperties(params):transitionKeywords.includes(keyword)&&spatialEntry?.[0]===keyword?transitionOtherProperties(keyword,params):geometryKeywords.includes(keyword)&&spatialEntry?.[0]===keyword?geometryOtherProperties(keyword,params):section(titleFor(keyword),parameterPresetControl(keyword,params)+(fieldOperationHelp(keyword)?`<p class="field-help">${esc(fieldOperationHelp(keyword))}</p>`:'')+(keyword==='Proc_BoxSlices'?'':keyword==='Export'?renderExportProperties(params):Object.entries(params).map(([k,v])=>field(k,v,`${keyword}.${k}`,updateField)).join('')))).join('');
    }else{$('properties-title').textContent='Properties';$('properties-subtitle').textContent='Select a project or workflow step';host.innerHTML='<div class="empty-properties">Select project settings or a workflow step to view and edit its parameters.</div>';}
    attachPropertyEvents();
    if(spatialEntry)spatialEditor.show(host,...spatialEntry);
  }
  function latticeOtherProperties(params){
    const extra=Object.entries(params).filter(([k])=>!latticeKnown.includes(k)).map(([k,v])=>field(k,v,`Add_Lattice.${k}`,updateField)).join('');
    const presets=parameterPresetControl('Add_Lattice',params);return extra||presets?`<details class="transition-other"><summary>Additional parameters</summary>${presets}${extra}</details>`:'';
  }
  function transitionOtherProperties(keyword,params){
    const extra=Object.entries(params).filter(([k])=>!transitionKnown.includes(k)).map(([k,v])=>field(k,v,`${keyword}.${k}`,updateField)).join('');
    const presets=parameterPresetControl(keyword,params);
    return extra||presets?`<details class="transition-other"><summary>Additional parameters</summary>${presets}${extra}</details>`:'';
  }
  function geometryOtherProperties(keyword,params){
    const known={Box:['ori','normal','length','z_angle'],Sphere:['ori','r'],Cylinder:['pa','pb','r']}[params.Name]||['Scale','Trans','Rot'];
    const invalid=geometryOperationError(params),extras=Object.entries(params).filter(([k])=>!['Name','Paras','k_factor','push2GeomField'].includes(k));
    let html=parameterPresetControl(keyword,params);
    if(params.Paras&&typeof params.Paras==='object')html+=Object.entries(params.Paras).filter(([k])=>invalid||!known.includes(k)).map(([k,v])=>field(k,v,`${keyword}.Paras.${k}`,updateField)).join('');
    html+=extras.map(([k,v])=>field(k,v,`${keyword}.${k}`,updateField)).join('');
    return html?section('Operation settings',html):'';
  }
  function reindex(){const entries=stepKeys().map(k=>doc.WorkFlow[k]);doc.WorkFlow=Object.fromEntries(entries.map((s,i)=>[String(i+1),s]));if(selected&&!doc.WorkFlow[selected])selected=null;}
  function addOperation(keyword,index){
    const op=(window.ARTISAN_OPERATIONS||[]).find(o=>o.keyword===keyword);if(!op)return;
    const entries=stepKeys().map(k=>doc.WorkFlow[k]),params=parseNumericJson(op.paramsJson);
    prepareFieldOperation(keyword,params);if(geometryKeywords.includes(keyword)){for(const k of Object.keys(params))delete params[k];replaceSpatialShape(params,'Box',doc.Setup.Sample?.Domain);setNumber(params,'k_factor',0,'float');params.push2GeomField=false;}if(keyword===morphKeyword){for(const k of Object.keys(params))delete params[k];assignNumericJson(params,newMorph());}if(keyword===scalarFieldKeyword){params.field_id='SelectionMask';params.default_value=0.0;params.overlap='Maximum';params.regions=[newPrimitiveRegion('Box',doc.Setup.Sample?.Domain)];}presetSelections.set(params,0);index=Math.max(0,Math.min(entries.length,index));entries.splice(index,0,{[keyword]:params});
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
  function showSlotGrid(plates,selection,onSelect){
    const pagination=side=>'<div><strong>'+side.toUpperCase()+'</strong><button type="button" class="button" data-slot-prev-'+side+
      ' aria-label="Previous page '+side.toUpperCase()+'">Previous</button><span data-slot-page-'+side+
      ' translate="no"></span><button type="button" class="button" data-slot-next-'+side+' aria-label="Next page '+side.toUpperCase()+'">Next</button></div>';
    showModal('<div class="modal-head"><div><h2 id="slot-grid-title">Choose plate pair</h2><p>Select a pair on perpendicular slice planes.</p></div>'+
      '<button class="icon-button" data-close aria-label="Close">×</button></div><div class="modal-body slot-grid-modal">'+
      '<div class="slot-grid-filters"><label>Filter Plate A<input type="search" data-slot-filter-a></label>'+
      '<label>Filter Plate B<input type="search" data-slot-filter-b></label></div>'+
      '<div class="slot-grid-pagination">'+pagination('a')+pagination('b')+'</div>'+
      '<div class="slot-grid-scroll" data-slot-grid-table></div></div>');
    const trigger=document.activeElement,modal=$('modal');
    modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-labelledby','slot-grid-title');
    const trap=event=>{
      if(event.key!=='Tab')return;
      const controls=[...modal.querySelectorAll('button:not(:disabled),input')],first=controls[0],last=controls.at(-1);
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    };
    modal.addEventListener('keydown',trap);
    bindSlotGrid(modal,plates,selection,(a,b)=>{closeModal();onSelect(a,b);$('properties-content').querySelector('[data-slot-grid]')?.focus();});
    modalCleanup=()=>{
      modalCleanup=null;modal.removeEventListener('keydown',trap);
      for(const attr of ['role','aria-modal','aria-labelledby'])modal.removeAttribute(attr);
      if(trigger?.isConnected)trigger.focus();
    };
  }
  function showAbout(){
    showModal(`<div class="modal-head"><div><h2 id="about-title">About ArtGUI</h2><p>Artisan Workbench · Version ${esc(ARTGUI_VERSION)}</p></div><button class="icon-button" data-close aria-label="Close About">×</button></div>
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
  function openJson(){if(applyLatticeDraft&&!applyLatticeDraft())return;showModal(`<div class="modal-head"><div><h2>Workflow JSON</h2><p>Artisan's original Setup / WorkFlow / PostProcess structure is preserved.</p></div><button class="icon-button" data-close>×</button></div><div class="modal-body"><textarea id="json-editor" class="json-editor" spellcheck="false">${esc(workflowJson().trimEnd())}</textarea></div><div class="modal-foot"><button class="button" data-close>Cancel</button><button class="button primary" id="apply-json">Apply JSON</button></div>`);$('apply-json').onclick=()=>{try{const next=parseNumericJson($('json-editor').value);const normalized=normalizeWorkflow(next);resetViewer();doc=normalized;applyGeometryColours(viewer,doc);applyGeometryOpacities(viewer,doc);selected=null;markDirty();refreshAll();closeModal();toast('Workflow JSON applied');}catch(e){toast(`Invalid workflow JSON: ${e.message}`);};};}
  function refreshAll(){$('project-name').translate=!currentPath;refreshTree();refreshTimeline();refreshProperties();$('project-name').textContent=currentPath?nameForPath(currentPath).replace(/\.json$/i,''):'Untitled workflow';updateGeometryLabel();}
  function updateGeometryLabel(){const p=doc.Setup.Geomfile||'';$('geometry-label').translate=!p;$('geometry-label').textContent=p?nameForPath(p):'Load a model to preview your design';}
  function guardUnsaved(){return (!dirty&&!latticeDefinitionEditor.hasPending()&&!mesherEditor.hasPending()&&!primitiveMeshEditor.hasPending()&&!geometryFieldEditor.hasPending()&&!fieldMergeEditor.hasPending())||confirm(t('Discard unsaved changes?'));}
  function resetViewer(){slotEditor.reset();contourEditor.hide();fieldMergeEditor.hide();geometryFieldEditor.hide();primitiveMeshEditor.hide();setupEditor.hide();regionEditor.hide();morphEditor.hide();spatialEditor.hide();mesherEditor.hide();mesherReturn=null;morphReturn=null;pointCloudInspector.reset();fieldInspector.reset();fileIssues.clear();cancelPreview();viewer?.clear();loadedGeometryPath='';loadedPreviewMode='';loadedLayerId='source';$('preview-mode').disabled=true;$('mesh-info').textContent='No model loaded';$('viewport-empty').classList.remove('hidden');}
  function newProject(){if(runProgress.busy||!guardUnsaved())return;runProgress.reset();resetViewer();doc={Setup:clone(defaultSetup),WorkFlow:{},PostProcess:clone(defaultPost)};currentPath='';selected='setup';dirty=false;$('dirty-state').textContent='All changes saved';$('project-name').textContent='Untitled workflow';refreshAll();}
  async function openProject(){if(!guardUnsaved())return;if(invoke){try{const f=await invoke('open_workflow');if(!f)return;loadWorkflow(f.contents,f.path);}catch(e){toast(`Could not open workflow: ${e}`);}}else{$('fallback-file').click();}}
  function loadWorkflow(text,path){try{const parsed=parseNumericJson(text);if(!parsed.Setup||!parsed.WorkFlow)throw Error('Expected Setup and WorkFlow sections.');const nextDoc=normalizeWorkflow(parsed);resetViewer();doc=nextDoc;applyGeometryColours(viewer,doc);applyGeometryOpacities(viewer,doc);runProgress.reset();currentPath=path||'';selected='setup';dirty=false;$('dirty-state').textContent='All changes saved';refreshAll();if(doc.Setup.Type==='Geometry'&&doc.Setup.Geomfile)loadPreview(doc.Setup.Geomfile);toast('Workflow opened');}catch(e){toast(`Could not read workflow: ${e.message}`);}}
  async function saveProject(saveAs=false,validationWorkflow=doc.WorkFlow){if(runProgress.busy)return false;if(applyLatticeDraft&&!applyLatticeDraft())return false;const scalarIssue=scalarWorkflowError(validationWorkflow)||morphWorkflowError(validationWorkflow)||transitionWorkflowError(validationWorkflow)||latticePanelWorkflowError(validationWorkflow)||quadWorkflowError(validationWorkflow)||primitiveMeshWorkflowError(validationWorkflow)||geometryFieldWorkflowError(validationWorkflow)||fieldMergeWorkflowError(validationWorkflow)||contourWorkflowError(validationWorkflow)||slotWorkflowError(validationWorkflow);if(scalarIssue){toast(scalarIssue);return false;}const exportIssue=exportWorkflowError(validationWorkflow,exportDrafts);if(exportIssue){toast(exportIssue);return false;}const contents=workflowJson().trimEnd()+'\n';if(invoke){try{const p=await invoke('save_workflow',{path:currentPath||null,contents,saveAs});if(p){currentPath=p;$('project-name').translate=false;dirty=false;$('dirty-state').textContent='All changes saved';$('project-name').textContent=nameForPath(p).replace(/\.json$/i,'');toast('Workflow saved');}return !!p;}catch(e){toast(`Could not save: ${e}`);return false;}}const blob=new Blob([contents],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=nameForPath(currentPath||'Artisan_workflow.json');a.click();URL.revokeObjectURL(a.href);dirty=false;$('dirty-state').textContent='Downloaded JSON';return true;}
  async function cleanScratch(){
    if(cleaningScratch)return;
    if(runProgress.busy||preparingGeneration){toast('Wait for Artisan to finish exporting.');return;}
    if(!invoke){toast('Scratch cleanup is available in the installed desktop app.');return;}
    cleaningScratch=true;$('clean-scratch').disabled=true;
    try{
      cancelPreview();
      // Cached previews stream from ViewScratch. Close them before deleting their files.
      await fieldInspector.closeTemporary();
      for(const [id,layer] of [...(viewer?.layers||[])])if(layer.preview||isScratchPreview(layer.path))viewer.removeLayer(id);
      adaptivePreview?.clear();
      if(!viewer?.layers.has(loadedLayerId)){
        loadedGeometryPath='';loadedPreviewMode='';$('preview-mode').disabled=true;
      }
      const hasGeometry=!!viewer?.layers.size;
      $('viewport-empty').classList.toggle('hidden',hasGeometry||!!viewer?.fieldLayers.size);
      $('mesh-info').textContent=hasGeometry?'Model loaded':'No model loaded';
      viewer?.render();
      toast('Cleaning scratch…');
      await invoke('clean_view_scratch');
      scratchPreviewFolders.forEach((_,folder)=>scratchPreviewFolders.set(folder,false));
      if(selected?.startsWith('field:')&&!fieldInspector.has(selected.slice(6))
        &&!doc.ArtGUI?.fields?.some(field=>field.id===selected.slice(6)))selected='setup';
      refreshAll();
      toast('Scratch cleaned.');
    }catch(e){toast(`${t('Could not clean scratch:')} ${e.message||e}`);}
    finally{cleaningScratch=false;$('clean-scratch').disabled=false;}
  }
  function showSettings(){selected='setup';refreshTree();refreshProperties();}
  function editSetup(){showSettings();}
  function removeStep(){if(!selectedStep())return;const definition=selectedStep().Define_Lattice;if(definition&&latticeReferences(doc).some(r=>r.value===definition.la_name)){toast('This definition is still used. Update or remove its references first.');return;}delete doc.WorkFlow[selected];reindex();markDirty();refreshAll();}
  function moveStep(offset){if(!selectedStep())return;const keys=stepKeys(),i=keys.indexOf(selected),j=Math.max(0,Math.min(keys.length-1,i+offset));if(i===j)return;const values=keys.map(k=>doc.WorkFlow[k]);[values[i],values[j]]=[values[j],values[i]];doc.WorkFlow=Object.fromEntries(values.map((v,n)=>[String(n+1),v]));selected=String(j+1);markDirty();refreshAll();}
  function clearWorkflow(){if(!stepKeys().length||!confirm(t('Remove every operation from this workflow?')))return;doc.WorkFlow={};selected=null;markDirty();refreshAll();}
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
  async function viewField(){await chooseExportedOutput('field');}
  async function loadResult(){await chooseExportedOutput('mesh');}
  async function browseResult(){
    try{const path=await invoke('choose_result');if(path)await openResult(path);}
    catch(error){toast(`Could not load result: ${error.message||error}`);}
  }
  async function openResult(path,mode='auto'){
    if(runProgress.busy||preparingGeneration){toast('Wait for Artisan to finish exporting.');return;}
    if(isFieldFile(path)){await fieldInspector.load(path);return;}
    if(!isScratchPreview(path)){
      const state=ensureFiles(),previous=state.geometry.find(f=>f.id==='result');
      state.geometry=state.geometry.filter(f=>f.id!=='result');
      state.geometry.push({...previous,id:'result',path});markDirty();
    }
    await loadPreview(path,mode,'result');
  }
  async function chooseExportedOutput(kind){
    if(!invoke){toast('Use the desktop app to open exported files.');return;}
    if(runProgress.busy||preparingGeneration){toast('Wait for Artisan to finish exporting.');return;}
    const isField=kind==='field',title=isField?'Exported fields':'Exported results';
    const browse=isField?()=>fieldInspector.browse():browseResult;
    const open=isField?path=>fieldInspector.load(path):openResult;
    const outputs=stepKeys().flatMap(step=>{
      const params=doc.WorkFlow[step].Export;
      if(!params||typeof params!=='object'||Array.isArray(params))return [];
      const mode=exportMode(params),output=isField&&mode==='both'?params.fieldfile:params.outfile;
      if(typeof output!=='string'||!output.trim()||isFieldFile(output)!==isField)return [];
      const supported=isField||/\.(stl|obj|ply|inp)$/i.test(output);
      return [{step,output,supported}];
    });
    if(!outputs.length){await browse();return;}
    showModal(`<div class="modal-head"><div><h2 id="exported-outputs-title">${title}</h2><p>${isField?'HDF5':'Mesh'} outputs from the current JSON workflow</p></div><button class="icon-button" data-close aria-label="Close ${title.toLowerCase()}">×</button></div><div class="modal-body"><div id="exported-output-list" class="exported-field-list">${outputs.map((output,index)=>`<button class="button exported-field-option" data-exported-output="${index}" aria-describedby="exported-output-status-${index}" disabled><strong>Step ${esc(output.step)} · ${esc(nameForPath(output.output))}</strong><span class="exported-field-path">${esc(output.output)}</span><span class="exported-field-state" id="exported-output-status-${index}" role="status">${output.supported?'Checking file…':'Preview unavailable · supported formats: STL, OBJ, PLY and INP.'}</span></button>`).join('')}</div>${isField?'':'<p class="field-help">The viewer supports STL, OBJ, PLY and INP meshes.</p>'}</div><div class="modal-foot"><button class="button" data-close>Cancel</button><button class="button primary" id="browse-exported-output">${isField?'Open another HDF5 file…':'Open another result file…'}</button></div>`);
    const list=$('exported-output-list'),context={workflowPath:currentPath||null,backendPath:backendPath||null,jsonWorkDir:doc.Setup.JsonWorkDir??null};
    const modal=$('modal');modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-labelledby','exported-outputs-title');
    const previousFocus=document.activeElement;
    modalCleanup=()=>{for(const name of ['role','aria-modal','aria-labelledby'])modal.removeAttribute(name);modalCleanup=null;if(previousFocus?.isConnected)previousFocus.focus();};
    $('browse-exported-output').onclick=()=>{closeModal();browse();};
    $('browse-exported-output').focus();
    await Promise.all(outputs.map(async(output,index)=>{
      if(!output.supported)return;
      const button=list.querySelector(`[data-exported-output="${index}"]`),status=button.querySelector('.exported-field-state');
      try{
        const path=await invoke('resolve_export_output',{path:output.output,...context});
        if($('exported-output-list')!==list)return;
        status.textContent='Ready to view';button.disabled=false;
        button.onclick=async()=>{
          closeModal();
          try{await open(path);}catch(error){toast(`Could not open exported ${isField?'field':'result'}: ${error.message||error}`);}
        };
      }catch(error){
        if($('exported-output-list')!==list)return;
        status.textContent='Not available · generate this export or open another file.';
        button.title=String(error.message||error);
      }
    }));
  }
  function setPreviewProgress(visible, loaded=0, total=0, label='Preparing geometry…'){
    const host=$('preview-progress'),bar=$('preview-progress-bar');
    host.classList.toggle('hidden',!visible);
    bar.max=total>0?total:1;bar.value=total>0?Math.min(loaded,total):0;
    $('preview-progress-text').textContent=label;
  }
  function formatBytes(bytes){if(!bytes)return 'unknown size';const units=['B','KB','MB','GB'];let n=bytes,i=0;while(n>=1024&&i<units.length-1){n/=1024;i++;}return `${n.toFixed(i?1:0)} ${units[i]}`;}
  function updatePreviewMode(mode,total,shown,stl){
    const button=$('preview-mode');button.disabled=false;
    button.textContent=mode==='quick'?'Load full detail':'Show preview';
  }
  function fullDetailWarning(message,onLoad=null){
    const detail=onLoad?String(message).replace(/\s*Continue using Preview\.\s*$/,''):message;
    showModal(`<div class="modal-head"><h2>${onLoad?'Full geometry may exceed available resources':'Full detail unavailable'}</h2><button class="icon-button" data-close aria-label="Close">×</button></div><div class="modal-body"><p role="alert">${esc(detail)}</p><p>${onLoad?'Loading full geometry may use more memory than is available and could make the viewer unresponsive.':'The current preview is unchanged.'}</p></div><div class="modal-foot"><button class="button primary" id="continue-preview" data-close>Continue in preview</button>${onLoad?'<button class="button" id="load-full-geometry">Load full geometry</button>':''}</div>`);
    if(onLoad)$('load-full-geometry').onclick=()=>{closeModal();onLoad();};
    $('continue-preview').focus();
  }
  function pauseFullDetailMemory(assessment,request,signal){
    if(signal.aborted||request!==previewRequest)return Promise.resolve(false);
    setPreviewProgress(true,0,0,'Full-detail loading paused');
    return new Promise(resolve=>{
      let settled=false;
      const settle=value=>{if(settled)return;settled=true;signal.removeEventListener('abort',abort);resolve(value);};
      const cleanup=()=>{settle(false);if(modalCleanup===cleanup)modalCleanup=null;};
      const abort=()=>{if(modalCleanup===cleanup)closeModal();else settle(false);};
      showModal(`<div class="modal-head"><h2>Full-detail loading paused</h2><button class="icon-button" data-close aria-label="Close">×</button></div><div class="modal-body"><p role="alert">${esc(assessment.reason)}</p><p>Geometry prepared: ${esc(formatBytes(assessment.geometryBytes))}</p><p>Continuing may exhaust memory. Checks remain active. The current preview is unchanged.</p></div><div class="modal-foot"><button class="button primary" id="memory-keep-preview" data-close>Continue in preview</button><button class="button" id="memory-continue-loading">Continue loading</button></div>`);
      modalCleanup=cleanup;signal.addEventListener('abort',abort,{once:true});
      $('memory-continue-loading').onclick=()=>{settle(true);closeModal();};
      $('memory-keep-preview').focus();
    });
  }
  function cancelPreview(){
    pointCloudInspector.cancel();previewRequest++;if(activePreviewJob){invoke?.('cancel_geometry_preview',{jobId:activePreviewJob}).catch(()=>{});activePreviewJob='';}if(previewProgressUnlisten){previewProgressUnlisten();previewProgressUnlisten=null;}if(previewCancelReject){previewCancelReject(new DOMException('Preview cancelled','AbortError'));previewCancelReject=null;}if(previewWorker){previewWorker.terminate();previewWorker=null;}if(previewAbort){previewAbort.abort();previewAbort=null;}
    setPreviewProgress(false);$('mesh-info').textContent='Preview loading cancelled';
  }
  async function loadPreview(path,mode='auto',layerId='source',{skipResourceCheck=false}={}){
    if(!path||!invoke||cleaningScratch)return;
    const beforeCheck=previewRequest,selection=++previewSelection;
    const automatic=mode==='auto';let geometryFile=null;
    const currentSelection=()=>beforeCheck===previewRequest&&selection===previewSelection;
    await viewerReady;
    if(!currentSelection())return;
    if(!viewer){toast('This computer could not start the WebGL viewer. Workflow editing is still available.');return;}
    if(automatic){
      try{geometryFile=await invoke('resolve_geometry',{path,workflowPath:currentPath||null});}catch{}
      if(!currentSelection())return;
      mode=initialGeometryMode(geometryFile?.size);
    }
    // Admission precedes changes to the current preview or scene. Automatic
    // loading falls back to preview if full detail cannot be admitted.
    if(mode==='full'&&!skipResourceCheck&&!/\.stl$/i.test(path)){
      const admitted=await admitFullDetail({invoke,viewer,path,workflowPath:currentPath||null,warn:message=>{
        if(!automatic&&currentSelection())fullDetailWarning(message,()=>{if(currentSelection())loadPreview(path,'full',layerId,{skipResourceCheck:true});});
      }});
      if(!currentSelection())return;
      if(!admitted){if(automatic)mode='quick';else return;}
    }
    const request=++previewRequest;
    if(activePreviewJob){invoke('cancel_geometry_preview',{jobId:activePreviewJob}).catch(()=>{});activePreviewJob='';}
    if(previewProgressUnlisten){previewProgressUnlisten();previewProgressUnlisten=null;}
    if(previewCancelReject){previewCancelReject(new DOMException('Preview replaced','AbortError'));previewCancelReject=null;}if(previewWorker){previewWorker.terminate();previewWorker=null;}
    if(previewAbort){previewAbort.abort();previewAbort=null;}
    fileIssues.delete(layerId);
    $('mesh-info').textContent=`Preparing ${mode==='quick'?'quick preview':'full detail'}…`;
    setPreviewProgress(true,0,0,'Opening geometry…');
    let thisJobId='',thisProgressUnlisten=null;
    try{
      const ext=path.split('.').pop().toLowerCase();let positions,totalTriangles,shownTriangles,center=null,bounds=null,inp=null,chunks=null,staged=false;
      if(mode==='quick'){
        const jobId=`preview-${Date.now()}-${Math.random().toString(36).slice(2)}`;thisJobId=jobId;activePreviewJob=jobId;
        try{thisProgressUnlisten=await window.__TAURI__.event.listen('geometry-preview-progress',event=>{const p=event.payload;if(p.jobId===jobId&&request===previewRequest)setPreviewProgress(true,p.loaded,p.total,p.stage);});}catch{}
        if(request!==previewRequest){thisProgressUnlisten?.();return;}
        previewProgressUnlisten=thisProgressUnlisten;
        const manifest=await invoke('prepare_mesh_preview',{jobId,path,workflowPath:currentPath||null});
        thisProgressUnlisten?.();if(previewProgressUnlisten===thisProgressUnlisten)previewProgressUnlisten=null;if(activePreviewJob===jobId)activePreviewJob='';
        if(request!==previewRequest){if(manifest.lod?.handle)invoke('close_preview_lod',{handle:manifest.lod.handle}).catch(()=>{});return;}
        previewAbort=new AbortController();
        const opened=await adaptivePreview.open(manifest,{id:layerId,path,signal:previewAbort.signal,current:()=>request===previewRequest});
        if(!opened||request!==previewRequest)return;
        loadedGeometryPath=path;loadedLayerId=layerId;loadedPreviewMode='quick';
        $('viewport-empty').classList.add('hidden');
        $('mesh-info').textContent=`Preview · ${manifest.triangles.toLocaleString()} source triangles${manifest.lines?' · '+manifest.lines.toLocaleString()+' lines':''} · Detail follows zoom`;
        updatePreviewMode('quick',manifest.triangles,manifest.overviewCount,true);setPreviewProgress(false);
        previewAbort=null;refreshTree();refreshProperties();return;
      }
      if(ext==='inp'){
        const file=geometryFile||await invoke('resolve_geometry',{path,workflowPath:currentPath||null});if(request!==previewRequest)return;
        inp=await loadStlWorker(window.__TAURI__.core.convertFileSrc(file.path),'full',file.size,request,true);
        positions=inp.positions;center=inp.center;bounds=inp.bounds;totalTriangles=shownTriangles=positions.length/9;
      }else if(ext==='stl'){
        const file=geometryFile||await invoke('resolve_geometry',{path,workflowPath:currentPath||null});
        if(request!==previewRequest)return;
        const url=window.__TAURI__.core.convertFileSrc(file.path);
        const result=await loadStlWorker(url,'full',file.size,request,false,layerId,path);
        staged=!!result.staged;
        if(request!==previewRequest)return;
        chunks=result.chunks||null;positions=chunks?new Float32Array():new Float32Array(result.positions);center=result.center;bounds=result.bounds;totalTriangles=result.totalTriangles;shownTriangles=result.triangles;
      }else{
        const file=geometryFile||await invoke('resolve_geometry',{path,workflowPath:currentPath||null});
        if(request!==previewRequest)return;
        const url=window.__TAURI__.core.convertFileSrc(file.path);previewAbort=new AbortController();
        const response=await fetch(url,{signal:previewAbort.signal});if(!response.ok)throw Error(`Could not read geometry (${response.status}).`);
        const bytes=new Uint8Array(await response.arrayBuffer());if(request!==previewRequest)return;
        const triangles=parseMesh(path,bytes);if(!triangles.length)throw Error('No renderable triangles found.');
        positions=new Float32Array(triangles.length*9);let offset=0;for(const tri of triangles)for(const point of tri)for(const value of point)positions[offset++]=value;
        totalTriangles=shownTriangles=triangles.length;
      }
      if(request!==previewRequest)return;
      if(!staged)viewer.setLayer(layerId,positions,{center,bounds,path,mode:'full',total:totalTriangles,chunks,...(inp?{lines:inp.lines,edges:inp.edges,metadata:inp.metadata,topology:inp.topology}:{})});loadedGeometryPath=path;loadedLayerId=layerId;loadedPreviewMode='full';
      $('viewport-empty').classList.add('hidden');
      $('mesh-info').textContent=(layerId==='source'?'Source · ':layerId==='result'?'Result · ':nameForPath(path)+' · ')+(loadedPreviewMode==='quick'?`Quick preview · ${shownTriangles.toLocaleString()} of ${totalTriangles.toLocaleString()} triangles · ${nameForPath(path)}`:`Full detail · ${totalTriangles.toLocaleString()} triangles · ${nameForPath(path)}`);
      if(inp)$('mesh-info').textContent=`${nameForPath(path)} · ${fileStats(viewer.layers.get(layerId))}`;
      updatePreviewMode(loadedPreviewMode,totalTriangles,shownTriangles,ext==='stl');setPreviewProgress(false);refreshTree();refreshProperties();
      previewWorker=null;previewAbort=null;
    }catch(e){
      thisProgressUnlisten?.();if(previewProgressUnlisten===thisProgressUnlisten)previewProgressUnlisten=null;if(activePreviewJob===thisJobId)activePreviewJob='';
      if(request!==previewRequest)return;
      if(e?.name==='AbortError'){setPreviewProgress(false);if(automatic&&mode==='full'&&selection===previewSelection){await loadPreview(path,'quick',layerId);return;}$('mesh-info').textContent='Full-detail loading cancelled';return;}
      if(previewWorker){previewWorker.terminate();previewWorker=null;}previewAbort=null;setPreviewProgress(false);
      if(mode==='full'){if(automatic){if(selection===previewSelection)await loadPreview(path,'quick',layerId);return;}fullDetailWarning(String(e?.message||e));return;}
      fileIssues.set(layerId,String(e?.message||e));refreshTree();refreshProperties();$('mesh-info').textContent='Could not preview this geometry';toast(`Preview failed: ${e?.message||e}`);
    }
  }
  function loadStlWorker(url,mode,fileSize,request,inp=false,layerId='source',path=''){
    if(!inp&&mode==='full'){
      const worker=new Worker(new URL('./full-stl-worker.js',import.meta.url),{type:'module'}),controller=new AbortController();
      previewWorker=worker;previewAbort=controller;
      return loadIndexedGeometry({worker,viewer,layerId,path,url,fileSize,invoke,signal:controller.signal,current:()=>request===previewRequest,
        pause:assessment=>pauseFullDetailMemory(assessment,request,controller.signal),
        onProgress:data=>{if(request===previewRequest)setPreviewProgress(true,data.loaded,data.total,data.stage);}
      }).finally(()=>{if(previewWorker===worker)previewWorker=null;if(previewAbort===controller)previewAbort=null;});
    }
    return new Promise((resolve,reject)=>{
      const indexed=!inp&&mode==='full',chunks=[];
      const worker=new Worker(new URL(inp?'./inp-worker.js':indexed?'./full-stl-worker.js':'./preview-worker.js',import.meta.url),inp||indexed?{type:'module'}:{});previewWorker=worker;previewCancelReject=reject;
      worker.onmessage=e=>{
        if(request!==previewRequest){worker.terminate();return;}
        const data=e.data;
        if(data.type==='progress')setPreviewProgress(true,data.loaded,data.total,data.stage||'Preparing mesh…');
        else if(data.type==='chunk'){chunks.push(data);worker.postMessage({type:'chunk-accepted'});}
        else if(data.type==='done'){worker.terminate();previewWorker=null;previewCancelReject=null;resolve(indexed?{...data,chunks}:data);}
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
  const scratchPreviewFolders=new Map();
  const scratchFolder=path=>String(path||'').replaceAll('\\','/').replace(/^\/\/\?\//,'').replace(/\/[^/]*$/,'').toLowerCase();
  function isScratchPreview(path){return scratchPreviewFolders.has(scratchFolder(path));}
  function isDiscardedPreview(path){return scratchPreviewFolders.get(scratchFolder(path))===false;}
  async function scratchPreviewPath(key,resultName){
    if(cleaningScratch)throw Error('Wait for scratch cleanup to finish.');
    const path=await invoke('prepare_workflow_preview',{workflowPath:currentPath,step:stepKeys().indexOf(key)+1,resultName});
    if(cleaningScratch)throw Error('Wait for scratch cleanup to finish.');
    scratchPreviewFolders.set(scratchFolder(path),true);
    return path;
  }
  async function runPanelWorkflow(preview,isCurrent,previewPath){
    if(runProgress.busy||preparingGeneration||cleaningScratch||!isCurrent())return;
    preparingGeneration=true;
    let fieldsReleased=false;
    try{
      if(!(await saveProject(false,preview.WorkFlow))||!isCurrent())return;
      fieldsReleased=true;fieldInspector.releaseForGeneration();
      return await runProgress.run({contents:workflowJson(preview).trimEnd(),backendPath,pythonPath:pythonPath||null,workflowPath:currentPath,previewPath},preview.WorkFlow);
    }finally{
      if(fieldsReleased)fieldInspector.resumeAfterGeneration();
      preparingGeneration=false;
    }
  }
  async function previewSlotJoint(params,context){
    if(runProgress.busy||preparingGeneration)return;
    if(!invoke||!backendPath)throw Error('Choose an Artisan backend with Backend… first.');
    const domainIssue=sampleDomainError();
    if(domainIssue)throw Error(domainIssue);
    const original=doc,key=context.key,fingerprint=slotFingerprint(doc,key);
    const isCurrent=()=>doc===original&&slotContext(params)?.key===key&&slotFingerprint(doc,key)===fingerprint;
    const path=await scratchPreviewPath(key,'plate_a.stl');
    if(!isCurrent())return;
    const {workflow,outputs}=slotPreviewWorkflow(doc,key,path);
    const run=await runPanelWorkflow(workflow,isCurrent,path);
    if(!run?.success)return run;
    const stillAvailable=()=>isCurrent()&&!cleaningScratch&&!isDiscardedPreview(path);
    if(!stillAvailable())return;
    const meshes={};
    for(const side of ['A','B']){
      const file=await invoke('resolve_geometry',{path:outputs[side],workflowPath:currentPath});
      if(!stillAvailable())return;
      if(file.size>64*1024*1024)throw Error('The joint preview is too large. Use coarser project sampling.');
      const url=window.__TAURI__.core.convertFileSrc(file.path),batches=[];
      await readStlStream(stlByteRanges(url,file.size),{fileSize:file.size,onChunk:chunk=>batches.push(chunk),
        isCancelled:()=>!stillAvailable()});
      if(!stillAvailable())return;
      if(!batches.length)throw Error('One preview plate contains no surface.');
      meshes[side]=batches;
    }
    return {...run,path,fingerprint,meshes};
  }
  async function previewContours(params,context){
    if(runProgress.busy||preparingGeneration)return;
    if(!invoke||!backendPath)throw Error('Choose an Artisan backend with Backend… first.');
    const domainIssue=sampleDomainError();
    if(domainIssue)throw Error(domainIssue);
    const original=doc,key=context.key,fingerprint=contourFingerprint(doc,key);
    const isCurrent=()=>doc===original&&contourContext(params)?.key===key&&contourFingerprint(doc,key)===fingerprint;
    const path=await scratchPreviewPath(key,'contours.contour');
    if(!isCurrent())return;
    const result=await runPanelWorkflow(contourPreviewWorkflow(doc,key,path),isCurrent,path);
    if(!result?.success)return result;
    if(!isCurrent()||isDiscardedPreview(path))return;
    const contents=await invoke('read_workflow_contours',{path});
    if(!isCurrent()||isDiscardedPreview(path))return;
    return {...result,path,fingerprint,slices:contourResults(contents,params.PlaneHeights)};
  }
  async function previewGeometry(keyword,params){
    const transition=transitionKeywords.includes(keyword),lattice=keyword==='Add_Lattice';
    if(runProgress.busy||preparingGeneration)return;
    if(!transition&&!lattice&&params.push2GeomField)return generate();
    if(!invoke||!backendPath)throw Error('Choose an Artisan backend with Backend… first.');
    const originalDoc=doc,key=stepKeys().find(k=>doc.WorkFlow[k]?.[keyword]===params);
    if(!key)throw Error('This geometry operation is no longer in the workflow.');
    const issue=(lattice?latticeError(params):transition?transitionError(keyword,params):geometryOperationError(params))||sampleDomainError();if(issue)throw Error(issue);
    const previewKey=lattice?latticePreviewKey(doc,key):'';
    const output=await scratchPreviewPath(key,lattice?'lattice_preview.stl':transition?'transition_preview.stl':'geometry_preview.stl');
    const isCurrent=()=>doc===originalDoc&&doc.WorkFlow[key]?.[keyword]===params&&(!lattice||latticePreviewKey(doc,key)===previewKey);
    if(!isCurrent())return;
    const preview=lattice?latticePreviewWorkflow(doc,key,output):transition?transitionPreviewWorkflow(doc,key,keyword,output):geometryPreviewWorkflow(doc,key,keyword,output);
    let result=await runPanelWorkflow(preview,isCurrent,output);
    if(result?.success&&isCurrent()&&!isDiscardedPreview(output)){await openResult(output);if(doc===originalDoc){selected=key;refreshAll();}toast(lattice?'Lattice preview saved.':transition?'Transition preview saved.':'Geometry preview saved.');
      if(lattice&&doc===originalDoc)result={...result,latticePreviewKey:previewKey};
    }
    return result;
  }
  async function previewScalarField(params){
    if(runProgress.busy||preparingGeneration)return;
    if(!invoke||!backendPath)throw Error('Choose the updated ArtisanMain.py or a rebuilt Artisan backend with Backend… first.');
    const key=stepKeys().find(k=>doc.WorkFlow[k]?.[scalarFieldKeyword]===params);
    if(!key)throw Error('This field is no longer in the workflow.');
    const domainIssue=sampleDomainError();if(domainIssue)throw Error(domainIssue);
    const originalDoc=doc,isCurrent=()=>doc===originalDoc&&doc.WorkFlow[key]?.[scalarFieldKeyword]===params;
    const output=await scratchPreviewPath(key,'scalar_field.h5');
    if(!isCurrent())return;
    const preview=fieldPreviewWorkflow(doc,key,output);
    const result=await runPanelWorkflow(preview,isCurrent,output);
    if(result?.success&&isCurrent()&&!isDiscardedPreview(output)){toast('Field preview saved.');await fieldInspector.load(output,null,params.field_id);}
    return result;
  }
  async function previewMorph(params,options){
    if(runProgress.busy||preparingGeneration)return;
    if(!invoke||!backendPath)throw Error('Choose an Artisan backend with Proc_Field_Morph support using Backend… first.');
    const context=morphContext(params);if(!context.key)throw Error('This morph is no longer in the workflow.');
    const domainIssue=sampleDomainError();if(domainIssue)throw Error(domainIssue);
    const originalDoc=doc,isCurrent=()=>doc===originalDoc&&morphContext(params).key===context.key;
    const output=await scratchPreviewPath(context.key,'morph_field.h5');
    if(!isCurrent())return;
    const preview=morphPreviewWorkflow(doc,context.key,output,options);
    const result=await runPanelWorkflow(preview.workflow,isCurrent,output);
    if(result?.success&&isCurrent()&&!isDiscardedPreview(output)){
      try{result.report=await invoke('read_morph_report',{path:preview.report});}catch(e){toast('Preview computed, but the quality report could not be read: '+String(e));}
      if(preview.mesh)await openResult(preview.mesh);else await fieldInspector.load(output,null,preview.field);
      // Keep movement controls available after loading the computed result.
      const key=morphContext(params).key;if(key){selected=key;refreshAll();}
      toast('Morph preview saved with quality report.');
    }
    return result;
  }
  async function generate(){
    if(runProgress.busy||preparingGeneration)return;
    if(applyLatticeDraft&&!applyLatticeDraft())return;
    const scalarIssue=scalarWorkflowError(doc.WorkFlow)||morphWorkflowError(doc.WorkFlow)||transitionWorkflowError(doc.WorkFlow)||latticePanelWorkflowError(doc.WorkFlow)||quadWorkflowError(doc.WorkFlow)||primitiveMeshWorkflowError(doc.WorkFlow)||geometryFieldWorkflowError(doc.WorkFlow)||fieldMergeWorkflowError(doc.WorkFlow)||contourWorkflowError(doc.WorkFlow)||slotWorkflowError(doc.WorkFlow);if(scalarIssue){toast(scalarIssue);return;}
    const exportIssue=exportWorkflowError(doc.WorkFlow,exportDrafts);if(exportIssue){toast(exportIssue);return;}
    const latticeError=latticeWorkflowError();if(latticeError){toast(latticeError);return;}
    const domainError=sampleDomainError();if(domainError){selected='setup';refreshAll();toast(domainError);return;}
    if(!stepKeys().length){toast('Add at least one operation before generating.');return;}
    if(!invoke||!backendPath){toast('Choose ArtisanMain.exe or ArtisanMain.py with Backend… first.');return;}
    preparingGeneration=true;$('generate').disabled=true;
    let fieldsReleased=false;
    try{if(!(await saveProject()))return;
      fieldInspector.releaseForGeneration();fieldsReleased=true;
      const originalDoc=doc,snapshots=stepKeys().flatMap(key=>mesherKeywords.filter(keyword=>doc.WorkFlow[key]?.[keyword]).map(keyword=>({key,params:doc.WorkFlow[key][keyword],fingerprint:quadFingerprint(doc,key)})));
      const result=await runProgress.run({contents:workflowJson(Object.fromEntries(Object.entries(doc).filter(([key])=>key!=='ArtGUI'))).trimEnd(),backendPath,pythonPath:pythonPath||null,workflowPath:currentPath},doc.WorkFlow);
      // The run has exited and HDF5 handles are closed; read only reports for
      // steps whose exact input snapshot remains in this document.
      if(fieldsReleased){fieldInspector.resumeAfterGeneration();fieldsReleased=false;}
      preparingGeneration=false;
      if(result?.success&&doc===originalDoc)for(const snapshot of snapshots){if(mesherContext(snapshot.params)?.key===snapshot.key&&quadFingerprint(doc,snapshot.key)===snapshot.fingerprint){mesherPreviewPaths.delete(snapshot.params);await mesherEditor.loadReport(snapshot.params,false,snapshot.fingerprint);}}
      return result;
    }finally{if(fieldsReleased)fieldInspector.resumeAfterGeneration();preparingGeneration=false;$('generate').disabled=false;}
  }
  async function init(){
    $('backend-indicator').textContent=backendPath?nameForPath(backendPath):'Not connected';if(backendPath)$('backend-indicator').title=backendDescription();
    $('help-button').onclick=showAbout;
    $('new-project').onclick=newProject;$('open-project').onclick=openProject;$('save-project').onclick=()=>saveProject();$('save-project-as').onclick=()=>saveProject(true);$('json-button').onclick=openJson;$('add-operation-bottom').onclick=showPicker;$('reset-properties').onclick=editSetup;$('remove-step').onclick=removeStep;$('move-up').onclick=()=>moveStep(-1);$('move-down').onclick=()=>moveStep(1);$('clear-workflow').onclick=clearWorkflow;$('choose-backend').onclick=chooseBackend;$('load-geometry').onclick=$('empty-load').onclick=loadGeometry;$('fit-view').onclick=()=>viewer?.fit();$('view-cube').onclick=()=>viewer?.reset();$('clean-scratch').onclick=cleanScratch;$('load-result').onclick=loadResult;$('view-generated-field').onclick=viewField;$('preview-mode').onclick=()=>{if(loadedGeometryPath)loadPreview(loadedGeometryPath,loadedPreviewMode==='quick'?'full':'quick',loadedLayerId);};$('cancel-preview').onclick=cancelPreview;$('generate').onclick=generate;
    document.body.insertAdjacentHTML('beforeend','<input id="fallback-file" type="file" accept=".json,application/json" hidden>');$('fallback-file').onchange=e=>{const f=e.target.files[0];if(f){const r=new FileReader();r.onload=()=>loadWorkflow(r.result,f.name);r.readAsText(f);}};
    document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();saveProject(e.shiftKey);}if(e.key==='Escape')closeModal();});refreshAll();selected='setup';refreshTree();refreshProperties();
    viewerReady=(async()=>{
      try{
        const {GeometryViewer}=await import('./viewer.js');
        const {createAdaptivePreview}=await import('./adaptive-preview.js');
        viewer=new GeometryViewer($('model-canvas'),{
          toast,
          onLayerOpacityChanged:(id,opacity)=>{
            if(saveGeometryOpacity(doc,id,opacity))markDirty();
            const selectedId=selected==='geometry'?'source':selected?.startsWith('file:')?selected.slice(5):null;
            if(selectedId===id&&$('file-opacity')){$('file-opacity').value=Math.round(opacity*100);$('file-opacity-value').textContent=Math.round(opacity*100)+'%';}
          },
          onLayerColorChanged:(id,colour)=>{
            if(saveGeometryColour(doc,id,colour))markDirty();
            const selectedId=selected==='geometry'?'source':selected?.startsWith('file:')?selected.slice(5):null;
            if(selectedId===id&&$('file-colour')){$('file-colour').value=colour;$('file-colour-value').textContent=colour;}
          },
          onLayersChanged:()=>{slotEditor.syncOverlay();contourEditor.syncOverlay();setupEditor.refresh();viewer?.regionOverlay?.refresh();viewer?.morphOverlay?.refresh();refreshTree();if(selected==='geometry'||selected?.startsWith('file:'))refreshProperties();},
          onLayerSelected:(id,layer)=>{if(!layer)return;loadedLayerId=id;loadedGeometryPath=layer.path;loadedPreviewMode=layer.mode;updatePreviewMode(layer.mode,layer.total,layer.shown,/\.stl$/i.test(layer.path));$('mesh-info').textContent=`${id==='source'?'Source':id==='result'?'Result':nameForPath(layer.path)} · ${layer.mode==='quick'?'Preview · Detail follows zoom':'Full detail'} · ${layer.metadata?fileStats(layer):layer.shown.toLocaleString()+' of '+layer.total.toLocaleString()+' triangles'}`;refreshTree();},
          exportImage:invoke?async blob=>{const path=await invoke('save_view_image',{pngData:Array.from(new Uint8Array(await blob.arrayBuffer()))});if(path)toast('Viewport image saved.');}:null
        });
        applyGeometryColours(viewer,doc);applyGeometryOpacities(viewer,doc);
        adaptivePreview=createAdaptivePreview({viewer,invoke,fileUrl:p=>window.__TAURI__.core.convertFileSrc(p),toast,
          onStats:(id,stats)=>{if(loadedLayerId===id&&loadedPreviewMode==='quick')$('mesh-info').textContent=`Preview · ${stats.loadedTiles} detailed blocks · ${stats.total.toLocaleString()} source triangles · Detail follows zoom`;}});
        const {createRegionOverlay}=await import('./region-overlay.js');
        viewer.regionOverlay=createRegionOverlay(viewer,{onSelect:i=>regionEditor.select(i),onDrag:g=>regionEditor.drag(g),onCommit:g=>regionEditor.commit(g),onCancel:g=>regionEditor.cancel(g),toast});
        regionEditor.attachOverlay(viewer.regionOverlay);
        const {createMorphOverlay}=await import('./morph-overlay.js');
        viewer.morphOverlay=createMorphOverlay(viewer,{onSelect:i=>morphEditor.select(i),onDrag:r=>morphEditor.drag(r),onCommit:r=>morphEditor.commit(r),onCancel:r=>morphEditor.cancel(r),toast});
        morphEditor.attachOverlay(viewer.morphOverlay);
        viewer.spatialOverlay=createRegionOverlay(viewer,{onSelect:i=>spatialEditor.select(i),onDrag:g=>spatialEditor.drag(g),onCommit:g=>spatialEditor.commit(g),onCancel:g=>spatialEditor.cancel(g),toast});
        spatialEditor.attachOverlay(viewer.spatialOverlay);
        const {createSetupOverlay}=await import('./setup-overlay.js');
        viewer.setupOverlay=createSetupOverlay(viewer,{onDrag:g=>setupEditor.drag(g),onCommit:()=>setupEditor.commit(),onCancel:()=>setupEditor.cancel(),onTool:mode=>setupEditor.tool(mode),toast});
        setupEditor.attachOverlay(viewer.setupOverlay);
        const {createPrimitiveMeshOverlay}=await import('./primitive-mesh-overlay.js');
        viewer.primitiveMeshOverlay=createPrimitiveMeshOverlay(viewer,{onSelect:path=>primitiveMeshEditor.select(path),onBegin:()=>primitiveMeshEditor.begin(),onDrag:(path,value)=>primitiveMeshEditor.drag(path,value),onCommit:()=>primitiveMeshEditor.commit(),onCancel:()=>primitiveMeshEditor.cancel(),onDisplay:mode=>primitiveMeshEditor.setDisplay(mode),toast});
        primitiveMeshEditor.attachOverlay(viewer.primitiveMeshOverlay);
        viewer.geometryFieldOverlay=createRegionOverlay(viewer,{onSelect:()=>{},onDrag:g=>geometryFieldEditor.drag(g),onCommit:g=>geometryFieldEditor.commitDrag(g),onCancel:g=>geometryFieldEditor.cancelDrag(g),toast,legendLabel:'Influence geometry'});
        geometryFieldEditor.attachOverlay(viewer.geometryFieldOverlay);
        viewer.fieldMergeOverlay=createRegionOverlay(viewer,{onSelect:i=>fieldMergeEditor.select(i),onDrag:g=>fieldMergeEditor.drag(g),onCommit:()=>fieldMergeEditor.commitDrag(),onCancel:()=>fieldMergeEditor.cancelDrag(),toast,legendLabel:'Transition region'});
        fieldMergeEditor.attachOverlay(viewer.fieldMergeOverlay);
        const {createContourOverlay}=await import('./contour-overlay.js');
        viewer.contourOverlay=createContourOverlay(viewer,index=>contourEditor.select(index));
        contourEditor.attachOverlay(viewer.contourOverlay);
        const {createSlotOverlay}=await import('./slot-overlay.js');
        viewer.slotOverlay=createSlotOverlay(viewer,()=>slotEditor.isolate());
        slotEditor.attachOverlay(viewer.slotOverlay);
        fieldInspector.attachViewer();pointCloudInspector.attachViewer();
      }catch(e){
        console.error('ArtGUI 3D viewer startup failed:',e);
        $('mesh-info').textContent='3D preview could not start. Workflow editing is available.';
        $('viewport-empty').querySelector('strong').textContent='3D preview unavailable';
        $('viewport-empty').querySelector('span').textContent='You can still select geometry and edit your workflow.';
        $('preview-mode').disabled=true;
      }
    })();
    $('viewport').addEventListener('dragover',event=>{if([...event.dataTransfer.items].some(item=>item.kind==='file'))event.preventDefault();});
    $('viewport').addEventListener('drop',event=>{const file=[...event.dataTransfer.files].find(file=>/\.(csv|tsv)$/i.test(file.name));if(file){event.preventDefault();pointCloudInspector.importSource(file.name,file);}});
    // Keep editing and file dialogs usable if packaged backend discovery is slow.
    if(invoke&&!backendPath){invoke('packaged_backend').then(p=>{if(p){backendPath=p;localStorage.setItem('artisan.backend',p);$('backend-indicator').textContent=nameForPath(p);$('backend-indicator').title=p;}}).catch(()=>{});}
  }
  init().catch(e=>{console.error('ArtGUI interface startup failed:',e);setStatus('Interface could not start');toast(`Interface startup failed: ${e.message||e}`);});
})();
