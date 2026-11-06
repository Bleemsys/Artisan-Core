import * as THREE from './vendor/three.module.js';
import {setNumber} from './numeric-json.js';
import {geometryError} from './region-model.js';

export const spatialKeywords=['Add_Geometry','Subtract_Geometry','Intersect_Geometry','Proc_BoxSlices','HS_Interpolate','Lin_Interpolate','Add_Attractor','Add_Lattice'];
const V=a=>new THREE.Vector3(...a), Z=new THREE.Vector3(0,0,1);
const vec=a=>Array.isArray(a)&&a.length===3&&a.every(Number.isFinite);
const positive=a=>vec(a)&&a.every(x=>x>0);
const floats=a=>{const b=[];a.forEach((v,i)=>setNumber(b,i,v,'float'));return b;};
const put=(o,k,v)=>{if(Array.isArray(v))o[k]=floats(v);else setNumber(o,k,v,'float');};
export function axisQuaternion(g){return new THREE.Quaternion().setFromAxisAngle(V(g.rotation_axis||[0,0,1]).normalize(),(g.rotation_degrees||0)*Math.PI/180);}
export function quaternionGeometry(q){q=q.clone().normalize();if(q.w<0)q.set(-q.x,-q.y,-q.z,-q.w);const s=Math.hypot(q.x,q.y,q.z);return {rotation_axis:s>1e-10?[q.x/s,q.y/s,q.z/s]:[0,0,1],rotation_degrees:2*Math.atan2(s,q.w)*180/Math.PI};}

// Legacy primitive boxes use +Z alignment then a spin about the normal.
// Their native parallel/antiparallel special case is identity; BoxSlices uses Rx(pi).
export function normalFrame(normal,angle=0,slices=false){
 const n=V(normal).normalize(),cross=Z.clone().cross(n),base=new THREE.Quaternion();
 if(cross.length()>(slices?1e-12:1e-6))base.setFromUnitVectors(Z,n);
 else if(slices&&n.z<0)base.setFromAxisAngle(new THREE.Vector3(1,0,0),Math.PI);
 return new THREE.Quaternion().setFromAxisAngle(n,angle).multiply(base).normalize();
}
function encodeFrame(q,slices){
 q=q.clone().normalize();let n=Z.clone().applyQuaternion(q);
 // Flipping local Y and Z leaves a centred box unchanged and avoids the native
 // antiparallel ambiguity for legacy geometry primitives.
 if(!slices&&Math.hypot(n.x,n.y)<=1e-6&&n.z<0){q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),Math.PI));n=Z.clone().applyQuaternion(q);}
 const base=normalFrame(n.toArray(),0,slices),rel=base.clone().invert().multiply(q),x=new THREE.Vector3(1,0,0).applyQuaternion(rel);
 return {normal:n.toArray(),z_angle:((Math.atan2(x.y,x.x)%(2*Math.PI))+2*Math.PI)%(2*Math.PI)};
}
function box(p,slices=false){
 if(!vec(p?.ori)||!positive(p?.length)||!vec(p.normal||[0,0,1])||V(p.normal||[0,0,1]).lengthSq()===0||!Number.isFinite(p.z_angle??0))throw Error('Box needs a finite center, positive half-lengths and a nonzero normal.');
 return {type:'Box',center:[...p.ori],size:p.length.map(x=>x*2),...quaternionGeometry(normalFrame(p.normal||[0,0,1],Math.min(2*Math.PI,Math.max(0,p.z_angle||0)),slices))};
}
function primitive(name,p){
 if(name==='Box')return box(p);
 if(name==='Sphere')return {type:'Sphere',center:p?.ori,radius:p?.r};
 if(name==='Cylinder'){
  if(!vec(p?.pa)||!vec(p?.pb))throw Error('Cylinder needs two finite endpoints.');const a=V(p.pa),b=V(p.pb),axis=b.clone().sub(a),height=axis.length();
  return {type:'Cylinder',center:a.add(b).multiplyScalar(.5).toArray(),axis:height?axis.divideScalar(height).toArray():[0,0,0],height,radius:p.r};
 }
}
export function spatialTargets(keyword,p,{domain,meshBounds}={}){
 const targets=[],messages=[];
 const add=(id,label,read,extra={})=>{try{const geometry=read(),error=geometryError(geometry);if(error)throw Error(error);targets.push({id,label,geometry,modes:geometry.type==='Sphere'?['move','resize']:['move','resize','rotate'],...extra});}catch(e){messages.push({id,message:e.message});}};
 if(['Add_Geometry','Subtract_Geometry','Intersect_Geometry'].includes(keyword)){
  if(p.Source){messages.push({message:'This operation references an existing field. Edit its defining step to change the geometry.'});}
  else if(['Box','Cylinder','Sphere'].includes(p.Name))add('geometry',p.Name,()=>primitive(p.Name,p.Paras));
  else if(typeof p.Name==='string'&&p.Name.trim()){
   const bounds=meshBounds?.(p.Name);
   if(!bounds)messages.push({message:'Load the source mesh preview to enable movement, rotation and scaling.'});
   else add('mesh',p.Name,()=>{
    const scale=p.Paras?.Scale||[1,1,1],trans=p.Paras?.Trans||[0,0,0],rot=p.Paras?.Rot||[0,0,0];
    if(!positive(scale)||!vec(trans)||!vec(rot))throw Error('Mesh handles require positive scales and finite translation and rotation values.');
    const size=bounds[1].map((x,i)=>(x-bounds[0][i])*scale[i]);if(size.some(x=>x<=0))throw Error('Mesh handles require a nonzero extent on every axis.');
    return {type:'Box',center:size.map((s,i)=>bounds[0][i]+s/2+trans[i]),size,...quaternionGeometry(new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot,'XYZ')))};
   },{kind:'mesh',source:p.Name,bounds});
  }else messages.push({message:'Choose a geometry preset or enter its Name and Paras below.'});
 }
 if(keyword==='Proc_BoxSlices'){
  if(!Array.isArray(p.Boxes)||!p.Boxes.length)messages.push({message:'Add a slice box to start editing.'});
  (Array.isArray(p.Boxes)?p.Boxes:[]).forEach((b,i)=>add('slice:'+i,b?.FieldID||`Slice ${i+1}`,()=>box(b,true),{slice:i}));
 }
 if(keyword==='Add_Lattice')add('lattice','Lattice frame',()=>{
  if(!positive(p.size)||!vec(p.Rot)||!vec(p.Trans))throw Error('Enter positive cell dimensions and finite placement coordinates.');
  return {type:'Box',center:[...p.Trans],size:[...p.size],...quaternionGeometry(new THREE.Quaternion().setFromEuler(new THREE.Euler(...p.Rot,'XYZ')))};
 },{kind:'lattice',modes:['move','rotate']});
 const plane=(point,normal,id,label)=>add(id,label,()=>{
  if(!vec(p[point])||!vec(p[normal])||!V(p[normal]).lengthSq())throw Error('Plane needs a finite point and a nonzero normal.');
  const span=Math.max(1,...(domain||[]).filter(a=>Array.isArray(a)&&a.length===2&&a.every(Number.isFinite)).map(a=>Math.abs(a[1]-a[0])))*.5;
  return {type:'Box',center:[...p[point]],size:[span,span,Math.max(1e-5,span*.002)],...quaternionGeometry(normalFrame(p[normal],0,true))};
 },{kind:'plane',point,normal,modes:['move','rotate']});
 if(keyword==='HS_Interpolate')plane('pt','n_vec','plane','Transition plane');
 if(keyword==='Lin_Interpolate'){plane('pt_01','n_vec_01','plane:1','Transition plane 1');plane('pt_02','n_vec_02','plane:2','Transition plane 2');}
 if(keyword==='Add_Attractor')add('attractor','Attractor influence',()=>({type:'Sphere',center:p.pt,radius:p.r}),{kind:'attractor'});
 return {targets,messages};
}

export function applySpatialGeometry(keyword,p,target,g,mode){
 const error=geometryError(g);if(error)throw Error(error);
 if(!target.modes.includes(mode))throw Error('This tool is unavailable for the selected target.');
 if(target.kind==='plane'){
  if(mode==='move')put(p,target.point,g.center);
  else put(p,target.normal,Z.clone().applyQuaternion(axisQuaternion(g)).multiplyScalar(V(p[target.normal]).length()).toArray());return;
 }
 if(target.kind==='lattice'){if(mode==='move')put(p,'Trans',g.center);else{const e=new THREE.Euler().setFromQuaternion(axisQuaternion(g),'XYZ');put(p,'Rot',[e.x,e.y,e.z]);}return;}
 if(target.kind==='attractor'){if(mode==='move')put(p,'pt',g.center);else put(p,'r',g.radius);return;}
 if(target.kind==='mesh'){
  const a=p.Paras ||= {},min=target.bounds[0],extent=target.bounds[1].map((x,i)=>x-min[i]);
  if(mode==='resize')put(a,'Scale',g.size.map((x,i)=>x/extent[i]));
  if(mode==='move'||mode==='resize')put(a,'Trans',g.center.map((x,i)=>x-min[i]-g.size[i]/2));
  if(mode==='rotate'){const e=new THREE.Euler().setFromQuaternion(axisQuaternion(g),'XYZ');put(a,'Rot',[e.x,e.y,e.z]);}return;
 }
 const a=target.slice!==undefined?p.Boxes[target.slice]:p.Paras;
 if(g.type==='Box'){
  if(mode==='move'||mode==='resize')put(a,'ori',g.center);
  if(mode==='resize')put(a,'length',g.size.map(x=>x/2));
  if(mode==='rotate'){const frame=encodeFrame(axisQuaternion(g),target.slice!==undefined);put(a,'normal',frame.normal);put(a,'z_angle',frame.z_angle);}
 }
 if(g.type==='Sphere'){if(mode==='move')put(a,'ori',g.center);else put(a,'r',g.radius);}
 if(g.type==='Cylinder'){
  const axis=V(g.axis).normalize().multiplyScalar(g.height/2);put(a,'pa',V(g.center).sub(axis).toArray());put(a,'pb',V(g.center).add(axis).toArray());
  if(mode==='resize')put(a,'r',g.radius);
 }
}
export function newSpatialBox(domain){
 const d=Array.isArray(domain)&&domain.length===3&&domain.every(a=>Array.isArray(a)&&a.length===2&&a.every(Number.isFinite)&&a[1]>a[0])?domain:[[-40,40],[-40,40],[-40,40]];
 const b={ori:floats(d.map(a=>(a[0]+a[1])/2)),normal:floats([0,0,1]),length:floats(d.map(a=>(a[1]-a[0])/8))};put(b,'z_angle',0);return b;
}
export function replaceSpatialShape(p,type,domain){
 const b=newSpatialBox(domain);delete p.Source;p.Name=type;
 p.Paras=type==='Box'?b:type==='Sphere'?{ori:b.ori}:{pa:floats(b.ori.map((x,i)=>x-(i===2?b.length[2]:0))),pb:floats(b.ori.map((x,i)=>x+(i===2?b.length[2]:0)))};if(type!=='Box')put(p.Paras,'r',b.length[0]);
 return p;
}
