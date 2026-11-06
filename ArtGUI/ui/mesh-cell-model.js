import {ShapeUtils,Vector2} from './vendor/three.module.js';
import {cloneNumericJson} from './numeric-json.js';
import {isStrutPoint,strutDomainGeometry,isSurfaceCellDomain,STRUT_DOMAINS} from './strut-cell-model.js';

export const MESH_CELL_LIMITS={vertices:100000,faces:100000,triangles:200000,fileBytes:32*1024*1024,polygonVertices:64};
export const MESH_CELL_TYPES=['Geom','Geom-Plate'];
export function supportsMeshCellDomain(type,domain){
 return type==='Geom-Plate'?STRUT_DOMAINS.includes(domain):type==='Geom'&&(domain==='Hex'||domain==='Tet');
}
const copy=cloneNumericJson,sub=(a,b)=>a.map((v,i)=>v-b[i]),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const finite=p=>Array.isArray(p)&&p.length===3&&p.every(v=>Number.isFinite(v)&&Math.abs(v)<=1e9);
export const blankMeshDefinition=(type='Geom',domain='Hex')=>({type,definition:{file:'',ladomain:domain}});
export function meshDefinitionDraft(definition){if(!supportsMeshCellDomain(definition?.type,definition?.definition?.ladomain)||typeof definition.definition.file!=='string')throw Error('Choose a compatible reference domain for this Geometry or Plate definition.');return copy(definition);}
export const emptyCellMesh=()=>({vertices:[],faces:[],nextFaceId:1});
export const meshFace=(mesh,id)=>mesh.faces.find(f=>f.id===id);
export function activeVertexIndices(mesh){return [...new Set(mesh.faces.flatMap(f=>f.indices))].sort((a,b)=>a-b);}
export function cellMeshBounds(mesh){const indices=activeVertexIndices(mesh),min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(const i of indices)for(let a=0;a<3;a++){min[a]=Math.min(min[a],mesh.vertices[i][a]);max[a]=Math.max(max[a],mesh.vertices[i][a]);}return indices.length?{min,max,size:max.map((v,i)=>v-min[i]),centre:max.map((v,i)=>(v+min[i])/2)}:null;}

function orient(a,b,c){return(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);}
function intersects(a,b,c,d){const p=orient(a,b,c),q=orient(a,b,d),r=orient(c,d,a),s=orient(c,d,b),eps=1e-10;const on=(x,y,z)=>Math.abs(orient(x,y,z))<=eps&&z.every((v,i)=>v>=Math.min(x[i],y[i])-eps&&v<=Math.max(x[i],y[i])+eps);return(p*q<0&&r*s<0)||on(a,b,c)||on(a,b,d)||on(c,d,a)||on(c,d,b);}
export function faceGeometry(mesh,face){
 const ids=face.indices;if(!Array.isArray(ids)||ids.length<3||ids.length>MESH_CELL_LIMITS.polygonVertices||new Set(ids).size!==ids.length||ids.some(i=>!Number.isInteger(i)||!finite(mesh.vertices[i])))throw Error('Faces need 3–64 different valid vertices.');
 const points=ids.map(i=>mesh.vertices[i]),origin=points[0],local=points.map(p=>sub(p,origin)),span=Math.max(...local.flat().map(Math.abs));if(span<1e-12)throw Error('A face has zero area.');
 let normal=[0,0,0];for(let i=1;i+1<local.length;i++){const c=cross(local[i],local[i+1]);normal=normal.map((v,a)=>v+c[a]);}const length=Math.hypot(...normal);if(length<=span*span*1e-12)throw Error('A face has zero area or crossing edges.');normal=normal.map(v=>v/length);
 if(local.some(p=>Math.abs(dot(p,normal))>Math.max(1e-12,span*1e-7)))throw Error('Polygon vertices must lie in one plane.');
 const drop=normal.map(Math.abs).indexOf(Math.max(...normal.map(Math.abs))),axes=[0,1,2].filter(a=>a!==drop),projected=local.map(p=>axes.map(a=>p[a]/span));
 if(ids.length>3)for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++){if(j===i+1||i===0&&j===ids.length-1)continue;if(intersects(projected[i],projected[(i+1)%ids.length],projected[j],projected[(j+1)%ids.length]))throw Error('A polygon has crossing or touching edges.');}
 const triangulated=ids.length===3?[[0,1,2]]:ShapeUtils.triangulateShape(projected.map(p=>new Vector2(...p)),[]);if(!triangulated.length)throw Error('The polygon could not be triangulated.');
 const triangles=triangulated.map(t=>{const indices=t.map(i=>ids[i]),n=cross(sub(mesh.vertices[indices[1]],mesh.vertices[indices[0]]),sub(mesh.vertices[indices[2]],mesh.vertices[indices[0]]));if(Math.hypot(...n)<=span*span*1e-12)throw Error('A face contains a zero-area triangle.');if(dot(n,normal)<0)[indices[1],indices[2]]=[indices[2],indices[1]];return indices;});
 const centre=points[0].map((_,a)=>points.reduce((s,p)=>s+p[a],0)/points.length),fixed=[0,1,2].find(a=>points.every(p=>Math.abs(p[a]-points[0][a])<1e-9)),plane=fixed===2?'XY':fixed===1?'XZ':fixed===0?'YZ':'Custom';
 return{normal,centre,triangles,plane,axis:fixed,position:fixed===undefined?null:points[0][fixed]};
}

export function inspectCellMesh(mesh,type,domain){
 const errors=[],warnings=[],triangles=[],triangleFaces=[],badFaces=new Set(),outside=new Set(),badEdges=[],edges=new Map(),faceInfo=new Map(),duplicates=new Set();let duplicateFaces=0,openEdges=0,junctionEdges=0,windingEdges=0;
 if(mesh.vertices.length>MESH_CELL_LIMITS.vertices||mesh.faces.length>MESH_CELL_LIMITS.faces)throw Error('The mesh exceeds the interactive editing limit.');
 const bounds=cellMeshBounds(mesh),reference=bounds?.centre||[0,0,0];let volume=0;
 for(const face of mesh.faces){
  try{const info=faceGeometry(mesh,face);faceInfo.set(face.id,info);const key=[...face.indices].sort((a,b)=>a-b).join(',');if(duplicates.has(key)){duplicateFaces++;badFaces.add(face.id);}duplicates.add(key);
   for(const t of info.triangles){triangles.push(t);triangleFaces.push(face.id);const [a,b,c]=t.map(i=>sub(mesh.vertices[i],reference));volume+=dot(a,cross(b,c))/6;}
   for(let i=0;i<face.indices.length;i++){const a=face.indices[i],b=face.indices[(i+1)%face.indices.length],key=[a,b].sort((x,y)=>x-y).join(':'),edge=edges.get(key)||{a,b,count:0,direction:0,faces:[]};edge.count++;edge.direction+=a<b?1:-1;edge.faces.push(face.id);edges.set(key,edge);}
  }catch(e){badFaces.add(face.id);if(errors.length<4)errors.push('P'+face.id+': '+e.message);}
 }
 if(triangles.length>MESH_CELL_LIMITS.triangles)throw Error('The mesh has too many triangles for this editor.');
 for(const i of activeVertexIndices(mesh))if(!isStrutPoint(mesh.vertices[i],domain))outside.add(i);
 for(const edge of edges.values()){const bad=edge.count===1||edge.count>2||edge.count===2&&edge.direction!==0;if(edge.count===1)openEdges++;if(edge.count>2)junctionEdges++;if(edge.count===2&&edge.direction!==0)windingEdges++;if(bad){badEdges.push([edge.a,edge.b]);if(type==='Geom')edge.faces.forEach(id=>badFaces.add(id));}}
 if(!mesh.faces.length)errors.push(type==='Geom'?'Import a closed solid mesh.':'Add a plate or import a surface mesh.');
 if(duplicateFaces)errors.push('Duplicate faces must be removed.');
 const outsideMessages={
  Hex:'Mesh vertices must lie between 0 and 1. Fit the mesh inside the reference cell.',
  Tet:'Mesh vertices must satisfy X ≥ 0, Y ≥ 0, Z ≥ 0 and X + Y + Z ≤ 1.',
  Quad:'Plate vertices must lie in the XY unit square at Z = 0.',
  Triangle:'Plate vertices require X ≥ 0, Y ≥ 0, X + Y ≤ 1 and Z = 0.'
 };
 if(outside.size)errors.push(outsideMessages[domain]);
 if(type==='Geom'){
  if(openEdges)errors.push('Geometry requires closed boundaries. Open edges: '+openEdges+'.');
  if(junctionEdges)errors.push('Geometry has edges shared by more than two faces.');
  if(windingEdges)errors.push('Geometry has inconsistent face winding.');
  const scale=Math.max(...(bounds?.size||[1]));if(mesh.faces.length&&!badFaces.size&&(!Number.isFinite(volume)||volume<=Math.pow(scale,3)*1e-12))errors.push(volume<0?'Solid faces point inward. Reverse all normals.':'Geometry must enclose a nonzero solid volume.');
 }else{if(windingEdges)warnings.push('Some adjacent faces have different winding. Inspect their normals.');if(junctionEdges)warnings.push('Multi-face junctions: '+junctionEdges+'. Review the intended plate connections.');}
 if(mesh.faces.length)warnings.push('Boundary checks do not test self-intersections. Verify the generated result in Artisan.');
 return{errors,warnings,bounds,triangles,triangleFaces,faceInfo,badFaces,outside,badEdges,openEdges,junctionEdges,windingEdges,duplicateFaces,volume,vertexCount:activeVertexIndices(mesh).length};
}

function checkedMesh(mesh){for(const face of mesh.faces)faceGeometry(mesh,face);if(mesh.vertices.length>MESH_CELL_LIMITS.vertices||mesh.faces.length>MESH_CELL_LIMITS.faces)throw Error('The mesh exceeds the interactive editing limit.');return mesh;}
export function meshFromArrays(vertices,faces){
 if(!vertices.length||!faces.length)throw Error('The mesh file contains no faces.');
 if(vertices.length>MESH_CELL_LIMITS.vertices*3||faces.length>MESH_CELL_LIMITS.faces)throw Error('The mesh exceeds the interactive editing limit.');
 const out=emptyCellMesh(),unique=new Map(),map=vertices.map(p=>{if(!finite(p))throw Error('Mesh coordinates must be finite and within ±1e9.');const key=p.map(v=>v===0?0:v).join(',');if(!unique.has(key)){unique.set(key,out.vertices.length);out.vertices.push([...p]);}return unique.get(key);});
 if(out.vertices.length>MESH_CELL_LIMITS.vertices)throw Error('The mesh exceeds the interactive editing limit.');for(const indices of faces){if(indices.some(i=>!Number.isInteger(i)||i<0||i>=map.length))throw Error('A face refers to a missing vertex.');out.faces.push({id:out.nextFaceId++,indices:indices.map(i=>map[i])});}return checkedMesh(out);
}
function restorePolygonGroups(vertices,groups,faces){
 try{
  if(!groups.length||groups.reduce((sum,g)=>sum+g.triangles.length,0)!==faces.length)return null;
  for(const group of groups){
   const info=faceGeometry({vertices},{indices:group.indices}),expected=new Map(),edges=new Map();
   for(let i=0;i<group.indices.length;i++){const a=group.indices[i],b=group.indices[(i+1)%group.indices.length];expected.set([a,b].sort((x,y)=>x-y).join(':'),a<b?1:-1);}
   if(!group.triangles.length)return null;
   for(const t of group.triangles){if(t.length!==3||t.some(i=>!group.indices.includes(i)))return null;const n=cross(sub(vertices[t[1]],vertices[t[0]]),sub(vertices[t[2]],vertices[t[0]]));if(dot(n,info.normal)<=0)return null;
    for(let i=0;i<3;i++){const a=t[i],b=t[(i+1)%3],key=[a,b].sort((x,y)=>x-y).join(':'),edge=edges.get(key)||{count:0,direction:0};edge.count++;edge.direction+=a<b?1:-1;edges.set(key,edge);}
   }
   for(const [key,direction] of expected){const edge=edges.get(key);if(!edge||edge.count!==1||edge.direction!==direction)return null;}
   for(const [key,edge] of edges)if(!expected.has(key)&&(edge.count!==2||edge.direction!==0))return null;
  }
  return meshFromArrays(vertices,groups.map(g=>g.indices));
 }catch{return null;}
}
export function parseCellMesh(buffer,fileName){
 if(buffer.byteLength>MESH_CELL_LIMITS.fileBytes)throw Error('Mesh files are limited to 32 MB.');
 if(/\.obj$/i.test(fileName)){
  const vertices=[],faces=[],groups=[],text=new TextDecoder().decode(buffer);let group=null;for(const line of text.split(/\r?\n/)){if(line.startsWith('# ArtGUI polygon ')){group={indices:line.slice(17).trim().split(/\s+/).map(v=>Number(v)-1),triangles:[]};groups.push(group);continue;}const words=line.split('#')[0].trim().split(/\s+/);if(words[0]==='v'){if(words.length<4)throw Error('An OBJ vertex is incomplete.');vertices.push(words.slice(1,4).map(Number));}else if(words[0]==='f'){const ids=words.slice(1).map(word=>{const token=word.split('/')[0];if(!/^-?\d+$/.test(token))throw Error('OBJ faces need integer vertex indices.');const i=Number(token);return i<0?vertices.length+i:i-1;});faces.push(ids);group?.triangles.push(ids);}if(vertices.length>MESH_CELL_LIMITS.vertices||faces.length>MESH_CELL_LIMITS.triangles||groups.length>MESH_CELL_LIMITS.faces)throw Error('The mesh exceeds the interactive editing limit.');}return restorePolygonGroups(vertices,groups,faces)||meshFromArrays(vertices,faces);
 }
 if(!/\.stl$/i.test(fileName))throw Error('This editor imports STL and OBJ meshes. Other formats remain available in the original definition fields.');
 const vertices=[],faces=[],data=new DataView(buffer),count=buffer.byteLength>=84?data.getUint32(80,true):0;
 if(buffer.byteLength>=84&&84+count*50===buffer.byteLength){if(count>MESH_CELL_LIMITS.faces)throw Error('The mesh exceeds the interactive editing limit.');for(let t=0;t<count;t++){const face=[];for(let v=0;v<3;v++){const p=[];for(let a=0;a<3;a++)p.push(data.getFloat32(84+t*50+12+v*12+a*4,true));face.push(vertices.length);vertices.push(p);}faces.push(face);}}
 else{const text=new TextDecoder().decode(buffer),matches=text.matchAll(/\bvertex\s+([^\s]+)\s+([^\s]+)\s+([^\s]+)/gi);for(const match of matches){vertices.push(match.slice(1).map(Number));if(vertices.length%3===0)faces.push([vertices.length-3,vertices.length-2,vertices.length-1]);if(faces.length>MESH_CELL_LIMITS.faces)throw Error('The mesh exceeds the interactive editing limit.');}if(vertices.length%3||!vertices.length)throw Error('The STL file has incomplete or missing triangles.');}
 return meshFromArrays(vertices,faces);
}

export function compactCellMesh(mesh){const used=activeVertexIndices(mesh),map=new Map(used.map((id,i)=>[id,i]));return{vertices:used.map(i=>[...mesh.vertices[i]]),faces:mesh.faces.map(f=>f.indices.map(i=>map.get(i)))};}
export function cellMeshObj(mesh){const data=compactCellMesh(mesh),map=new Map(activeVertexIndices(mesh).map((id,i)=>[id,i]));return'# ArtGUI prepared unit cell\n'+data.vertices.map(p=>'v '+p.join(' ')).join('\n')+'\n'+mesh.faces.map((face,i)=>'# ArtGUI polygon '+data.faces[i].map(v=>v+1).join(' ')+'\n'+faceGeometry(mesh,face).triangles.map(t=>'f '+t.map(v=>map.get(v)+1).join(' ')).join('\n')).join('\n')+'\n';}
export function fitCellMesh(mesh,domain,lockProportions=true){
 const bounds=cellMeshBounds(mesh);if(!bounds)throw Error('Import a mesh or add a plate first.');const target=strutDomainGeometry(domain).centre,prepared=copy(mesh),active=activeVertexIndices(mesh),size=bounds.size,span=Math.max(...size);if(span<1e-12)throw Error('The mesh has no extent.');
 const surface=isSurfaceCellDomain(domain),simplex=domain==='Tet'||domain==='Triangle';
 if(surface&&size[2]>1e-9)throw Error('To fit a surface cell, use a plate parallel to the XY plane.');
 const deltas=active.map(i=>sub(mesh.vertices[i],bounds.centre).map((v,a)=>surface&&a===2?0:lockProportions?v:v/(size[a]||span))),limits=[];
 const budget=1-target.reduce((a,b)=>a+b,0);
 for(const d of deltas){
  for(let a=0;a<3;a++){
   if(d[a]<0)limits.push(target[a]/-d[a]);
   if(!simplex&&d[a]>0)limits.push((1-target[a])/d[a]);
  }
  const sum=d.reduce((a,b)=>a+b,0);
  if(simplex&&sum>0)limits.push(budget/sum);
 }
 const scale=Math.min(...limits);if(!Number.isFinite(scale)||scale<=0)throw Error('The mesh cannot be fitted into this reference cell.');active.forEach((id,i)=>prepared.vertices[id]=target.map((v,a)=>Math.max(0,Math.min(1,v+deltas[i][a]*scale))));return checkedMesh(prepared);
}
export function transformCellMesh(mesh,{translation=[0,0,0],rotation=[0,0,0],scale=[1,1,1]}={}){
 if(![translation,rotation,scale].every(finite)||scale.some(v=>v<=0))throw Error('Use three finite transform values and positive scale factors.');const bounds=cellMeshBounds(mesh);if(!bounds)throw Error('Import a mesh or add a plate first.');const out=copy(mesh),r=rotation.map(v=>v*Math.PI/180);
 for(const id of activeVertexIndices(mesh)){let [x,y,z]=sub(mesh.vertices[id],bounds.centre).map((v,a)=>v*scale[a]);[y,z]=[y*Math.cos(r[0])-z*Math.sin(r[0]),y*Math.sin(r[0])+z*Math.cos(r[0])];[x,z]=[x*Math.cos(r[1])+z*Math.sin(r[1]),-x*Math.sin(r[1])+z*Math.cos(r[1])];[x,y]=[x*Math.cos(r[2])-y*Math.sin(r[2]),x*Math.sin(r[2])+y*Math.cos(r[2])];out.vertices[id]=[x,y,z].map((v,a)=>v+bounds.centre[a]+translation[a]);}return checkedMesh(out);
}
export function addPlate(mesh,points,domain){
 if(points.some(p=>!isStrutPoint(p,domain)))throw Error('Plate vertices must lie inside the selected reference domain.');const out=copy(mesh),indices=points.map(p=>{let i=out.vertices.findIndex(v=>v.every((n,a)=>n===p[a]));if(i<0){i=out.vertices.length;out.vertices.push([...p]);}return i;}),face={id:out.nextFaceId++,indices};out.faces.push(face);checkedMesh(out);const key=[...indices].sort((a,b)=>a-b).join(',');if(mesh.faces.some(f=>[...f.indices].sort((a,b)=>a-b).join(',')===key))throw Error('This plate already exists.');return{mesh:out,id:face.id};
}
export function referencePlate(plane,position,domain){
 if(isSurfaceCellDomain(domain)){
  if(plane!=='XY'||position!==0)throw Error('Quad and Triangle plates lie in the XY plane at Z = 0.');
  return strutDomainGeometry(domain).corners.map(p=>[...p]);
 }
 if(!['XY','XZ','YZ'].includes(plane)||!Number.isFinite(position)||position<0||position>1)throw Error('Choose a plane and a position between 0 and 1.');const axis=plane==='XY'?2:plane==='XZ'?1:0,axes=[0,1,2].filter(a=>a!==axis),limit=domain==='Tet'?1-position:1,uv=domain==='Tet'?[[0,0],[limit,0],[0,limit]]:[[0,0],[1,0],[1,1],[0,1]];return uv.map(p=>{const out=[0,0,0];out[axis]=position;axes.forEach((a,i)=>out[a]=p[i]);return out;});
}
export function updateMeshVertex(mesh,index,point,domain){if(!mesh.vertices[index]||!isStrutPoint(point,domain))throw Error('The vertex must lie inside the selected reference domain.');const out=copy(mesh);out.vertices[index]=[...point];return checkedMesh(out);}
export function translateMeshFace(mesh,id,delta,domain){const face=meshFace(mesh,id);if(!face)throw Error('Select a plate first.');const out=copy(mesh);for(const i of face.indices){const p=mesh.vertices[i].map((v,a)=>v+delta[a]);if(!isStrutPoint(p,domain))throw Error('The plate must stay inside the reference domain.');out.vertices[i]=p;}return checkedMesh(out);}
export function reverseMeshFace(mesh,id=null){const out=copy(mesh);for(const f of out.faces)if(id===null||f.id===id)f.indices.reverse();return out;}
export function removeMeshFace(mesh,id){const out=copy(mesh);out.faces=out.faces.filter(f=>f.id!==id);return out;}
export function constrainMeshDelta(domain,points,delta){
 const surface=isSurfaceCellDomain(domain);
 const movement=surface?[delta[0],delta[1],0]:delta;
 const simplex=domain==='Tet'||domain==='Triangle',sum=movement.reduce((a,b)=>a+b,0);
 let t=1;
 for(const p of points){
  for(let a=0;a<3;a++){
   if(movement[a]<0)t=Math.min(t,-p[a]/movement[a]);
   if(movement[a]>0)t=Math.min(t,(1-p[a])/movement[a]);
  }
  if(simplex&&sum>0)t=Math.min(t,(1-p.reduce((a,b)=>a+b,0))/sum);
 }
 return movement.map(v=>v*Math.max(0,Math.min(1,t)));
}

// An independently authored, watertight example made from the boundary of a
// small voxel frame. It is also a deterministic import/export test fixture.
export function exampleFrameMesh(){
 const levels=[.08,.22,.78,.92],occupied=(i,j,k)=>[i,j,k].every(v=>v>=0&&v<3)&&[i,j,k].filter(v=>v===0||v===2).length>=2,vertices=[],faces=[];
 const quads=[{d:[-1,0,0],p:[[0,0,0],[0,0,1],[0,1,1],[0,1,0]]},{d:[1,0,0],p:[[1,0,0],[1,1,0],[1,1,1],[1,0,1]]},{d:[0,-1,0],p:[[0,0,0],[1,0,0],[1,0,1],[0,0,1]]},{d:[0,1,0],p:[[0,1,0],[0,1,1],[1,1,1],[1,1,0]]},{d:[0,0,-1],p:[[0,0,0],[0,1,0],[1,1,0],[1,0,0]]},{d:[0,0,1],p:[[0,0,1],[1,0,1],[1,1,1],[0,1,1]]}];
 for(let k=0;k<3;k++)for(let j=0;j<3;j++)for(let i=0;i<3;i++)if(occupied(i,j,k))for(const q of quads)if(!occupied(i+q.d[0],j+q.d[1],k+q.d[2])){const indices=q.p.map(p=>{const id=vertices.length;vertices.push(p.map((v,a)=>levels[[i,j,k][a]+v]));return id;});faces.push(indices);}return meshFromArrays(vertices,faces);
}
