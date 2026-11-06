import {cloneNumericJson,assignNumericJson,setNumber} from './numeric-json.js';
import {transitionFieldError} from './transition-model.js';
import {spatialTargets,applySpatialGeometry} from './spatial-model.js';

export const fieldMergeKeyword='OP_FieldMerge';
export const fieldMergeModes=['Linear','Attractor','Annulus','Field'];
export const fieldMergeKeys=['la_name','size','thk','Rot','Trans','Fill','Cube_Request','OP_para'];
const vector=v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite);
const text=v=>typeof v==='string'&&!!v.trim()&&!v.includes('\0');
const entries=w=>Object.entries(w||{}).sort(([a],[b])=>Number(a)-Number(b));
const floats=a=>{const b=[];a.forEach((v,i)=>setNumber(b,i,v,'float'));return b;};
const put=(o,k,v)=>{if(Array.isArray(v))o[k]=floats(v);else setNumber(o,k,v,'float');};
export const fieldMergeIsFile=v=>/[\\/]/.test(v||'')||/[.](csv|tsv|h5|hdf5)$/i.test(v||'');
export function earlierMergeFields(workflow,key){
  const fields=new Map();
  for(const [step,commands] of entries(workflow)){
    if(Number(step)>=Number(key))break;
    for(const [keyword,p] of Object.entries(commands||{})){
      const id=keyword==='ReadGridField'?p?.Gridfield_ID:keyword==='Define_ScalarField_CombineGeometry'?p?.field_id:keyword==='Proc_Field_Morph'?p?.output_field:keyword==='OP_GeomSDF_GridField'?p?.out_gridfieldFile:['OP_ExprOperation_GridField','OP_Fit_GridField'].includes(keyword)?p?.out_gridFieldFile:null;
      if(text(id)&&(!['OP_ExprOperation_GridField','OP_Fit_GridField','OP_GeomSDF_GridField'].includes(keyword)||!fieldMergeIsFile(id)))fields.set(id,{id,key:step,keyword});
    }
  }
  return [...fields.values()];
}
export function fieldMergeError(p,workflow,key){
  if(!p||typeof p!=='object'||Array.isArray(p))return 'Field merge parameters must be an object.';
  for(const k of fieldMergeKeys.filter(k=>k!=='OP_para')){const error=transitionFieldError(k,p);if(error)return error;}
  const q=p.OP_para;
  if(!q||typeof q!=='object'||Array.isArray(q))return 'Transition parameters must be an object.';
  if(!fieldMergeModes.includes(q.InterpType))return 'Choose a supported transition mode.';
  if(q.InterpType==='Linear'){
    for(const k of ['pt_01','n_vec_01','pt_02','n_vec_02']){const error=transitionFieldError(k,q);if(error)return error;}
    if(q.pt_01.every((x,i)=>x===q.pt_02[i]))return 'Start and end plane positions must be different.';
  }
  if(['Attractor','Annulus'].includes(q.InterpType)){
    if(!vector(q.pt_att))return 'Enter three finite center coordinates.';
    if(q.InterpType==='Attractor'&&(!Number.isFinite(q.pt_r)||q.pt_r<=0))return 'Radius must be greater than zero.';
    if(q.InterpType==='Annulus'&&(!Number.isFinite(q.inner_r)||!Number.isFinite(q.outer_r)||q.inner_r<0||q.outer_r<=q.inner_r))return 'Outer radius must exceed the nonnegative inner radius.';
  }
  if(q.InterpType==='Field'){
    if(!text(q.FieldFile))return 'Choose a field or a CSV file.';
    if(workflow&&!fieldMergeIsFile(q.FieldFile)&&!earlierMergeFields(workflow,key).some(f=>f.id===q.FieldFile))return 'Create or load this field before the merge step.';
    if(!Number.isFinite(q.min_cap)||!Number.isFinite(q.max_cap)||q.min_cap>=q.max_cap)return 'Upper threshold must be greater than lower threshold.';
  }
  if(!q.Transition||typeof q.Transition!=='object'||Array.isArray(q.Transition))return 'Bridge parameters must be an object.';
  if(Object.keys(q.Transition).length){
    for(const k of ['la_name','size','thk']){const error=transitionFieldError(k,q.Transition);if(error)return error;}
    if(!Number.isFinite(q.Transition.Weight)||!Number.isFinite(q.Transition.f_trans))return 'Bridge weight and rate must be finite numbers.';
  }
  return '';
}
export function fieldMergeWorkflowError(workflow){
  for(const [key,commands] of entries(workflow))if(commands?.[fieldMergeKeyword]){const error=fieldMergeError(commands[fieldMergeKeyword],workflow,key);if(error)return `Step ${key}: ${error}`;}
  return '';
}
export const fieldMergeFingerprint=(doc,key)=>JSON.stringify({Setup:doc.Setup,WorkFlow:entries(doc.WorkFlow).filter(([k])=>Number(k)<=Number(key))});
export function fieldMergeModeParameters(mode,domain){
  const d=Array.isArray(domain)&&domain.length===3&&domain.every(a=>Array.isArray(a)&&a.length===2&&a.every(Number.isFinite)&&a[1]>a[0])?domain:[[0,100],[0,100],[0,100]];
  const c=d.map(a=>(a[0]+a[1])/2),r=Math.max(...d.map(a=>a[1]-a[0]))/4;
  let q={InterpType:mode,Transition:{}};
  if(mode==='Linear')q={...q,pt_01:floats(c.map((v,i)=>i?v:d[0][0]+(d[0][1]-d[0][0])*.25)),pt_02:floats(c.map((v,i)=>i?v:d[0][0]+(d[0][1]-d[0][0])*.75)),n_vec_01:floats([1,0,0]),n_vec_02:floats([-1,0,0])};
  if(['Attractor','Annulus'].includes(mode))q.pt_att=floats(c);
  if(mode==='Attractor')put(q,'pt_r',r);
  if(mode==='Annulus'){put(q,'inner_r',r*.5);put(q,'outer_r',r);}
  if(mode==='Field'){q.FieldFile='';put(q,'min_cap',0);put(q,'max_cap',1);}
  return q;
}
export const fieldMergeModeKeys=['InterpType','pt_01','pt_02','n_vec_01','n_vec_02','pt_att','pt_r','inner_r','outer_r','FieldFile','min_cap','max_cap','Transition'];
export function switchFieldMergeMode(p,mode,cached,domain){
  if(!fieldMergeModes.includes(mode))throw Error('Choose a supported transition mode.');
  const old=p.OP_para&&typeof p.OP_para==='object'&&!Array.isArray(p.OP_para)?p.OP_para:{};
  const extra=Object.fromEntries(Object.entries(old).filter(([k])=>!fieldMergeModeKeys.includes(k)));
  p.OP_para=assignNumericJson({},cloneNumericJson(extra),cloneNumericJson(cached||fieldMergeModeParameters(mode,domain)),{InterpType:mode,Transition:cloneNumericJson(old.Transition||{})});
}
export function fieldMergeTargets(p,{domain}={}){
  const q=p?.OP_para;if(!q)return [];
  if(q.InterpType==='Linear')return spatialTargets('Lin_Interpolate',q,{domain}).targets.map((t,i)=>({...t,geometry:{...t.geometry,size:t.geometry.size.map((v,j)=>j<2?v*2:v)},label:i?'End plane':'Start plane',guideKind:'plane'}));
  if(q.InterpType==='Attractor'&&vector(q.pt_att)&&Number.isFinite(q.pt_r)&&q.pt_r>0)return [{id:'attractor',label:'Transition center',kind:'attractor',modes:['move','resize'],geometry:{type:'Sphere',center:[...q.pt_att],radius:q.pt_r}}];
  if(q.InterpType==='Annulus'&&vector(q.pt_att)&&Number.isFinite(q.inner_r)&&Number.isFinite(q.outer_r)&&q.inner_r>=0&&q.outer_r>q.inner_r)return [['inner_r','Inner radius','#35a787'],['outer_r','Outer radius','#2867d8']].map(([radius,label,colour])=>({id:radius,label,colour,radius,kind:'annulus',modes:['move','resize'],geometry:{type:'Sphere',center:[...q.pt_att],radius:Math.max(q[radius],1e-6)}}));
  return [];
}
export function applyFieldMergeGeometry(p,target,g,mode){
  const q=p.OP_para;
  if(target.kind==='plane'){applySpatialGeometry('Lin_Interpolate',q,target,g,mode);return;}
  if(target.kind==='lattice'){applySpatialGeometry('Add_Lattice',p,target,g,mode);return;}
  if(mode==='move')put(q,'pt_att',g.center);
  if(mode==='resize'){
    if(target.kind==='attractor')put(q,'pt_r',Math.max(g.radius,1e-6));
    else if(target.radius==='inner_r')put(q,'inner_r',Math.max(0,Math.min(g.radius,q.outer_r-Math.max(1e-6,q.outer_r*1e-8))));
    else put(q,'outer_r',Math.max(g.radius,q.inner_r+Math.max(1e-6,q.inner_r*1e-8)));
  }
}
export function fieldMergePreviewWorkflow(doc,key,output){
  if(!doc.WorkFlow?.[key]?.[fieldMergeKeyword])throw Error('This field merge step is no longer in the workflow.');
  const copy=cloneNumericJson(doc),prefix=entries(copy.WorkFlow).filter(([k])=>Number(k)<=Number(key)),steps=[];
  const reads=new Set(prefix.flatMap(([,s])=>s.ReadGridField?.inp_GridFieldFile?[s.ReadGridField.inp_GridFieldFile]:[]));
  for(const [,commands] of prefix){const keep={};for(const [name,p] of Object.entries(commands)){
    if(name==='ExportMeshID')continue;
    if(name==='Export'){const path=p.fieldfile||p.outfile;if(reads.has(path)&&p.GridFieldIDs?.length&&/[.](h5|hdf5)$/i.test(path||''))keep.Export={outfile:path,GridFieldIDs:cloneNumericJson(p.GridFieldIDs)};}
    else keep[name]=p;
  }if(Object.keys(keep).length)steps.push(keep);}
  const error=fieldMergeWorkflowError(Object.fromEntries(steps.map((s,i)=>[String(i+1),s])));if(error)throw Error(error);
  steps.push({Export:{outfile:output}});copy.WorkFlow=Object.fromEntries(steps.map((s,i)=>[String(i+1),s]));delete copy.ArtGUI;
  copy.PostProcess={...copy.PostProcess,CombineMeshes:false,RemovePartitionMeshFile:false,RemoveIsolatedParts:false};return copy;
}
