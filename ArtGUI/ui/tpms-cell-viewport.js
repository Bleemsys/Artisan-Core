import * as THREE from './vendor/three.module.js';
import {OrbitControls} from './vendor/addons/controls/OrbitControls.js';
import {cellGridCoordinates,gridSlice,nearestGridValue,fieldRgb} from './tpms-cell-model.js';
import {createTpmsVolume,DEFAULT_VOLUME_SETTINGS,probeVolume} from './tpms-volume.js';
const linearRgb=Float32Array.from({length:256},(_,i)=>{const c=i/255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4;});

export function createTpmsCellViewport({canvas,onProbe=()=>{}}){
 const renderer=new THREE.WebGLRenderer({canvas,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));renderer.setClearColor(0x17232f);
 renderer.debug.onShaderError=()=>{throw Error('The volume shader could not start. Choose Slice or Field samples to inspect the grid.');};
 const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-1,1,1,-1,.01,100);camera.up.set(0,0,1);
 const controls=new OrbitControls(camera,canvas);controls.minZoom=.3;controls.maxZoom=8;controls.enableDamping=false;
 scene.add(new THREE.HemisphereLight(0xffffff,0x334155,2.3));const light=new THREE.DirectionalLight(0xffffff,2.3);light.position.set(2,-3,5);scene.add(light);
 const axes=new THREE.AxesHelper(.35);scene.add(axes);const root=new THREE.Group();scene.add(root);
 const cubeGeometry=new THREE.BoxGeometry(1,1,1),voxelMaterial=new THREE.MeshStandardMaterial({color:0x71b3f5,roughness:.75,metalness:0}),pointsMaterial=new THREE.PointsMaterial({size:3,sizeAttenuation:false,vertexColors:true,transparent:true,opacity:.5,depthWrite:false}),boxMaterial=new THREE.LineBasicMaterial({color:0x8197ac,transparent:true,opacity:.5});
 const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2(),matrix=new THREE.Matrix4(),scaleVector=new THREE.Vector3(),positionVector=new THREE.Vector3(),quaternion=new THREE.Quaternion();
 let grid=null,mode='volume',neighbours=false,sliceAxis='z',sliceIndex=12,drawnNeighbours=null,object=null,bounds=null,sliceTexture=null,sliceMaterial=null,volume=null,volumeSettings=DEFAULT_VOLUME_SETTINGS,disposed=false,width=1,height=1,lastGrid=null,lastMode=null,lastNeighbours=null,downPoint=null,offsets=[];
 function render(){if(!disposed)renderer.render(scene,camera);}
 controls.addEventListener('change',render);
 function releaseObject(){if(object){root.remove(object);if(volume){volume.dispose();volume=null;}else if(object.isInstancedMesh)object.dispose();else object.geometry.dispose();object=null;}sliceMaterial?.dispose();sliceTexture?.dispose();sliceMaterial=sliceTexture=null;}
 function resize(){width=Math.max(1,canvas.clientWidth);height=Math.max(1,canvas.clientHeight);const half=neighbours&&mode!=='slice'?1.8:1.0,aspect=width/height;camera.left=-half*aspect;camera.right=half*aspect;camera.top=half;camera.bottom=-half;camera.updateProjectionMatrix();renderer.setSize(width,height,false);render();}
 function fit(){const c=neighbours&&mode!=='slice'?1:.5;controls.target.set(c,c,c);camera.position.set(c+2.6,c-3.3,c+2.5);camera.zoom=1;resize();controls.update();}
 function drawBounds(){if(bounds){root.remove(bounds);bounds.geometry.dispose();}const values=[],corners=[[0,0,0],[1,0,0],[1,1,0],[0,1,0],[0,0,1],[1,0,1],[1,1,1],[0,1,1]],edges=[[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]];for(const o of offsets)for(const [a,b] of edges)values.push(...corners[a].map((v,i)=>v+o[i]),...corners[b].map((v,i)=>v+o[i]));const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(values,3));bounds=new THREE.LineSegments(geometry,boxMaterial);root.add(bounds);}
 function drawSlice(){
  const slice=gridSlice(grid,sliceAxis,sliceIndex),m=grid.resolution+1,rgba=new Uint8Array(m*m*4),range=Math.max(Math.abs(grid.min),Math.abs(grid.max));for(let i=0;i<slice.values.length;i++){rgba.set(fieldRgb(slice.values[i],range),i*4);rgba[i*4+3]=255;}
  sliceTexture=new THREE.DataTexture(rgba,m,m);sliceTexture.magFilter=THREE.NearestFilter;sliceTexture.minFilter=THREE.NearestFilter;sliceTexture.colorSpace=THREE.SRGBColorSpace;sliceTexture.needsUpdate=true;sliceMaterial=new THREE.MeshBasicMaterial({map:sliceTexture,side:THREE.DoubleSide});
  object=new THREE.Mesh(new THREE.PlaneGeometry(1,1),sliceMaterial);const u=sliceAxis==='x'?new THREE.Vector3(0,1,0):new THREE.Vector3(1,0,0),v=sliceAxis==='z'?new THREE.Vector3(0,1,0):new THREE.Vector3(0,0,1),normal=u.clone().cross(v);object.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(u,v,normal));object.position.set(.5,.5,.5);object.position[sliceAxis]=slice.position;root.add(object);
 }
 function rebuild(){
  releaseObject();offsets=neighbours&&mode!=='slice'?[[0,0,0],[1,0,0],[0,1,0],[1,1,0],[0,0,1],[1,0,1],[0,1,1],[1,1,1]]:[[0,0,0]];drawBounds();if(!grid){render();return;}
  const n=grid.resolution,m=n+1;
  if(mode==='volume'){volume=createTpmsVolume(grid,neighbours?2:1);object=volume.mesh;volume.update(volumeSettings);root.add(object);render();return;}
  if(mode==='slice'){drawSlice();render();return;}
  if(mode==='cells'){
   const count=grid.cells.length*offsets.length;if(count>262144)throw Error('This neighbour view exceeds the display budget. Reduce preview resolution.');
   object=new THREE.InstancedMesh(cubeGeometry,voxelMaterial,count);scaleVector.setScalar(.94/n);let instance=0;for(const offset of offsets)for(const index of grid.cells){const p=cellGridCoordinates(index,n);positionVector.set((p[0]+.5)/n+offset[0],(p[1]+.5)/n+offset[1],(p[2]+.5)/n+offset[2]);matrix.compose(positionVector,quaternion,scaleVector);object.setMatrixAt(instance++,matrix);}object.instanceMatrix.needsUpdate=true;object.computeBoundingSphere();
  }else{
   const count=grid.values.length*offsets.length,positions=new Float32Array(count*3),colors=new Float32Array(count*3),range=Math.max(Math.abs(grid.min),Math.abs(grid.max));let out=0;
   for(const offset of offsets)for(let k=0;k<=n;k++)for(let j=0;j<=n;j++)for(let i=0;i<=n;i++){const idx=i+m*(j+m*k);positions.set([i/n+offset[0],j/n+offset[1],k/n+offset[2]],out*3);colors.set(fieldRgb(grid.values[idx],range).map(v=>linearRgb[v]),out*3);out++;}
   const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));object=new THREE.Points(geometry,pointsMaterial);
  }root.add(object);render();
 }
 function update(next){
  if(disposed)return;grid=next.grid;mode=next.mode;neighbours=next.neighbours;volumeSettings={...DEFAULT_VOLUME_SETTINGS,...next.volume};sliceAxis=next.sliceAxis;sliceIndex=Math.max(0,Math.min(grid?.resolution||24,next.sliceIndex));const effective=neighbours&&mode!=='slice';
  // Keep ray casting responsive on high-DPI displays without changing grid data.
  renderer.setPixelRatio(mode==='volume'?1:Math.min(devicePixelRatio||1,2));
  if(lastGrid!==grid||lastMode!==mode||lastNeighbours!==effective||mode==='slice'){rebuild();lastGrid=grid;lastMode=mode;lastNeighbours=effective;}
  if(volume){volume.update(volumeSettings);render();}
  if(drawnNeighbours!==effective){drawnNeighbours=effective;fit();}
 }
 function point(e){const r=canvas.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top};}
 function down(e){downPoint={x:e.clientX,y:e.clientY};}
 function up(e){if(!grid||!object||!downPoint||Math.hypot(e.clientX-downPoint.x,e.clientY-downPoint.y)>4){downPoint=null;return;}downPoint=null;const p=point(e);pointer.set(p.x/width*2-1,1-p.y/height*2);raycaster.setFromCamera(pointer,camera);
  if(mode==='volume'){const sample=probeVolume(grid,raycaster.ray.origin.toArray(),raycaster.ray.direction.toArray(),volumeSettings,neighbours?2:1);if(sample)onProbe(sample);return;}
  raycaster.params.Points.threshold=.3/grid.resolution;const hit=raycaster.intersectObject(object,false)[0];if(!hit)return;
  const n=grid.resolution,m=n+1;
  if(mode==='cells'){const origin=offsets[Math.floor(hit.instanceId/grid.cells.length)],idx=grid.cells[hit.instanceId%grid.cells.length],indices=cellGridCoordinates(idx,n);onProbe({kind:'cell',indices,origin,position:indices.map(v=>(v+.5)/n),range:cellRange(indices)});}
  else if(mode==='points'){const idx=hit.index%grid.values.length,i=idx%m,j=Math.floor(idx/m)%m,k=Math.floor(idx/(m*m));onProbe({kind:'sample',indices:[i,j,k],position:[i/n,j/n,k/n],value:grid.values[idx]});}
  else onProbe({kind:'sample',...nearestGridValue(grid,hit.point.toArray())});
 }
 function cellRange([i,j,k]){let min=Infinity,max=-Infinity;const m=grid.resolution+1;for(let dz=0;dz<2;dz++)for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++){const v=grid.values[i+dx+m*(j+dy+m*(k+dz))];min=Math.min(min,v);max=Math.max(max,v);}return[min,max];}
 canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointerup',up);const observer=new ResizeObserver(resize);observer.observe(canvas);resize();
 return{update,fit,dispose(){if(disposed)return;disposed=true;observer.disconnect();controls.dispose();canvas.removeEventListener('pointerdown',down);canvas.removeEventListener('pointerup',up);releaseObject();bounds?.geometry.dispose();cubeGeometry.dispose();voxelMaterial.dispose();pointsMaterial.dispose();boxMaterial.dispose();axes.geometry.dispose();axes.material.dispose();renderer.dispose();renderer.forceContextLoss();}};
}
