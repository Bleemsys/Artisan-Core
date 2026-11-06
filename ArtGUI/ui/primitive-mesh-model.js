import {cloneNumericJson,assignNumericJson,setNumber,stringifyNumericJson} from './numeric-json.js';
import {normalFrame} from './spatial-model.js';
import * as THREE from './vendor/three.module.js';

export const primitiveMeshKeywords=['Gen_BoxMesh','Gen_CylindricalMesh','Gen_SphericalMesh','Gen_CappedConeMesh'];
export const primitiveMeshInfo={
  Gen_BoxMesh:{name:'Box mesh',shape:'Box',icon:'box',subtitle:'Structured Cartesian mesh',axes:['X','Y','Z'],geometry:['x_range','y_range','z_range']},
  Gen_CylindricalMesh:{name:'Cylinder mesh',shape:'Cylinder',icon:'cylinder',subtitle:'Structured radial mesh',axes:['R','Phi','Z'],geometry:['r_range','phi_range','Height']},
  Gen_CappedConeMesh:{name:'Capped cone mesh',shape:'Cone',icon:'cone',subtitle:'Structured tapered mesh',axes:['R','Phi','Z'],geometry:['r_range','phi_range','Height','r_bottom','UB_heightRatio','Preserve_thickness']},
  Gen_SphericalMesh:{name:'Sphere mesh',shape:'Sphere',icon:'globe',subtitle:'Structured spherical mesh',axes:['R','Phi','Theta'],geometry:['r_range','phi_range','theta_range']}
};
export const primitiveMeshKeys=['num_elem','ori','Normal','Mesh_file','x_range','y_range','z_range','z_angle','r_range','phi_range','theta_range','Height','r_bottom','UB_heightRatio','Preserve_thickness'];
export const isAxialPrimitive=keyword=>['Gen_CylindricalMesh','Gen_CappedConeMesh'].includes(keyword);
export function cappedConeRadius(p,r,z){
  const fraction=Math.max(0,(z/p.Height-p.UB_heightRatio)/(1-p.UB_heightRatio));
  const outer=p.r_range[1]+(p.r_bottom-p.r_range[1])*fraction;
  return p.Preserve_thickness?r+outer-p.r_range[1]:r*outer/p.r_range[1];
}
export function angleScale(path){return path==='UB_heightRatio'?100:path.startsWith('phi_range')?360:path.startsWith('theta_range')?180:path==='z_angle'?180/Math.PI:1;}
export function primitiveValue(p,path){return path.split('.').reduce((o,k)=>o?.[k],p);}
export function displayedPrimitiveValue(p,path){const value=primitiveValue(p,path);return Number.isFinite(value)?Number((value*angleScale(path)).toPrecision(12)):value;}
export function setPrimitiveNumber(p,path,value,{display=true}={}){
  const text=String(value).trim(),n=Number(text);
  if(!text||!Number.isFinite(n))throw Error('Enter a finite number.');
  const parts=path.split('.'),key=parts.pop();let parent=p;
  for(const part of parts){if(!parent[part]||typeof parent[part]!=='object')throw Error('This parameter is missing. Restore it in JSON first.');parent=parent[part];}
  setNumber(parent,key,display?n/angleScale(path):n,path.startsWith('num_elem.')?'integer':'float');
}
const vector=(v,n)=>Array.isArray(v)&&v.length===n&&v.every(Number.isFinite);
export function primitiveMeshError(keyword,p){
  if(!primitiveMeshInfo[keyword])return 'Unsupported primitive mesh command.';
  if(!p||typeof p!=='object')return 'Mesh parameters must be an object.';
  if(!vector(p.num_elem,3)||!p.num_elem.every(n=>Number.isSafeInteger(n)&&n>=1))return 'Mesh divisions must be three positive whole numbers.';
  if(!vector(p.ori,3))return 'Origin must contain three finite coordinates.';
  if(!vector(p.Normal,3)||Math.hypot(...p.Normal)===0)return 'Axis direction must contain three finite values and be nonzero.';
  if(typeof p.Mesh_file!=='string'||!p.Mesh_file.trim())return 'Enter an output mesh ID or file.';
  const ranges=keyword==='Gen_BoxMesh'?['x_range','y_range','z_range']:['r_range','phi_range',...(keyword==='Gen_SphericalMesh'?['theta_range']:[])];
  for(const key of ranges){
    if(!vector(p[key],2)||!(p[key][1]>p[key][0]))return `${key}: the maximum must be greater than the minimum.`;
    if(key==='r_range'&&p[key][0]<0)return 'The inner radius must be zero or greater.';
    if(['phi_range','theta_range'].includes(key)&&(p[key][0]<0||p[key][1]>1))return key==='phi_range'?'Phi must stay between 0° and 360°.':'Theta must stay between 0° and 180°.';
  }
  if(keyword==='Gen_BoxMesh'&&(!Number.isFinite(p.z_angle)||p.z_angle<0||p.z_angle>2*Math.PI+1e-12))return 'In-plane rotation must stay between 0° and 360°.';
  if(isAxialPrimitive(keyword)&&(!Number.isFinite(p.Height)||p.Height<=0))return 'Height must be greater than zero.';
  if(keyword==='Gen_CappedConeMesh'){
    if(!Number.isFinite(p.r_bottom)||p.r_bottom<0)return 'Bottom radius must be zero or greater.';
    if(!Number.isFinite(p.UB_heightRatio)||p.UB_heightRatio<0||p.UB_heightRatio>=1)return 'Taper start must be between 0% and less than 100%. Use Cylinder for 100%.';
    if(typeof p.Preserve_thickness!=='boolean')return 'Preserve wall thickness must be on or off.';
    if(p.Preserve_thickness&&p.r_bottom<p.r_range[1]-p.r_range[0])return 'Bottom radius must be at least the wall thickness when preserving thickness.';
  }
  return '';
}
export function primitiveMeshWorkflowError(workflow){
  for(const [step,commands] of Object.entries(workflow||{}))for(const keyword of primitiveMeshKeywords)if(commands?.[keyword]){
    const error=primitiveMeshError(keyword,commands[keyword]);if(error)return `Step ${step}: ${error}`;
  }
  return '';
}
export function primitiveMeshFrame(keyword,p){return normalFrame(p.Normal,keyword==='Gen_BoxMesh'?p.z_angle:0);}
export function primitiveMeshOrigin(keyword,p){return new THREE.Vector3(...p.ori).applyQuaternion(primitiveMeshFrame(keyword,p));}
export function primitiveMeshPoint(keyword,p,coordinates){
  let point;
  if(keyword==='Gen_BoxMesh')point=new THREE.Vector3(...coordinates);
  else if(isAxialPrimitive(keyword)){
    let [r,phi,z]=coordinates;if(keyword==='Gen_CappedConeMesh')r=cappedConeRadius(p,r,z);point=new THREE.Vector3(r*Math.cos(phi),r*Math.sin(phi),z);
  }else{
    const [r,phi,theta]=coordinates;point=new THREE.Vector3(r*Math.sin(theta)*Math.cos(phi),r*Math.sin(theta)*Math.sin(phi),r*Math.cos(theta));
  }
  return point.add(new THREE.Vector3(...p.ori)).applyQuaternion(primitiveMeshFrame(keyword,p));
}
export function primitiveMeshRanges(keyword,p){
  return keyword==='Gen_BoxMesh'?[p.x_range,p.y_range,p.z_range]:[p.r_range,p.phi_range.map(n=>n*2*Math.PI),isAxialPrimitive(keyword)?[0,p.Height]:p.theta_range.map(n=>n*Math.PI)];
}
export function replacePrimitiveMesh(keyword,next,p){
  const result=cloneNumericJson(p),common=['num_elem','ori','Normal','Mesh_file'];
  for(const key of primitiveMeshKeys)if(!common.includes(key))delete result[key];
  const additions=next==='Gen_BoxMesh'?{x_range:[0,60],y_range:[0,40],z_range:[0,30],z_angle:0}:next==='Gen_CylindricalMesh'?{r_range:[10,20],phi_range:[0,.75],Height:40}:next==='Gen_CappedConeMesh'?{r_range:[10,20],phi_range:[0,.75],Height:40,r_bottom:10,UB_heightRatio:.3,Preserve_thickness:false}:{r_range:[10,20],phi_range:[0,.75],theta_range:[1/6,5/6]};
  if(keyword!=='Gen_BoxMesh'&&next!=='Gen_BoxMesh')for(const key of ['r_range','phi_range'])additions[key]=cloneNumericJson(p[key]);
  if(isAxialPrimitive(keyword)&&isAxialPrimitive(next))additions.Height=p.Height;
  assignNumericJson(result,additions);
  for(const key of Object.keys(additions)){if(Array.isArray(result[key]))result[key].forEach((n,i)=>setNumber(result[key],i,n,'float'));else if(typeof result[key]==='number')setNumber(result,key,result[key],'float');}
  return result;
}
export function restorePrimitiveMesh(target,snapshot){for(const key of Object.keys(target))delete target[key];assignNumericJson(target,cloneNumericJson(snapshot));}
export const primitiveMeshFingerprint=(keyword,p)=>keyword+':'+stringifyNumericJson(p,0);
export function primitiveMeshPreviewWorkflow(doc,key,output){
  const result=cloneNumericJson(doc),keys=Object.keys(result.WorkFlow).sort((a,b)=>Number(a)-Number(b)),at=keys.indexOf(String(key));
  if(at<0)throw Error('This meshing step is no longer in the workflow.');
  const keyword=primitiveMeshKeywords.find(k=>result.WorkFlow[key][k]);
  if(!keyword)throw Error('Select a primitive mesh step.');
  for(const later of keys.slice(at+1))delete result.WorkFlow[later];
  result.WorkFlow[key][keyword].Mesh_file=output;
  return result;
}
