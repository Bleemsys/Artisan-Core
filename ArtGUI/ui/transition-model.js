import {cloneNumericJson,setNumber} from './numeric-json.js';

export const transitionKeywords=['Lin_Interpolate','HS_Interpolate','Add_Attractor'];
export const transitionColours=['#3989ee','#ed6374'];
export const transitionKnown=['la_name','size','thk','Rot','Trans','Fill','Cube_Request','pt','r','pt_01','n_vec_01','pt_02','n_vec_02','n_vec','Inv'];
const vector=v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite);
export function transitionFieldError(key,p){
 if(['size','Rot','Trans','pt','pt_01','pt_02','n_vec','n_vec_01','n_vec_02'].includes(key)){
  if(!vector(p[key]))return 'Enter three finite coordinates.';
  if(key==='size'&&p.size.some(n=>n<=0))return 'Cell size must contain three positive values.';
  if(key.startsWith('n_vec')&&!Math.hypot(...p[key]))return 'A plane normal cannot be zero.';
 }
 if(key==='thk'&&(!Number.isFinite(p.thk)||p.thk<0))return 'Thickness control must be zero or positive.';
 if(key==='r'&&!Number.isFinite(p.r))return 'Radius must be a finite number.';
 if(key==='la_name'&&(typeof p.la_name!=='string'||!p.la_name.trim()))return 'Choose a lattice name or definition file.';
 if(['Fill','Inv'].includes(key)&&typeof p[key]!=='boolean')return 'Choose a boolean option.';
 if(key==='Cube_Request'){
  const request=p.Cube_Request;if(!request||Array.isArray(request)||typeof request!=='object')return 'Advanced request must be a JSON object.';
  if(Object.keys(request).length&&(!Object.hasOwn(request,'ID')||request.ID===null||request.ID===''))return 'A configured advanced request requires ID.';
 }
 return '';
}
export function transitionError(keyword,p){
 const keys=['la_name','size','thk','Rot','Trans','Fill','Cube_Request',...(keyword==='Lin_Interpolate'?['pt_01','n_vec_01','pt_02','n_vec_02']:keyword==='HS_Interpolate'?['pt','n_vec']:['pt','r'])];
 for(const key of keys){const issue=transitionFieldError(key,p);if(issue)return issue;}
 if(keyword!=='HS_Interpolate'&&p.Inv!==undefined)return transitionFieldError('Inv',p);
 return '';
}
export function setTransitionNumber(p,path,text,{linked=false}={}){
 const [key,index]=path.split('.');
 if(index!==undefined){if(!vector(p[key]))p[key]=key==='size'?[1,1,1]:[0,0,0];for(const i of key==='size'&&linked?[0,1,2]:[Number(index)])setNumber(p[key],i,text,'float');}
 else setNumber(p,key,text,'float');
 const issue=key==='size'?(Number(text)>0?'':'Cell size must contain three positive values.'):transitionFieldError(key,p);if(issue)throw Error(issue);
}
export function setPlaneAxis(p,key,axis){
 if(!['X','Y','Z'].includes(axis))return;
 const magnitude=Math.hypot(...(p[key]||[]))||1;p[key] ||= [];
 for(let i=0;i<3;i++)setNumber(p[key],i,i==='XYZ'.indexOf(axis)?magnitude:0,'float');
}
export function flipPlane(p,key){if(!vector(p[key])||!Math.hypot(...p[key]))throw Error('A plane normal cannot be zero.');p[key].forEach((v,i)=>setNumber(p[key],i,-v,'float'));}
export function transitionWorkflowError(workflow){
 for(const [key,step] of Object.entries(workflow||{}))for(const keyword of transitionKeywords)if(step[keyword]){const issue=transitionError(keyword,step[keyword]);if(issue)return `Step ${key}: ${issue}`;}
 return '';
}
export function transitionPreviewWorkflow(doc,key,keyword,output){
 if(!transitionKeywords.includes(keyword)||!doc.WorkFlow?.[key]?.[keyword])throw Error('This transition is no longer in the workflow.');
 const copy=cloneNumericJson(doc),steps=[];
 for(const k of Object.keys(copy.WorkFlow).sort((a,b)=>Number(a)-Number(b))){if(Number(k)>Number(key))break;const commands=Object.fromEntries(Object.entries(copy.WorkFlow[k]).filter(([name])=>!['Export','ExportMeshID'].includes(name)));if(Object.keys(commands).length)steps.push(commands);}
 const issue=transitionWorkflowError(Object.fromEntries(steps.map((s,i)=>[String(i+1),s])));if(issue)throw Error(issue);
 steps.push({Export:{outfile:output}});copy.WorkFlow=Object.fromEntries(steps.map((s,i)=>[String(i+1),s]));delete copy.ArtGUI;return copy;
}
