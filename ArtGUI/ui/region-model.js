import {cloneNumericJson, parseNumericJson, setNumber} from './numeric-json.js';

export const regionTypes=['Box','Cylinder','Sphere','Mesh'];
export const scalarFieldMethods=['Minimum','Maximum','Linear','Smoothstep','InverseDistance'];
export const isScalarInterpolation=method=>['Linear','Smoothstep','InverseDistance'].includes(method);
export const scalarMethodHelp=method=>({
  Minimum:'Lowest value wins, including the background. For a mask use 0 background, 1 inside and Maximum.',
  Maximum:'Highest value wins, including the background. For a mask use 0 background, 1 inside and Maximum.',
  Linear:'Uses relative surface distances to fill the surrounding 3D space. Requires at least two separate regions.',
  Smoothstep:'Uses a smoothstep distance blend with gentle joins to regional values. Requires exactly two separate regions.',
  InverseDistance:'Blends regional values using inverse surface distances. Requires at least two separate regions; higher power gives nearby regions more influence.',
}[method]||'Choose a supported combination method.');
export function changeScalarMethod(params,method){
  if(!scalarFieldMethods.includes(method))throw Error('Choose a supported combination method.');
  params.overlap=method;
  if(method==='InverseDistance'){
    if(params.distance_power===undefined)setNumber(params,'distance_power',1,'float');
  }else delete params.distance_power;
}
export const regionColours=['#0798b7','#9c52db','#ed8b23','#389462','#c65a78','#527bdd'];
export const geometryType=g=>typeof g==='string'?'Mesh':g?.type;
export const meshSource=g=>typeof g==='string'?g:g?.source||'';
const vector=v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite);
export const unit=v=>{const n=Math.hypot(...v);return v.map(x=>x/n);};
export function geometryError(g){
  if(typeof g==='string')return g.trim()?'':'Choose a mesh file or enter a mesh ID.';
  if(!g||!regionTypes.includes(g.type))return 'Choose Box, Cylinder, Sphere or Mesh.';
  const keys={Box:['type','center','size','rotation_axis','rotation_degrees'],Cylinder:['type','center','axis','radius','height'],Sphere:['type','center','radius'],Mesh:['type','source']}[g.type];
  if(Object.keys(g).some(k=>!keys.includes(k)))return 'Unsupported geometry parameter. Review this region in Workflow JSON.';
  if(g.type==='Mesh')return typeof g.source==='string'&&g.source.trim()?'':'Choose a mesh file or enter a mesh ID.';
  if(!vector(g.center))return 'Center requires three finite coordinates.';
  if(g.type==='Box'&&(!vector(g.size)||g.size.some(v=>v<=0)))return 'All three full box dimensions must be positive.';
  if(['Cylinder','Sphere'].includes(g.type)&&(!Number.isFinite(g.radius)||g.radius<=0))return 'Radius must be positive.';
  if(g.type==='Cylinder'&&(!Number.isFinite(g.height)||g.height<=0))return 'Full cylinder height must be positive.';
  const axis=g.type==='Box'?g.rotation_axis:g.type==='Cylinder'?g.axis:undefined;
  if(axis!==undefined&&(!vector(axis)||Math.hypot(...axis)===0))return 'Axis requires three finite numbers and cannot be zero.';
  if(g.rotation_degrees!==undefined&&!Number.isFinite(g.rotation_degrees))return 'Rotation requires a finite angle in degrees.';
  return '';
}
export function scalarFieldError(p){
  if(!p||typeof p.field_id!=='string'||!p.field_id.trim())return 'Enter a field name.';
  if(!Number.isFinite(p.default_value))return 'Background value must be finite.';
  const method=p.overlap??'Minimum',interpolation=isScalarInterpolation(method);
  if(!scalarFieldMethods.includes(method))return 'Choose a supported combination method.';
  if(!Array.isArray(p.regions))return 'Regions must be a list. Review Workflow JSON.';
  if(!Number.isFinite(p.distance_power??1)||(p.distance_power??1)<=0)return 'Distance power must be finite and greater than zero.';
  if(method!=='InverseDistance'&&(p.distance_power??1)!==1)return 'Distance power only applies to InverseDistance. Use 1 or change the method.';
  if(method==='Smoothstep'&&p.regions.length!==2)return 'Smoothstep requires exactly two regions.';
  if(interpolation&&p.regions.length<2)return 'Interpolation requires at least two regions.';
  for(const [i,r] of p.regions.entries()){
    const error=!r||typeof r!=='object'?'Invalid region.':geometryError(r.geometry)||(!Number.isFinite(r.value)?'Region value must be finite.':'')||(!Number.isFinite(r.transition_width??0)||(r.transition_width??0)<0?'Transition width must be zero or positive.':'')||(interpolation&&(r.transition_width??0)!==0?'Interpolation requires transition width 0. Clear transition widths or select Minimum or Maximum.':'');
    if(error)return `Region ${i+1}: ${error}`;
  }
  return '';
}
export function scalarWorkflowError(workflow){
  for(const [key,step] of Object.entries(workflow||{}))if(step.Define_ScalarField_CombineGeometry){const error=scalarFieldError(step.Define_ScalarField_CombineGeometry);if(error)return `Step ${key}: ${error}`;}
  return '';
}
export function defaultGeometry(type,domain,previous){
  const valid=Array.isArray(domain)&&domain.length===3&&domain.every(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&p[1]>p[0]);
  const center=vector(previous?.center)?previous.center:valid?domain.map(p=>(p[0]+p[1])/2):[0,0,0];
  const size=valid?domain.map(p=>(p[1]-p[0])/4):[20,20,20],radius=Math.min(...size)/2;
  const geometry={Box:{type,center,size,rotation_axis:[0,0,1],rotation_degrees:0},Cylinder:{type,center,axis:[0,0,1],radius,height:size[2]},Sphere:{type,center,radius},Mesh:{type,source:''}}[type];
  // Generated geometry is always encoded with real-valued coordinates for Artisan.
  const result=cloneNumericJson(geometry);
  const floats=obj=>{for(const [key,value] of Object.entries(obj))if(typeof value==='number')setNumber(obj,key,value,'float');else if(value&&typeof value==='object')floats(value);};floats(result);return result;
}
export function newPrimitiveRegion(type,domain,index=0){return {name:`Region ${index+1}`,geometry:defaultGeometry(type,domain),value:1.0,transition_width:0.0};}
export function boxAxes(g){
  const a=unit(g.rotation_axis||[0,0,1]),t=(g.rotation_degrees||0)*Math.PI/180,c=Math.cos(t),s=Math.sin(t);
  return [[1,0,0],[0,1,0],[0,0,1]].map(v=>{const dot=a.reduce((n,x,i)=>n+x*v[i],0),cross=[a[1]*v[2]-a[2]*v[1],a[2]*v[0]-a[0]*v[2],a[0]*v[1]-a[1]*v[0]];return v.map((x,i)=>x*c+cross[i]*s+a[i]*dot*(1-c));});
}
export function geometryBounds(g,width=0){
  if(geometryError(g)||geometryType(g)==='Mesh')return null;
  let half;
  if(g.type==='Box'){const axes=boxAxes(g);half=[0,1,2].map(i=>axes.reduce((n,a,j)=>n+Math.abs(a[i])*g.size[j]/2,0));}
  if(g.type==='Sphere')half=[g.radius,g.radius,g.radius];
  if(g.type==='Cylinder'){const axis=unit(g.axis||[0,0,1]);half=axis.map(a=>Math.abs(a)*g.height/2+g.radius*Math.sqrt(Math.max(0,1-a*a)));}
  return [g.center.map((x,i)=>x-half[i]-width),g.center.map((x,i)=>x+half[i]+width)];
}
export function coverageWarning(region,setup){
  if(setup?.Type!=='Sample')return 'Sampling bounds come from Project settings / source geometry.';
  const b=geometryBounds(region?.geometry,region?.transition_width||0),d=setup.Sample?.Domain;
  if(!b||!Array.isArray(d)||d.length!==3)return '';
  return d.some((p,i)=>b[0][i]<p[0]||b[1][i]>p[1])?'Region or transition extends beyond the sampling box. Only grid points inside the sampling box are computed.':'';
}
// Delta is measured along the outward handle direction; the opposite face/cap stays fixed.
export function resizeGeometry(original,dimension,sign,delta,direction,snap=0){
  const g=cloneNumericJson(original),round=n=>snap>0?Math.round(n/snap)*snap:n;
  if(dimension==='radius'){setNumber(g,'radius',Math.max(1e-6,round(g.radius+delta)),'float');return g;}
  const length=dimension==='height'?g.height:g.size[dimension],next=Math.max(1e-6,round(length+delta)),shift=(next-length)/2;
  g.center.forEach((v,i)=>setNumber(g.center,i,v+direction[i]*shift,'float'));
  if(dimension==='height')setNumber(g,'height',next,'float');else setNumber(g.size,dimension,next,'float');
  return g;
}
// A preview run excludes downstream operations and their exports. It does not edit the saved workflow.
export function fieldPreviewWorkflow(doc,selected,output){
  const p=doc.WorkFlow[selected]?.Define_ScalarField_CombineGeometry;
  if(!p)throw Error('Select a scalar-field operation first.');
  const error=scalarWorkflowError(Object.fromEntries(Object.entries(doc.WorkFlow).filter(([k])=>Number(k)<=Number(selected))));if(error)throw Error(error);
  const copy=cloneNumericJson(doc),steps=[];
  for(const key of Object.keys(copy.WorkFlow).sort((a,b)=>Number(a)-Number(b))){
    if(Number(key)>Number(selected))break;
    const commands=Object.fromEntries(Object.entries(copy.WorkFlow[key]).filter(([k])=>k!=='Export'));
    if(Object.keys(commands).length)steps.push(commands);
  }
  steps.push({Export:{outfile:output,GridFieldIDs:[p.field_id]}});
  copy.WorkFlow=Object.fromEntries(steps.map((s,i)=>[String(i+1),s]));delete copy.ArtGUI;
  copy.PostProcess={...copy.PostProcess,CombineMeshes:false,RemoveIsolatedParts:false};return copy;
}
