import {cloneNumericJson} from './numeric-json.js';
import {compileTpmsExpression,tpmsPeriod} from './tpms-expression.js';

export const TPMS_RESOLUTIONS=[16,24,32,48,64];
// An independently authored starting expression, not an extracted engine cell.
export const newTpmsDefinition=()=>({type:'TPMS',definition:{expr:'cos(x)+0.75*cos(y)+cos(z)',unit_x_len:'2*pi',unit_y_len:'2*pi',unit_z_len:'2*pi',ladomain:'Hex'}});
export function tpmsDefinitionDraft(value){
 if(value?.type!=='TPMS'||value.definition?.ladomain!=='Hex')throw Error('The local TPMS designer supports ordinary TPMS definitions in Hex cells.');
 const d=value.definition;for(const key of ['expr','unit_x_len','unit_y_len','unit_z_len'])if(typeof d[key]!=='string')throw Error('The definition needs an expression and three equation periods.');
 return cloneNumericJson(value);
}
export function prepareTpmsDefinition(value){
 const copy=tpmsDefinitionDraft(value),d=copy.definition,expression=compileTpmsExpression(d.expr),periods=['unit_x_len','unit_y_len','unit_z_len'].map(k=>tpmsPeriod(d[k]));
 return{definition:copy,expression,periods};
}
export const tpmsGridIndex=(i,j,k,n)=>i+(n+1)*(j+(n+1)*k);
export function sampleTpmsGrid(value,resolution=24){
 if(!TPMS_RESOLUTIONS.includes(resolution))throw Error('Choose one of the supported preview resolutions.');
 const {expression,periods}=prepareTpmsDefinition(value),n=resolution,m=n+1,values=new Float32Array(m*m*m);let min=Infinity,max=-Infinity;
 for(let k=0;k<=n;k++)for(let j=0;j<=n;j++)for(let i=0;i<=n;i++){
  const value=expression.evaluate(i/n*periods[0],j/n*periods[1],k/n*periods[2]);if(!Number.isFinite(value)||Math.abs(value)>3.4e38)throw Error(`Non-finite or unsupported field value at grid point (${i}, ${j}, ${k}).`);
  const index=tpmsGridIndex(i,j,k,n);values[index]=value;if(value!==0&&values[index]===0)throw Error('Field values are too small for the preview grid precision. Rescale the equation.');min=Math.min(min,value);max=Math.max(max,value);
 }
 const tolerance=Math.max(Math.abs(min),Math.abs(max))*1e-7,occupied=[],constant=min===max;
 if(!constant)for(let k=0;k<n;k++)for(let j=0;j<n;j++)for(let i=0;i<n;i++){
  let lo=Infinity,hi=-Infinity;for(let dz=0;dz<2;dz++)for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++){const f=values[tpmsGridIndex(i+dx,j+dy,k+dz,n)];lo=Math.min(lo,f);hi=Math.max(hi,f);}
  if(lo<=tolerance&&hi>=-tolerance){occupied.push(i+n*(j+n*k));if(occupied.length>60000)throw Error('Too many surface cells for this preview. Reduce the sampling resolution.');}
 }
 const warnings=[];if(!occupied.length)warnings.push(constant&&Math.abs(min)<=tolerance?'The equation is zero at every sampled point; no distinct surface can be identified.':'No zero surface was detected at this sampling resolution.');
 return{resolution:n,values,cells:Uint32Array.from(occupied),min,max,periods,warnings};
}
export function cellGridCoordinates(index,n){const i=index%n,j=Math.floor(index/n)%n,k=Math.floor(index/(n*n));return[i,j,k];}
export function gridSlice(grid,axis,index){
 if(!['x','y','z'].includes(axis)||!Number.isInteger(index)||index<0||index>grid.resolution)throw Error('Choose a valid slice within the reference cell.');
 const n=grid.resolution,m=n+1,values=new Float32Array(m*m);
 for(let v=0;v<=n;v++)for(let u=0;u<=n;u++){const p=axis==='z'?[u,v,index]:axis==='y'?[u,index,v]:[index,u,v];values[u+m*v]=grid.values[tpmsGridIndex(...p,n)];}
 return{axis,index,position:index/n,values,resolution:n,axes:axis==='z'?['x','y']:axis==='y'?['x','z']:['y','z']};
}
export function nearestGridValue(grid,position){const n=grid.resolution,p=position.map(v=>Math.max(0,Math.min(n,Math.round(v*n))));return{indices:p,position:p.map(v=>v/n),value:grid.values[tpmsGridIndex(...p,n)]};}
export function fieldRgb(value,range){const t=Math.min(1,Math.abs(value)/(range||1)),a=[220,229,239],b=value<0?[62,140,225]:[240,153,70];return a.map((v,i)=>Math.round(v+(b[i]-v)*t));}
