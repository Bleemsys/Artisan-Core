import {cloneNumericJson,stringifyNumericJson} from './numeric-json.js';
import {transitionFieldError} from './transition-model.js';
import {integratedGroups} from './lattice-schema.js';

export const latticeKnown=['la_name','size','thk','Rot','Trans','Fill','Inv','Cube_Request'];
export function latticeError(p){
 for(const key of latticeKnown){const error=transitionFieldError(key,p);if(error)return error;}
 return '';
}
export function latticeWorkflowError(workflow){
 for(const [key,step] of Object.entries(workflow||{}))if(step.Add_Lattice){const error=latticeError(step.Add_Lattice);if(error)return `Step ${key}: ${error}`;}
 return '';
}
export function latticeThicknessKind(name,definitionType){
 if(definitionType==='strut'||Object.entries(integratedGroups).some(([group,names])=>group.includes('strut')&&names.includes(name)))return 'strut';
 if(['TPMS','TPMS-Field'].includes(definitionType)||integratedGroups['Hex · TPMS'].includes(name))return 'TPMS';
 return 'other';
}
export function latticePreviewWorkflow(doc,key,output){
 if(!doc.WorkFlow?.[key]?.Add_Lattice)throw Error('This lattice operation is no longer in the workflow.');
 const copy=cloneNumericJson(doc),steps=[];
 for(const k of Object.keys(copy.WorkFlow).sort((a,b)=>Number(a)-Number(b))){
  if(Number(k)>Number(key))break;
  const commands=Object.fromEntries(Object.entries(copy.WorkFlow[k]).filter(([name])=>!['Export','ExportMeshID'].includes(name)));
  if(Object.keys(commands).length)steps.push(commands);
 }
 const workflow=Object.fromEntries(steps.map((step,i)=>[String(i+1),step]));
 const error=latticeWorkflowError(workflow);if(error)throw Error(error);
 steps.push({Export:{outfile:output}});copy.WorkFlow=Object.fromEntries(steps.map((step,i)=>[String(i+1),step]));delete copy.ArtGUI;return copy;
}
export function latticePreviewKey(doc,key){
 if(!doc.WorkFlow?.[key]?.Add_Lattice)return '';
 const prefix=latticePreviewWorkflow(doc,key,'');delete prefix.WorkFlow[String(Object.keys(prefix.WorkFlow).length)];
 return stringifyNumericJson(prefix);
}
