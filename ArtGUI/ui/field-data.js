// The payload is u32 header length, UTF-8 JSON metadata, then little-endian f64 values.
export function decodeFieldSlice(raw) {
  const bytes=raw instanceof ArrayBuffer?new Uint8Array(raw):raw instanceof Uint8Array?raw:Uint8Array.from(raw);
  if(bytes.byteLength<4)throw Error('Incomplete field slice.');
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),length=view.getUint32(0,true);
  if(length>256*1024||length+4>bytes.length)throw Error('Invalid slice header length.');
  const slice=JSON.parse(new TextDecoder().decode(bytes.subarray(4,4+length)));
  if(slice.version!==1||!Array.isArray(slice.shape)||slice.shape.length!==2||!slice.shape.every(n=>Number.isInteger(n)&&n>=2&&n<=512))throw Error('Unsupported slice shape.');
  if(![0,1,2].includes(slice.axis)||!Number.isFinite(slice.position)||!Array.isArray(slice.varying)||slice.varying.length!==2||slice.varying.some((n,i)=>n!==[0,1,2].filter(n=>n!==slice.axis)[i]))throw Error('Invalid slice axes.');
  if(!Array.isArray(slice.coordinates)||slice.coordinates.length!==2||slice.coordinates.some((a,i)=>!Array.isArray(a)||a.length!==slice.shape[i]||a.some((v,j)=>!Number.isFinite(v)||(j>0&&v<=a[j-1]))))throw Error('Invalid slice coordinates.');
  if(!Array.isArray(slice.transform)||slice.transform.length!==16||!slice.transform.every(Number.isFinite))throw Error('Invalid slice transform.');
  const count=slice.shape[0]*slice.shape[1];
  if(bytes.length!==4+length+count*8)throw Error('Field slice data length disagrees with its shape.');
  slice.values=new Float64Array(count);
  for(let i=0;i<count;i++)slice.values[i]=view.getFloat64(4+length+i*8,true);
  return slice;
}
export function modelPoint(p,m) {return [0,1,2].map(i=>m[4*i]*p[0]+m[4*i+1]*p[1]+m[4*i+2]*p[2]+m[4*i+3]);}
export function normalizedValues(values,minimum,maximum) {
  if(!Number.isFinite(minimum)||!Number.isFinite(maximum)||minimum>maximum)throw Error('Colour range needs finite bounds with minimum ≤ maximum.');
  const result=new Float32Array(values.length),scale=Math.max(Math.abs(minimum),Math.abs(maximum),1),lo=minimum/scale,hi=maximum/scale,span=maximum-minimum;
  for(let i=0;i<values.length;i++)result[i]=minimum===maximum?.5:Math.max(0,Math.min(1,Number.isFinite(span)?(values[i]-minimum)/span:(values[i]/scale-lo)/(hi-lo)));
  return result;
}
export function sliceGeometry(slice) {
  const [rows,cols]=slice.shape,points=new Float64Array(rows*cols*3),min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(let i=0;i<rows;i++)for(let j=0;j<cols;j++){
    const p=[0,0,0];p[slice.axis]=slice.position;p[slice.varying[0]]=slice.coordinates[0][i];p[slice.varying[1]]=slice.coordinates[1][j];
    const world=modelPoint(p,slice.transform),index=(i*cols+j)*3;
    world.forEach((v,k)=>{if(!Number.isFinite(v))throw Error('Field transform produces invalid coordinates.');points[index+k]=v;min[k]=Math.min(min[k],v);max[k]=Math.max(max[k],v);});
  }
  const center=min.map((v,k)=>v/2+max[k]/2),positions=new Float32Array(points.length),indices=[];
  for(let i=0;i<points.length;i++)positions[i]=points[i]-center[i%3];
  const triangle=(a,b,c)=>{if([a,b,c].every(i=>Number.isFinite(slice.values[i])))indices.push(a,b,c);};
  for(let i=0;i<rows-1;i++)for(let j=0;j<cols-1;j++){const a=i*cols+j,b=a+cols,c=a+1,d=b+1;triangle(a,b,c);triangle(b,d,c);}
  return {positions,indices:new Uint32Array(indices),center,min,max};
}
export const colourStops={viridis:['#440154','#414487','#2a788e','#22a884','#7ad151','#fde725'],diverging:['#2166ac','#67a9cf','#f7f7f7','#ef8a62','#b2182b']};
export function colourBytes(name) {
  const stops=colourStops[name]||colourStops.viridis,rgb=stops.map(s=>[1,3,5].map(i=>parseInt(s.slice(i,i+2),16))),out=new Uint8Array(256*4);
  for(let i=0;i<256;i++){const t=i/255*(rgb.length-1),a=Math.min(Math.floor(t),rgb.length-2),f=t-a;for(let k=0;k<3;k++)out[4*i+k]=Math.round(rgb[a][k]*(1-f)+rgb[a+1][k]*f);out[4*i+3]=255;}
  return out;
}
export function defaultFieldRange(field) {
  const minimum=field.blocks.map(b=>b.statistics.minimum).filter(Number.isFinite),maximum=field.blocks.map(b=>b.statistics.maximum).filter(Number.isFinite);
  return minimum.length&&maximum.length?[Math.min(...minimum),Math.max(...maximum)]:[0,1];
}
