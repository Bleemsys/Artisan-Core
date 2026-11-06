import {setNumber} from './numeric-json.js';

export const quadKeyword='Gen_QuadMesh_SizeField';
export const quadMethods=['SimpleQuad','Subdivision'];
export const quadKeys=['mesh_file','size_field','export_mesh','method','split_to_triangles','preserve_features','feature_angle','hausd','surface_tolerance','hgrad','size_iterations','max_points','quality_report'];
export const isMeshPath=value=>/[\\/]/.test(String(value||''))||/\.[^./\\]+$/.test(String(value||''));
export const outputElement=params=>params.split_to_triangles?'Triangle':'Quad';
const entries=workflow=>Object.entries(workflow||{}).sort(([a],[b])=>Number(a)-Number(b));

export function earlierInputs(workflow,key){
  const fields=new Map(),meshes=new Map();
  for(const [step,commands] of entries(workflow)){
    if(step===String(key))break;
    for(const [keyword,p] of Object.entries(commands||{})){
      if(!p||typeof p!=='object')continue;
      const field=keyword==='Define_ScalarField_CombineGeometry'?p.field_id:['OP_ExprOperation_GridField','OP_Fit_GridField'].includes(keyword)?p.out_gridFieldFile:keyword==='Proc_Field_Morph'?p.output_field:keyword==='ReadGridField'?p.Gridfield_ID:null;
      if(typeof field==='string'&&field.trim())fields.set(field,{id:field,key:step,keyword});
      if(keyword==='ReadMesh'&&p.elem_type==='Triangle'&&p.MeshID)meshes.set(p.MeshID,{id:p.MeshID,key:step,path:p.meshfile,keyword});
      if(keyword==='Gen_SurfaceReMesh'&&p.export_mesh)meshes.set(p.export_mesh,{id:p.export_mesh,key:step,keyword});
      if(keyword===quadKeyword&&p.split_to_triangles&&p.export_mesh)meshes.set(p.export_mesh,{id:p.export_mesh,key:step,keyword});
      if(keyword==='RemoveMesh')meshes.delete(p.MeshID);
    }
  }
  return {fields:[...fields.values()],meshes:[...meshes.values()]};
}

export function quadError(p,workflow,key){
  if(!p||typeof p!=='object'||Array.isArray(p))return 'Quad surface parameters must be an object.';
  if(!quadMethods.includes(p.method===undefined?'SimpleQuad':p.method))return 'Choose SimpleQuad or Subdivision.';
  for(const name of ['mesh_file','size_field','export_mesh'])if(typeof p[name]!=='string'||!p[name].trim())return `Choose ${name==='mesh_file'?'a surface':name==='size_field'?'a size field':'an output mesh'}.`;
  const earlier=earlierInputs(workflow,key);
  if(!isMeshPath(p.mesh_file)&&!earlier.meshes.some(m=>m.id===p.mesh_file))return 'Choose a triangle mesh created before this step, or select a surface file.';
  if(!earlier.fields.some(f=>f.id===p.size_field))return 'Create or load the size field before this step.';
  for(const name of ['split_to_triangles','preserve_features'])if(typeof p[name]!=='boolean')return `${name} must be a boolean.`;
  for(const name of ['hausd','hgrad','feature_angle','size_iterations','max_points'])if(typeof p[name]!=='number'||!Number.isFinite(p[name]))return `${name} must be a finite number.`;
  if(p.hausd<=0)return 'Surface approximation must be positive.';
  if(p.surface_tolerance!==null&&(typeof p.surface_tolerance!=='number'||!Number.isFinite(p.surface_tolerance)||p.surface_tolerance<=0))return 'Final surface tolerance must be positive, or Automatic.';
  if(p.hgrad<=1)return 'Size gradation must be greater than 1.';
  if(p.feature_angle<0||p.feature_angle>180)return 'Feature angle must be between 0 and 180 degrees.';
  if(!Number.isInteger(p.size_iterations)||p.size_iterations<2||p.size_iterations>20)return 'Adaptation passes must be an integer from 2 to 20.';
  if(!Number.isInteger(p.max_points)||p.max_points<7||p.max_points>2147483647)return 'Vertex limit must be an integer from 7 to 2147483647.';
  if(typeof p.quality_report!=='string'||p.quality_report&& !/\.json$/i.test(p.quality_report))return 'Quality report must be empty or a JSON filename.';
  const allowed=p.split_to_triangles?/\.(inp|vtk|vtu|msh|med|stl)$/i:/\.(inp|vtk|vtu|msh|med)$/i;
  if(isMeshPath(p.export_mesh)&&!allowed.test(p.export_mesh))return p.split_to_triangles?'Triangle output needs INP, VTK, VTU, MSH, MED or STL.':'Quad output needs INP, VTK, VTU, MSH or MED. Enable triangle splitting to use STL.';
  const normal=s=>String(s).replaceAll('\\','/').toLowerCase();
  if(p.quality_report&&[p.mesh_file,p.export_mesh].some(path=>normal(path)===normal(p.quality_report)))return 'Quality report must differ from the input and output mesh.';
  const unknown=Object.keys(p).filter(k=>!quadKeys.includes(k));
  if(unknown.length)return 'Unsupported quad surface parameters: '+unknown.join(', ');
  for(const [step,commands] of entries(workflow).filter(([k])=>Number(k)>Number(key))){
    const e=commands.ExportMeshID;
    if(e?.MeshID!==p.export_mesh)continue;
    if(e.elem_type!==outputElement(p))return `Step ${step}: export element type must be ${outputElement(p)}.`;
    if(!allowed.test(e.out_meshfile||''))return `Step ${step}: choose a compatible mesh export format.`;
  }
  return '';
}
export function quadWorkflowError(workflow){for(const [key,commands] of entries(workflow)){if(commands[quadKeyword]){const message=quadError(commands[quadKeyword],workflow,key);if(message)return `Step ${key}: ${message}`;}}return '';}

export function updateQuadValue(params,name,value,workflow,key){
  const previous=params.export_mesh;
  if(['hausd','surface_tolerance','hgrad','feature_angle','size_iterations','max_points'].includes(name)){
    if(name==='surface_tolerance'&&String(value).trim()==='')params[name]=null;
    else setNumber(params,name,String(value),['size_iterations','max_points'].includes(name)?'integer':'float');
  }else params[name]=value;
  if(name==='split_to_triangles'||name==='export_mesh')for(const [step,commands] of entries(workflow)){
    const e=commands.ExportMeshID;
    if(Number(step)>Number(key)&&e?.MeshID===previous){e.MeshID=params.export_mesh;e.elem_type=outputElement(params);}
  }
}
export function meshOutput(workflow,key,params){
  if(isMeshPath(params.export_mesh))return params.export_mesh;
  return entries(workflow).filter(([k])=>Number(k)>Number(key)).map(([,s])=>s.ExportMeshID)
    .find(e=>e?.MeshID===params.export_mesh&&/\.(inp|stl|obj|ply)$/i.test(e.out_meshfile||''))?.out_meshfile||'';
}
export function fieldOutput(workflow,key,fieldId){
  const producer=earlierInputs(workflow,key).fields.find(f=>f.id===fieldId);
  if(producer?.keyword==='ReadGridField')return workflow[producer.key].ReadGridField.inp_GridFieldFile;
  return entries(workflow).filter(([k])=>!producer||Number(k)>=Number(producer.key)).map(([,s])=>s.Export)
    .find(e=>e?.GridFieldIDs?.includes(fieldId)&&/\.(h5|hdf5)$/i.test(e.fieldfile||e.outfile||''))?.fieldfile||
    entries(workflow).filter(([k])=>!producer||Number(k)>=Number(producer.key)).map(([,s])=>s.Export)
    .find(e=>e?.GridFieldIDs?.includes(fieldId)&&/\.(h5|hdf5)$/i.test(e.outfile||''))?.outfile||'';
}
export function quadFingerprint(doc,key){return JSON.stringify({Setup:doc.Setup,steps:entries(doc.WorkFlow).filter(([k])=>Number(k)<=Number(key))});}

export function reportSummary(report){
  const f=report?.final;if(!f||report.valid!==true)return null;
  const triangle=report.output_element_type==='Triangle'||report.split_to_triangles===true;
  const quality=triangle?f.mean_ratio_quality_percentiles?.[0]:f.scaled_jacobian_percentiles?.[0];
  const surface=f.surface_error?.maximum;
  const sizeWarning=f.fraction_edges_below_half_target>.05||f.fraction_edges_above_twice_target>.05;
  const method=report.meshing_method||(report.method==='QuadriFlow layout + conforming scalar-field quad adaptation'?'SimpleQuad':report.method==='Native MMGS scalar-field adaptation + conforming all-quad subdivision'?'Subdivision':'');
  return {method,triangle,quads:f.quadrilaterals,triangles:f.triangles,vertices:f.vertices,quality,surface,
    tolerance:report.surface_tolerance,ratio:f.edge_to_target_percentiles?.[2],bins:f.target_size_bins||[],
    review:sizeWarning||(Number.isFinite(quality)&&quality<.1),sizeWarning};
}
