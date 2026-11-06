import {modelPoint} from './field-data.js';

// A bounded inspection surface, sampled from the saved grid; never used for export.
const tetrahedra=[[0,1,3,7],[0,3,2,7],[0,2,6,7],[0,6,4,7],[0,4,5,7],[0,5,1,7]];
export function isosurfaceGeometry(slices,isovalue,{maxTriangles=250000}={}){
  if(!Number.isFinite(isovalue)||slices.length<2)throw Error('An isosurface needs a finite level and at least two slices.');
  const first=slices[0],[nx,ny]=first.shape,positions=[],center=modelPoint([first.coordinates[0][Math.floor(nx/2)],first.coordinates[1][Math.floor(ny/2)],slices[Math.floor(slices.length/2)].position],first.transform);
  const emit=(a,b,c)=>{if(positions.length/9>=maxTriangles)throw Error('Inspection surface exceeds the triangle limit. Choose a coarser quality.');for(const p of [a,b,c]){const q=modelPoint(p,first.transform);positions.push(...q.map((v,i)=>v-center[i]));}};
  for(let z=0;z<slices.length-1;z++){
    const a=slices[z],b=slices[z+1];if(a.axis!==2||b.axis!==2||a.shape[0]!==nx||a.shape[1]!==ny||b.shape[0]!==nx||b.shape[1]!==ny||a.position>=b.position)throw Error('Inconsistent grid slices.');
    for(let x=0;x<nx-1;x++)for(let y=0;y<ny-1;y++){
      const points=[],values=[];
      for(let dz=0;dz<2;dz++)for(let dx=0;dx<2;dx++)for(let dy=0;dy<2;dy++){const s=dz?b:a;points.push([s.coordinates[0][x+dx],s.coordinates[1][y+dy],s.position]);values.push(s.values[(x+dx)*ny+y+dy]);}
      if(values.some(v=>!Number.isFinite(v)))continue;
      for(const tet of tetrahedra){
        const inside=tet.filter(i=>values[i]<isovalue),outside=tet.filter(i=>values[i]>=isovalue);
        const interpolate=(a,b)=>{const t=(isovalue-values[a])/(values[b]-values[a]);return points[a].map((v,i)=>v+t*(points[b][i]-v));};
        if(inside.length===1){const a=inside[0];emit(...outside.map(b=>interpolate(a,b)));}
        else if(inside.length===3){const b=outside[0];emit(...inside.map(a=>interpolate(a,b)).reverse());}
        else if(inside.length===2){const [a,b]=inside,[c,d]=outside,p=interpolate(a,c),q=interpolate(a,d),r=interpolate(b,d),s=interpolate(b,c);emit(p,q,r);emit(p,r,s);}

      }
    }
  }
  return {positions:new Float32Array(positions),center};
}
