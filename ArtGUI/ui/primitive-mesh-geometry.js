import * as THREE from './vendor/three.module.js';
import {primitiveMeshError,primitiveMeshFrame,primitiveMeshOrigin,primitiveMeshRanges,isAxialPrimitive,cappedConeRadius} from './primitive-mesh-model.js';

// This is a bounded, local guide mesh. Artisan remains responsible for exported elements.
export function createPrimitiveMeshGeometry(keyword,p,{dragging=false}={}){
  const error=primitiveMeshError(keyword,p);if(error)throw Error(error);
  const ranges=primitiveMeshRanges(keyword,p),cap=dragging?20:48,counts=p.num_elem.map(n=>Math.min(n,cap));
  const positions=[],lines=[],faces=[],bounds=new THREE.Box3();
  const frame=primitiveMeshFrame(keyword,p),origin=primitiveMeshOrigin(keyword,p);
  const at=([a,b,c])=>{
    if(keyword==='Gen_CappedConeMesh')a=cappedConeRadius(p,a,c);
    const point=keyword==='Gen_BoxMesh'?new THREE.Vector3(a,b,c):isAxialPrimitive(keyword)?new THREE.Vector3(a*Math.cos(b),a*Math.sin(b),c):new THREE.Vector3(a*Math.sin(c)*Math.cos(b),a*Math.sin(c)*Math.sin(b),a*Math.cos(c));
    return point.applyQuaternion(frame);
  };
  function face(axis,side,path){
    const other=[0,1,2].filter(i=>i!==axis),[a,b]=other,start=positions.length/3;
    const point=(i,j)=>{const c=ranges.map(r=>r[0]);c[axis]=ranges[axis][side];c[a]=ranges[a][0]+(ranges[a][1]-ranges[a][0])*i/counts[a];c[b]=ranges[b][0]+(ranges[b][1]-ranges[b][0])*j/counts[b];return at(c);};
    for(let i=0;i<counts[a];i++)for(let j=0;j<counts[b];j++){
      const q=[point(i,j),point(i+1,j),point(i+1,j+1),point(i,j+1)];
      for(const k of [0,1,2,0,2,3]){positions.push(...q[k].toArray());bounds.expandByPoint(q[k].clone().add(origin));}
    }
    for(let i=0;i<=counts[a];i++)for(let j=0;j<counts[b];j++)lines.push(...point(i,j).toArray(),...point(i,j+1).toArray());
    for(let j=0;j<=counts[b];j++)for(let i=0;i<counts[a];i++)lines.push(...point(i,j).toArray(),...point(i+1,j).toArray());
    faces.push({path,start,count:positions.length/3-start});
  }
  if(keyword==='Gen_BoxMesh')for(let i=0;i<3;i++)for(let side=0;side<2;side++)face(i,side,'xyz'[i]+'_range.'+side);
  else{
    if(p.r_range[0]>0)face(0,0,'r_range.0');face(0,1,'r_range.1');
    if(p.phi_range[1]-p.phi_range[0]<1-1e-10){face(1,0,'phi_range.0');face(1,1,'phi_range.1');}
    if(isAxialPrimitive(keyword)){face(2,0,'ori');face(2,1,'Height');}
    else{if(p.theta_range[0]>0)face(2,0,'theta_range.0');if(p.theta_range[1]<1)face(2,1,'theta_range.1');}
  }
  const surface=new THREE.BufferGeometry();surface.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  faces.forEach((f,i)=>surface.addGroup(f.start,f.count,i));surface.computeVertexNormals();
  const grid=new THREE.BufferGeometry();grid.setAttribute('position',new THREE.Float32BufferAttribute(lines,3));
  return {surface,grid,faces,bounds,counts,simplified:counts.some((n,i)=>n!==p.num_elem[i])};
}
