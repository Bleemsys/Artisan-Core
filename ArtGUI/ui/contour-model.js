import {cloneNumericJson,stringifyNumericJson} from './numeric-json.js';
import {isMeshPath} from './quad-mesher-model.js';

export const contourKeyword='Gen_Z_ContourLines';

export function contourSchedule(start,end,step){
  const span=end-start,ratio=span/step;
  if(![start,end,step,ratio].every(Number.isFinite)||span<0||step<=0)
    throw Error('Enter a valid start, end and positive step.');
  // Include the end when it lies on the sequence, tolerating roundoff.
  const count=Math.floor(ratio+8*Number.EPSILON*Math.max(1,ratio))+1;
  if(count>1000)throw Error('Even spacing supports up to 1000 slice heights.');
  const heights=Array.from({length:count},(_,i)=>{
    const raw=start+i*step,rounded=Number(raw.toPrecision(15));
    const height=Math.abs(raw-rounded)<=step*1e-10?rounded:raw;
    if(i===0)return start;
    return i===count-1&&Math.abs(ratio-i)<=8*Number.EPSILON*Math.max(1,ratio)?end:height;
  });
  if(new Set(heights).size!==count)throw Error('The step is too small to produce distinct heights.');
  return heights;
}

export function contourSpacing(heights){
  if(!Array.isArray(heights)||heights.length<2||!heights.every(Number.isFinite))return null;
  const start=heights[0],end=heights.at(-1),step=(end-start)/(heights.length-1);
  try{
    const values=contourSchedule(start,end,step);
    return values.length===heights.length&&values.every((value,i)=>Math.abs(value-heights[i])<=Math.abs(step)*1e-10)?{start,end,step}:null;
  }catch{return null;}
}

export function contourError(params){
  if(!Array.isArray(params?.PlaneHeights)||!params.PlaneHeights.length||!params.PlaneHeights.every(Number.isFinite))return 'Enter at least one finite slice height.';
  if(new Set(params.PlaneHeights).size!==params.PlaneHeights.length)return 'Slice heights must be distinct.';
  if(!Array.isArray(params.res)||params.res.length!==3||!params.res.every(value=>Number.isFinite(value)&&value>0))return 'Enter positive X, Y and Z sampling resolutions.';
  if(typeof params.out_meshfile!=='string'||!params.out_meshfile.trim())return 'Enter an output file or Mesh ID.';
  return '';
}

export function contourWorkflowError(workflow){
  for(const [step,commands] of Object.entries(workflow||{})){
    if(!Object.hasOwn(commands||{},contourKeyword))continue;
    const issue=contourError(commands[contourKeyword]);
    if(issue)return 'Step '+step+': '+issue;
  }
  return '';
}

export function contourMeshIds(workflow,before){
  const ids=new Set();
  for(const [step,commands] of Object.entries(workflow||{}).sort(([a],[b])=>Number(a)-Number(b))){
    if(Number(step)>=Number(before))break;
    const output=commands?.[contourKeyword]?.out_meshfile;
    if(typeof output==='string'&&output.trim()&&!isMeshPath(output))ids.add(output);
    if(commands?.ReadMesh?.elem_type==='Line'&&commands.ReadMesh.MeshID)ids.add(commands.ReadMesh.MeshID);
    if(commands?.RemoveMesh?.MeshID)ids.delete(commands.RemoveMesh.MeshID);
  }
  return [...ids];
}

export function contourFingerprint(doc,key){
  const prefix=Object.entries(doc.WorkFlow).filter(([step])=>Number(step)<=Number(key)).map(([step,commands])=>{
    if(step!==key)return [step,commands];
    const params={...commands[contourKeyword]};
    delete params.out_meshfile;
    return [step,{...commands,[contourKeyword]:params}];
  });
  return stringifyNumericJson([doc.Setup,prefix]);
}

export function contourPreviewWorkflow(doc,key,output){
  const preview=cloneNumericJson(doc);
  for(const [step,commands] of Object.entries(preview.WorkFlow)){
    if(Number(step)>Number(key)){delete preview.WorkFlow[step];continue;}
    delete commands.Export;
    delete commands.ExportMeshID;
    if(!Object.keys(commands).length)delete preview.WorkFlow[step];
  }
  preview.WorkFlow[key][contourKeyword].out_meshfile=output;
  preview.PostProcess={...preview.PostProcess,CombineMeshes:false,RemoveIsolatedParts:false};
  delete preview.ArtGUI;
  return preview;
}

export function contourResults(file,heights){
  const value=JSON.parse(file);
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid contour preview file.');
  const results=new Map();
  for(const [height,slice] of Object.entries(value)){
    const z=Number(height);
    if(!Number.isFinite(z)||!slice?.polygons||typeof slice.polygons!=='object')throw Error('Invalid contour preview slice.');
    const paths=Object.values(slice.polygons).map(path=>{
      const vertices=path?.vertices;
      if(!Array.isArray(vertices)||vertices.length<2||vertices.some(point=>!Array.isArray(point)||point.length!==3||!point.every(Number.isFinite)))
        throw Error('Invalid contour preview path.');
      return vertices;
    });
    results.set(z,paths);
  }
  if(heights.some(z=>!results.has(z)))throw Error('The preview is missing a requested slice.');
  return results;
}
