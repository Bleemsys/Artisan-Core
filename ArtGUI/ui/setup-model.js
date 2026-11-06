import {cloneNumericJson,setNumber} from './numeric-json.js';

export const validDomain=d=>Array.isArray(d)&&d.length===3&&d.every(a=>Array.isArray(a)&&a.length===2&&a.every(Number.isFinite)&&a[1]>a[0]&&Number.isFinite(a[1]-a[0]));
export const validVector=v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite);
export function domainGeometry(domain){
 if(!validDomain(domain))return null;
 return {type:'Box',center:domain.map(a=>a[0]+(a[1]-a[0])/2),size:domain.map(a=>a[1]-a[0]),rotation_axis:[0,0,1],rotation_degrees:0};
}
export function setDomainGeometry(setup,g){
 if(!validVector(g?.center)||!validVector(g?.size)||g.size.some(v=>v<=0))throw Error('Domain dimensions must be positive and finite.');
 if(setup.Type!=='Sample')throw Error('Mesh bounds are derived from the source mesh.');
 const next=g.center.map((n,i)=>[n-g.size[i]/2,n+g.size[i]/2]);if(!validDomain(next))throw Error('Domain dimensions must be positive and finite.');
 setup.Sample ||= {Shape:'Box'};setup.Sample.Domain ||= [[],[],[]];
 g.center.forEach((n,i)=>{setup.Sample.Domain[i] ||= [];setNumber(setup.Sample.Domain[i],0,n-g.size[i]/2,'float');setNumber(setup.Sample.Domain[i],1,n+g.size[i]/2,'float');});
}
export function selectSetupSource(setup,type,meshBounds){
 if(!['Sample','Geometry'].includes(type))throw Error('Choose Mesh or Box domain.');
 if(type==='Sample'&&!validDomain(setup.Sample?.Domain)){
  setup.Sample ||= {};setup.Sample.Shape ||= 'Box';
  setup.Sample.Domain=cloneNumericJson(validDomain(meshBounds)?meshBounds:[[-5.0,5.0],[-5.0,5.0],[-5.0,5.0]]);
  for(const pair of setup.Sample.Domain)for(let i=0;i<2;i++)setNumber(pair,i,pair[i],'float');
 }
 setup.Type=type;
}
export function samplingError(s){
 if(!validVector(s.res)||s.res.some(v=>v<=0))return 'Grid spacing must contain three positive numbers.';
 if(!Number.isInteger(s.Padding)||s.Padding<0)return 'Padding must be a nonnegative number of grid layers.';
 return '';
}
export function setupError(s){
 if(s.Type==='Sample'&&!validDomain(s.Sample?.Domain))return 'Each maximum bound must be greater than its minimum.';
 if(s.Type==='Geometry'&&(!s.Geomfile||!String(s.Geomfile).trim()))return 'Choose a source mesh.';
 return samplingError(s)||(!Number.isFinite(s.memorylimit)||s.memorylimit<=0?'Memory budget must be positive.':'');
}
export function setSpacing(s,axis,text,linked){
 const n=Number(String(text).trim());if(!String(text).trim()||!Number.isFinite(n)||n<=0)throw Error('Grid spacing must be positive.');
 if(!Array.isArray(s.res))s.res=[1,1,1];
 for(const i of linked?[0,1,2]:[axis])setNumber(s.res,i,text,'float');
}
export function memoryBytes(text){
 const n=Number(String(text).trim())*1073741824;
 if(!String(text).trim()||!Number.isFinite(n)||n<1||n>Number.MAX_SAFE_INTEGER)throw Error('Enter a positive memory budget in GiB.');
 return Math.round(n);
}
export function paddedDomain(d,res,padding){
 if(!validDomain(d)||!validVector(res)||res.some(v=>v<=0)||!Number.isInteger(padding)||padding<0)return null;
 const outer=d.map((a,i)=>[a[0]-res[i]*padding,a[1]+res[i]*padding]);return validDomain(outer)?outer:null;
}
// The guide stays bounded even for very fine sampling. It is not an engine grid.
export function samplingGuideSegments(d,res,padding=0,maxLines=12){
 const outer=paddedDomain(d,res,padding);if(!outer)return [];
 const points=[];
 for(let axis=0;axis<3;axis++){
  const n=Math.floor((outer[axis][1]-outer[axis][0])/res[axis]);
  const count=Math.max(1,Math.min(maxLines,n));
  for(let j=0;j<=count;j++){
   const at=Number.isFinite(n)?outer[axis][0]+Math.floor(j*n/count)*res[axis]:outer[axis][0]+(outer[axis][1]-outer[axis][0])*j/count;
   for(const side of [-1,1]){
    const other=(axis+1)%3,along=(axis+2)%3;
    const a=outer.map(p=>p[0]),b=[...a];a[axis]=b[axis]=at;a[other]=b[other]=outer[other][side===1?1:0];b[along]=outer[along][1];points.push(a,b);
   }
  }
 }
 return points;
}
