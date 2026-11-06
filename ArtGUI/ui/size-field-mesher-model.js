import {cloneNumericJson,assignNumericJson,setNumber} from './numeric-json.js';
import {prepareFieldOperation,tetFieldKeyword} from './field-workflow.js';
import {quadKeyword,quadKeys,earlierInputs,isMeshPath,quadError,updateQuadValue,meshOutput,reportSummary} from './quad-mesher-model.js';

export const mesherKeywords=[tetFieldKeyword,quadKeyword];
export const mesherKind=keyword=>keyword===tetFieldKeyword?'tet':'quad';
export const mesherTitle=keyword=>keyword===tetFieldKeyword?'Tet volume mesh':'Quad surface mesh';
export const mesherKeys=keyword=>keyword===tetFieldKeyword?quadKeys.filter(key=>!['method','split_to_triangles'].includes(key)).concat('sampling_size'):quadKeys;
export {earlierInputs,isMeshPath,meshOutput};
const entries=workflow=>Object.entries(workflow||{}).sort(([a],[b])=>Number(a)-Number(b));
const numbers=['sampling_size','hausd','surface_tolerance','hgrad','feature_angle','size_iterations','max_points'];

export function setMesherValue(params,name,value){
  if(numbers.includes(name)){
    if(name==='surface_tolerance'&&String(value).trim()==='')params[name]=null;
    else setNumber(params,name,String(value),['size_iterations','max_points'].includes(name)?'integer':'float');
  }else params[name]=value;
}

function renameTetOutput(workflow,key,previous,next){
  if(previous===next)return;
  for(const [step,commands] of entries(workflow).filter(([step])=>Number(step)>Number(key))){
    const exported=commands.ExportMeshID;if(exported?.MeshID===previous){exported.MeshID=next;exported.elem_type='Tet';}
    const d=commands.Define_Lattice?.definition;if(d&&['MeshLattice','ConformalLattice'].includes(d.type)&&d.definition?.meshfile===previous)d.definition.meshfile=next;
  }
}
export function applyMesherDraft(params,draft,workflow,key,keyword){
  if(keyword===quadKeyword){
    updateQuadValue(params,'export_mesh',draft.export_mesh,workflow,key);
    updateQuadValue(params,'split_to_triangles',draft.split_to_triangles,workflow,key);
  }else renameTetOutput(workflow,key,params.export_mesh,draft.export_mesh);
  assignNumericJson(params,draft);
}
export function mesherDraftWorkflow(workflow,key,keyword,draft){
  const copy=cloneNumericJson(workflow);applyMesherDraft(copy[key][keyword],draft,copy,key,keyword);return copy;
}
export function mesherError(keyword,input,workflow,key){
  if(keyword===quadKeyword)return quadError(input,workflow,key);
  if(!input||typeof input!=='object'||Array.isArray(input))return 'Tet mesh parameters must be an object.';
  if(!Number.isFinite(input.sampling_size)||input.sampling_size<=0)return 'Initial seed size must be a finite, positive number.';
  if(Object.values(input).some(value=>typeof value==='number'&&!Number.isFinite(value)))return 'Meshing parameters must use finite numbers.';
  const p=prepareFieldOperation(keyword,cloneNumericJson(input)),before=earlierInputs(workflow,key);
  for(const name of ['mesh_file','size_field','export_mesh'])if(typeof p[name]!=='string'||!p[name].trim())return `Choose ${name==='mesh_file'?'a surface':name==='size_field'?'a size field':'an output mesh'}.`;
  if(!isMeshPath(p.mesh_file)&&!before.meshes.some(mesh=>mesh.id===p.mesh_file))return 'Choose a triangle mesh created before this step, or select a surface file.';
  if(!before.fields.some(field=>field.id===p.size_field))return 'Create or load the size field before this step.';
  if(!Number.isFinite(p.sampling_size)||p.sampling_size<=0)return 'Initial seed size must be a finite, positive number.';
  if(typeof p.preserve_features!=='boolean')return 'preserve_features must be a boolean.';
  if(!Number.isFinite(p.hausd)||p.hausd<=0)return 'Boundary tolerance must be positive.';
  if(p.surface_tolerance!==null&&(!Number.isFinite(p.surface_tolerance)||p.surface_tolerance<=0))return 'Final surface tolerance must be positive, or Automatic.';
  if(!Number.isFinite(p.hgrad)||p.hgrad<=1)return 'Size gradation must be greater than 1.';
  if(!Number.isFinite(p.feature_angle)||p.feature_angle<0||p.feature_angle>180)return 'Feature angle must be between 0 and 180 degrees.';
  if(!Number.isInteger(p.size_iterations)||p.size_iterations<2||p.size_iterations>20)return 'Adaptation passes must be an integer from 2 to 20.';
  if(!Number.isInteger(p.max_points)||p.max_points<7||p.max_points>2147483647)return 'Vertex limit must be an integer from 7 to 2147483647.';
  if(isMeshPath(p.export_mesh)&&!/[.](inp|vtk|vtu|msh|mesh|med)$/i.test(p.export_mesh))return 'Tet volume output needs INP, VTK, VTU, MSH, MESH or MED.';
  if(typeof p.quality_report!=='string'||p.quality_report&&!/[.]json$/i.test(p.quality_report))return 'Quality report must be empty or a JSON filename.';
  const normal=value=>String(value).replaceAll('\\','/').toLowerCase();
  if(p.quality_report&&[p.mesh_file,p.export_mesh].some(path=>normal(path)===normal(p.quality_report)))return 'Quality report must differ from the input and output mesh.';
  for(const [step,commands] of entries(workflow).filter(([step])=>Number(step)>Number(key)))if(commands.ExportMeshID?.MeshID===p.export_mesh&&commands.ExportMeshID.elem_type!=='Tet')return `Step ${step}: export element type must be Tet.`;
  return '';
}
export function mesherWorkflowError(workflow){
  for(const [key,commands] of entries(workflow))for(const keyword of mesherKeywords)if(commands[keyword]){
    const error=mesherError(keyword,commands[keyword],workflow,key);if(error)return `Step ${key}: ${error}`;
  }
  return '';
}
export const mesherFingerprint=(doc,key)=>JSON.stringify({Setup:doc.Setup,steps:entries(doc.WorkFlow).filter(([step])=>Number(step)<=Number(key))});

// A workflow alias and the HDF5 dataset name are deliberately kept separate.
export function sizeFieldView(workflow,key,fieldId,references=[]){
  const producer=earlierInputs(workflow,key).fields.find(field=>field.id===fieldId);
  if(!producer)return null;
  if(producer.keyword==='ReadGridField'){
    const p=workflow[producer.key].ReadGridField;
    return {path:p.inp_GridFieldFile||'',storedId:p.FieldID||fieldId,fieldId,producerKey:producer.key};
  }
  let path='';
  for(const [step,commands] of entries(workflow)){
    if(Number(step)<Number(producer.key))continue;
    const replacement=commands.Define_ScalarField_CombineGeometry?.field_id||commands.OP_ExprOperation_GridField?.out_gridFieldFile||commands.OP_Fit_GridField?.out_gridFieldFile||commands.Proc_Field_Morph?.output_field||commands.ReadGridField?.Gridfield_ID;
    if(Number(step)>Number(producer.key)&&replacement===fieldId)break;
    const e=commands.Export;if(!e?.GridFieldIDs?.includes(fieldId))continue;
    const candidate=e.fieldfile||e.outfile;if(/[.](h5|hdf5)$/i.test(candidate||'')){path=candidate;break;}
  }
  if(!path)path=references.find(ref=>ref.fieldId===fieldId)?.path||'';
  return {path,storedId:fieldId,fieldId,producerKey:producer.key};
}

export function mesherRunWorkflow(doc,key,keyword,meshPath,reportPath){
  if(!doc.WorkFlow?.[key]?.[keyword])throw Error('This meshing step is no longer in the workflow.');
  const copy=cloneNumericJson(doc),steps=[];
  for(const [step,commands] of entries(copy.WorkFlow)){
    if(Number(step)>Number(key))break;
    // Keep explicit field exports, but do not run unrelated mesh exports.
    const keep={};for(const [name,p] of Object.entries(commands)){
      if(name==='ExportMeshID')continue;
      if(name==='Export'){
        const path=p.fieldfile||p.outfile;
        if(p.GridFieldIDs?.length&&/[.](h5|hdf5)$/i.test(path||''))keep.Export={outfile:path,GridFieldIDs:p.GridFieldIDs};
      }else keep[name]=p;
    }
    if(Object.keys(keep).length)steps.push(keep);
  }
  const p=steps.at(-1)?.[keyword];if(!p)throw Error('The meshing step must be the final operation in its preview.');
  p.quality_report=reportPath;
  if(isMeshPath(p.export_mesh))p.export_mesh=meshPath;
  else steps.push({ExportMeshID:{MeshID:p.export_mesh,out_meshfile:meshPath,elem_type:keyword===tetFieldKeyword?'Tet':p.split_to_triangles?'Triangle':'Quad'}});
  copy.WorkFlow=Object.fromEntries(steps.map((step,index)=>[String(index+1),step]));delete copy.ArtGUI;return copy;
}

export function mesherReportSummary(keyword,report){
  if(keyword===quadKeyword)return reportSummary(report);
  const f=report?.final;if(report?.valid!==true||!f)return null;
  const quality=f.mean_ratio_quality_percentiles?.[0],sizeWarning=f.fraction_edges_below_half_target>.05||f.fraction_edges_above_twice_target>.05;
  return {tet:true,vertices:f.vertices,tetrahedra:f.tetrahedra,quality,volume:f.volume,ratio:f.edge_to_target_percentiles?.[2],surface:(f.boundary_error||f.surface_error)?.maximum,tolerance:report.surface_tolerance,sizeWarning,review:sizeWarning||(Number.isFinite(quality)&&quality<.1)};
}
