import {cloneNumericJson,setNumber} from './numeric-json.js';
import {geometryOperationError} from './geometry-model.js';
import {spatialTargets,applySpatialGeometry} from './spatial-model.js';

export const geometryFieldKeywords=['OP_GeomSDF_GridField','OP_FieldOffset_GeomField'];
export const geometryFieldTitles={OP_GeomSDF_GridField:'Geometry distance field',OP_FieldOffset_GeomField:'Geometry-driven offset'};
export const isDistanceField=k=>k===geometryFieldKeywords[0];
export function geometryFieldError(k,p){
  if(!p||typeof p!=='object'||Array.isArray(p))return 'Operation parameters must be an object.';
  if(isDistanceField(k))return !validText(p.inp_meshfile)?'Choose a source mesh.':!validText(p.out_gridfieldFile)?'Enter a field name / destination.':'';
  const shape=geometryOperationError(p);if(shape)return shape;
  if(!['min','max','min_val','max_val'].every(key=>Number.isFinite(p[key])))return 'Enter finite distance and offset values.';
  if(!Array.isArray(p.min_max_opt)||p.min_max_opt.length!==2||!p.min_max_opt.every(Number.isFinite))return 'Range options require two finite numbers.';
  if(p.min_max_opt.every(v=>v<=0)&&p.min>=p.max)return 'Distance A must be smaller than distance B.';
  return '';
}
const validText=v=>typeof v==='string'&&!!v.trim()&&!v.includes('\0');
export function geometryFieldWorkflowError(workflow){for(const [key,step] of Object.entries(workflow||{}))for(const k of geometryFieldKeywords)if(Object.hasOwn(step,k)){const e=geometryFieldError(k,step[k]);if(e)return `Step ${key}: ${e}`;}return '';}
export function geometryFieldFingerprint(doc,key){return JSON.stringify({Setup:doc.Setup,WorkFlow:Object.fromEntries(Object.entries(doc.WorkFlow).filter(([k])=>Number(k)<=Number(key))),definitions:doc.Lattices});}
export function influenceTarget(p,options){return spatialTargets('Add_Geometry',p,options);}
export function applyInfluenceGeometry(p,target,g){for(const mode of ['move','resize','rotate'])if(target.modes.includes(mode))applySpatialGeometry('Add_Geometry',p,target,g,mode);}
export function setGeometryFieldNumber(p,key,value){if(typeof value==='string'&&!value.trim())throw Error('Enter a finite number.');const n=Number(value);if(!Number.isFinite(n))throw Error('Enter a finite number.');setNumber(p,key,n,'float');}
export function geometryFieldPreviewWorkflow(doc,key,output){
  const step=doc.WorkFlow[key],keyword=geometryFieldKeywords.find(k=>step?.[k]);if(!keyword)throw Error('Select a geometry-field operation first.');
  const copy=cloneNumericJson(doc),steps=[];
  for(const k of Object.keys(copy.WorkFlow).sort((a,b)=>Number(a)-Number(b))){if(Number(k)>Number(key))break;const commands=Object.fromEntries(Object.entries(copy.WorkFlow[k]).filter(([name])=>!['Export','ExportMeshID'].includes(name)));if(Object.keys(commands).length)steps.push(commands);}
  const issue=geometryFieldWorkflowError(Object.fromEntries(steps.map((s,i)=>[String(i+1),s])));if(issue)throw Error(issue);
  steps.push({Export:{outfile:output,...(isDistanceField(keyword)?{GridFieldIDs:[step[keyword].out_gridfieldFile]}:{})}});
  copy.WorkFlow=Object.fromEntries(steps.map((s,i)=>[String(i+1),s]));delete copy.ArtGUI;
  copy.PostProcess={...copy.PostProcess,CombineMeshes:false,RemoveIsolatedParts:false};return {workflow:copy,field:isDistanceField(keyword)?step[keyword].out_gridfieldFile:'lattice'};
}
