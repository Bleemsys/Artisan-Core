import {cloneNumericJson} from './numeric-json.js';
import {spatialTargets} from './spatial-model.js';

export const geometryKeywords=['Add_Geometry','Subtract_Geometry','Intersect_Geometry'];
export const primitiveShapes=['Box','Sphere','Cylinder'];
export const geometryCopy={
 Add_Geometry:{label:'Add',title:'Add geometry',shape:'Define added shape',help:'Combine this shape with the current field.'},
 Subtract_Geometry:{label:'Subtract',title:'Subtract geometry',shape:'Define cutting shape',help:'Remove this shape from the current field.'},
 Intersect_Geometry:{label:'Intersect',title:'Intersect geometry',shape:'Define overlap shape',help:'Keep only the overlap with this shape.'},
};
export const geometrySource=p=>p.Source?'Field':primitiveShapes.includes(p.Name)?'Primitive':'Mesh';
export function geometryOperationError(p){
 if(!p||typeof p!=='object')return 'Choose a geometry source.';
 if(p.k_factor!==undefined&&(!Number.isFinite(p.k_factor)||p.k_factor<0))return 'Smoothing factor must be zero or positive.';
 if(p.push2GeomField!==undefined&&typeof p.push2GeomField!=='boolean')return 'Choose lattice field or geometry field.';
 if(p.Source)return '';
 if(typeof p.Name!=='string'||!p.Name.trim())return 'Choose a mesh or a primitive shape.';
 if(primitiveShapes.includes(p.Name))return spatialTargets('Add_Geometry',p).messages[0]?.message||'';
 const a=p.Paras||{};
 for(const k of ['Scale','Trans','Rot'])if(a[k]!==undefined&&(!Array.isArray(a[k])||a[k].length!==3||!a[k].every(Number.isFinite)))return 'Mesh transforms require three finite numbers.';
 if(a.Scale?.some(n=>n===0))return 'Mesh scale cannot be zero.';
 return '';
}
export function geometryWorkflowError(workflow){
 for(const [key,step] of Object.entries(workflow||{}))for(const keyword of geometryKeywords)if(step[keyword]){
  const error=geometryOperationError(step[keyword]);if(error)return `Step ${key}: ${error}`;
 }
 return '';
}
export function geometryPreviewWorkflow(doc,key,keyword,output){
 if(!geometryKeywords.includes(keyword)||!doc.WorkFlow[key]?.[keyword])throw Error('This geometry operation is no longer in the workflow.');
 const copy=cloneNumericJson(doc),steps=[];
 for(const k of Object.keys(copy.WorkFlow).sort((a,b)=>Number(a)-Number(b))){
  if(Number(k)>Number(key))break;
  const commands=Object.fromEntries(Object.entries(copy.WorkFlow[k]).filter(([name])=>!['Export','ExportMeshID'].includes(name)));
  if(Object.keys(commands).length)steps.push(commands);
 }
 const issue=geometryWorkflowError(Object.fromEntries(steps.map((s,i)=>[String(i+1),s])));if(issue)throw Error(issue);
 steps.push({Export:{outfile:output}});copy.WorkFlow=Object.fromEntries(steps.map((s,i)=>[String(i+1),s]));delete copy.ArtGUI;
 return copy;
}
