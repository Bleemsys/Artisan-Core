import {cloneNumericJson,parseNumericJson} from './numeric-json.js';
import {geometryBounds,geometryError,newPrimitiveRegion,scalarWorkflowError} from './region-model.js';

export const morphKeyword='Proc_Field_Morph';
export const morphDefaults={input_field:'lattice',output_field:'lattice',fixed_mask:'',mask_threshold:.5,max_control_points:256,support_radius:0,max_gradient:.95,inverse_tolerance:1e-6,inverse_iterations:50,stages:1,max_grid_points:10000000,quality_report:''};
export const motionDefaults={translation:[0,0,0],rotation_axis:[0,0,1],rotation_degrees:0,rotation_center:[0,0,0]};
export const newMotion=(mask='')=>({...parseNumericJson('{"translation":[0.0,0.0,0.0],"rotation_axis":[0.0,0.0,1.0],"rotation_degrees":0.0,"rotation_center":[0.0,0.0,0.0]}'),mask});
export const newMorph=()=>({...cloneNumericJson(morphDefaults),domain_mask:'',moving_regions:[newMotion()]});
export const effectiveMotion=r=>({...motionDefaults,...r});
const vector=v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite);
const name=v=>typeof v==='string'&&v.trim()&&!v.includes('\0');
export function morphError(raw){
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return 'Morph parameters must be an object.';
  if(Object.keys(raw).some(k=>!Object.hasOwn(morphDefaults,k)&&!['domain_mask','moving_regions'].includes(k)))return 'Unsupported morph parameter. Review Workflow JSON.';
  const p={...morphDefaults,...raw};
  if(!name(p.input_field)||!name(p.output_field))return 'Enter input and output field names.';
  if(/[\\/:]/.test(p.output_field)||/\.(json|csv|h5|hdf5)$/i.test(p.output_field))return 'Output must be a field name or lattice, not a filename.';
  if(!name(p.domain_mask)||p.domain_mask==='lattice')return 'Choose a named domain mask.';
  if(typeof p.fixed_mask!=='string'||p.fixed_mask.includes('\0')||p.fixed_mask==='lattice')return 'Fixed mask must be a named field, or empty for none.';
  if(p.fixed_mask&&p.fixed_mask===p.domain_mask)return 'Domain and fixed masks must select different regions.';
  if(!Array.isArray(p.moving_regions)||!p.moving_regions.length)return 'Add at least one moving region.';
  const used=new Set([p.domain_mask,p.fixed_mask].filter(Boolean));
  for(const [i,rawRegion] of p.moving_regions.entries()){
    if(!rawRegion||typeof rawRegion!=='object'||Array.isArray(rawRegion))return `Moving region ${i+1}: invalid region.`;
    if(Object.keys(rawRegion).some(k=>k!=='mask'&&!Object.hasOwn(motionDefaults,k)))return `Moving region ${i+1}: unsupported parameter.`;
    const r=effectiveMotion(rawRegion);
    if(!name(r.mask)||r.mask==='lattice')return `Moving region ${i+1}: choose a named mask.`;
    if(used.has(r.mask))return `Moving region ${i+1}: each moving mask must differ from the domain, fixed and other moving masks.`;
    used.add(r.mask);
    if(!vector(r.translation)||!vector(r.rotation_center))return `Moving region ${i+1}: translation and rotation center need three finite coordinates.`;
    if(!vector(r.rotation_axis)||Math.hypot(...r.rotation_axis)===0)return `Moving region ${i+1}: rotation axis cannot be zero.`;
    if(!Number.isFinite(r.rotation_degrees))return `Moving region ${i+1}: rotation angle must be finite.`;
  }
  if(used.has(p.output_field))return 'Output must not overwrite a selection mask.';
  const limits={mask_threshold:[0,1,true],max_control_points:[16,2048,false,true],support_radius:[0,Infinity],max_gradient:[0,.99,true],inverse_tolerance:[0,Infinity,true],inverse_iterations:[1,1000,false,true],stages:[1,Infinity,false,true],max_grid_points:[27,Infinity,false,true]};
  for(const [key,[min,max,exclusive,integer]] of Object.entries(limits))if(!Number.isFinite(p[key])||(exclusive?p[key]<=min:p[key]<min)||p[key]>max||(integer&&!Number.isInteger(p[key])))return `${key} must be ${integer?'an integer':'a number'} ${exclusive?'greater than':'at least'} ${min}${Number.isFinite(max)?` and at most ${max}`:''}.`;
  if(typeof p.quality_report!=='string'||p.quality_report.includes('\0')||(p.quality_report&&!/\.json$/i.test(p.quality_report)))return 'Quality report must be empty or a .json filename.';
  return '';
}
export function morphWorkflowError(workflow){for(const [key,step] of Object.entries(workflow||{}))if(step?.[morphKeyword]){const error=morphError(step[morphKeyword]);if(error)return `Step ${key}: ${error}`;}return '';}

// Suggestions are ordered by workflow position. Unknown names remain editable: a
// ReadGridField or another operation may supply fields only known at run time.
export function upstreamFields(workflow,before){
  const fields=new Map();
  for(const key of Object.keys(workflow||{}).sort((a,b)=>Number(a)-Number(b))){
    if(Number(key)>=Number(before))break;
    for(const [keyword,p] of Object.entries(workflow[key])){
      const id=keyword==='Define_ScalarField_CombineGeometry'?p.field_id:keyword==='OP_GeomSDF_GridField'?p.out_gridfieldFile:keyword===morphKeyword?(p.output_field||'lattice'):null;
      if(name(id)&&id!=='lattice')fields.set(id,{id,key,keyword,params:p,regions:keyword==='Define_ScalarField_CombineGeometry'?p.regions:null});
    }
  }
  return [...fields.values()];
}
export function resolveMask(workflow,before,id){return upstreamFields(workflow,before).find(f=>f.id===id)||null;}
export function maskRegions(workflow,before,id){const regions=resolveMask(workflow,before,id)?.regions;return Array.isArray(regions)?regions:[];}
export function transformPoint(point,raw){
  const r=effectiveMotion(raw),norm=Math.hypot(...r.rotation_axis);if(!norm)return point.slice();
  const a=r.rotation_axis.map(v=>v/norm),v=point.map((x,i)=>x-r.rotation_center[i]),angle=r.rotation_degrees*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle),dot=a.reduce((n,x,i)=>n+x*v[i],0),cross=[a[1]*v[2]-a[2]*v[1],a[2]*v[0]-a[0]*v[2],a[0]*v[1]-a[1]*v[0]];
  return v.map((x,i)=>r.rotation_center[i]+x*c+cross[i]*s+a[i]*dot*(1-c)+r.translation[i]);
}
export function regionsCenter(regions){
  const boxes=regions.map(r=>geometryBounds(r?.geometry)).filter(Boolean);if(!boxes.length)return null;
  return [0,1,2].map(i=>(Math.min(...boxes.map(b=>b[0][i]))+Math.max(...boxes.map(b=>b[1][i])))/2);
}
export function morphWarnings(p,workflow,key,setup){
  if(morphError(p))return [];
  const warnings=[],ids=[p.domain_mask,p.fixed_mask,...p.moving_regions.map(r=>r.mask)].filter(Boolean);
  for(const id of ids){const source=resolveMask(workflow,key,id);
    if(!source){warnings.push(`${id}: no earlier geometry-mask definition found. Artisan must load or compute it before this step.`);continue;}
    const s=source.params;if(source.regions&&(s.default_value<0||s.default_value>1||source.regions.some(r=>r.value<0||r.value>1)))warnings.push(`${id}: morph masks must contain values between 0 and 1.`);
  }
  const domain=setup?.Type==='Sample'?setup.Sample?.Domain:null;
  if(domain?.length===3)for(const r of p.moving_regions){
    const boxes=maskRegions(workflow,key,r.mask).map(s=>geometryBounds(s?.geometry,s.transition_width||0)).filter(Boolean);
    const outside=boxes.some(b=>[0,1,2,3,4,5,6,7].some(n=>transformPoint([0,1,2].map(i=>b[(n>>i)&1][i]),r).some((x,i)=>x<domain[i][0]||x>domain[i][1])));
    if(outside)warnings.push(`${r.mask}: target bounds may extend beyond the sampling box. Increase the sampling bounds or reduce movement.`);
  }
  return warnings;
}
export function newMaskDefinition(role,setup,workflow){
  const ids=new Set(Object.values(workflow).flatMap(s=>Object.values(s).flatMap(p=>[p?.field_id,p?.out_gridfieldFile,p?.output_field].filter(Boolean))));
  const base=role==='domain_mask'?'MorphDomain':role==='fixed_mask'?'FixedRegion':'MovingRegion';let id=base,n=2;while(ids.has(id))id=base+n++;
  const region=newPrimitiveRegion('Box',setup?.Sample?.Domain);region.name=id;
  const d=setup?.Type==='Sample'?setup.Sample?.Domain:null;
  if(d?.length===3&&d.every(p=>p.length===2&&p.every(Number.isFinite)&&p[1]>p[0])){
    const spans=d.map(p=>p[1]-p[0]);region.geometry.center=d.map(p=>(p[0]+p[1])/2);
    region.geometry.size=spans.map((v,i)=>v*(role==='domain_mask'?.85:i===2?.12:.35));
    if(role!=='domain_mask')region.geometry.center[2]+=spans[2]*(role==='fixed_mask'?-.25:.25);
  }
  return {field_id:id,default_value:0,overlap:'Maximum',regions:[region]};
}
export function morphPreviewWorkflow(doc,key,output,{surface=false}={}){
  const original=doc.WorkFlow[key]?.[morphKeyword];if(!original)throw Error('Select a morph operation first.');
  if(!/\.(h5|hdf5)$/i.test(output))throw Error('Choose an HDF5 preview filename.');
  const copy=cloneNumericJson(doc),steps=[];
  for(const k of Object.keys(copy.WorkFlow).sort((a,b)=>Number(a)-Number(b))){if(Number(k)>Number(key))break;const commands=Object.fromEntries(Object.entries(copy.WorkFlow[k]).filter(([op])=>op!=='Export'));if(Object.keys(commands).length)steps.push(commands);}
  const workflow=Object.fromEntries(steps.map((s,i)=>[String(i+1),s])),error=scalarWorkflowError(workflow)||morphWorkflowError(workflow);if(error)throw Error(error);
  const params=steps.findLast(s=>s[morphKeyword])?.[morphKeyword],prefix=output.replace(/\.(h5|hdf5)$/i,''),report=prefix+'-quality.json',field=original.output_field??'lattice';params.quality_report=report;
  const ids=[...new Set([field,original.input_field??'lattice',original.domain_mask,original.fixed_mask,...original.moving_regions.map(r=>r.mask)].filter(v=>v&&v!=='lattice'))];
  const mesh=surface&&field==='lattice'?prefix+'.stl':null;
  steps.push({Export:mesh?{outfile:mesh,fieldfile:output,GridFieldIDs:ids}:{outfile:output,GridFieldIDs:ids}});
  copy.WorkFlow=Object.fromEntries(steps.map((s,i)=>[String(i+1),s]));delete copy.ArtGUI;
  copy.PostProcess={...copy.PostProcess,CombineMeshes:!!mesh,RemoveIsolatedParts:false,RemovePartitionMeshFile:true};
  return {workflow:copy,report,mesh,field,output};
}
