import * as THREE from './vendor/three.module.js';
import {OrbitControls} from './vendor/addons/controls/OrbitControls.js';
import {strutDomainGeometry,isSurfaceCellDomain} from './strut-cell-model.js';
import {meshFace,faceGeometry,constrainMeshDelta} from './mesh-cell-model.js';

export function createMeshCellViewport({canvas,labels,getState,onSelectFace,onSelectVertex,onBeginDrag,onDrag,onCommitDrag,onCancelDrag,onMessage}){
 const renderer=new THREE.WebGLRenderer({canvas,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));renderer.setClearColor(0x17232f);renderer.localClippingEnabled=true;
 const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-1,1,1,-1,.01,1e12);camera.up.set(0,0,1);const controls=new OrbitControls(camera,canvas);controls.enableDamping=false;controls.minZoom=.15;controls.maxZoom=15;
 scene.add(new THREE.HemisphereLight(0xffffff,0x4d617a,2.4));const light=new THREE.DirectionalLight(0xffffff,2.4);light.position.set(2,-3,5);scene.add(light);
 const group=new THREE.Group();scene.add(group);scene.add(new THREE.AxesHelper(.3));
 const material=new THREE.MeshStandardMaterial({color:0x8ab8ee,roughness:.55,metalness:.08,side:THREE.DoubleSide,transparent:true}),edgeMaterial=new THREE.LineBasicMaterial({color:0x9ac7fa,transparent:true,opacity:.6}),boundsMaterial=new THREE.LineBasicMaterial({color:0x91a7ba,transparent:true,opacity:.65}),selectedMaterial=new THREE.MeshStandardMaterial({color:0xeeb54e,side:THREE.DoubleSide,transparent:true,opacity:.68,depthWrite:false}),badMaterial=new THREE.LineBasicMaterial({color:0xf07b72,depthTest:false}),pointMaterial=new THREE.PointsMaterial({color:0xff776b,size:7,sizeAttenuation:false,depthTest:false}),handleMaterial=new THREE.MeshStandardMaterial({color:0xffcc65}),sphere=new THREE.SphereGeometry(.018,12,8);
 const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2(),matrix=new THREE.Matrix4();let state=null,meshObject=null,edges=null,bounds=null,selected=null,handles=null,normals=null,badEdges=null,badPoints=null,lastMesh=null,lastDomain=null,lastType=null,width=1,height=1,half=1,gesture=null,disposed=false,handleIndices=[];
 function line(values,mat){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(values,3));return new THREE.LineSegments(g,mat);}
 function release(object,shared=false){if(!object)return;group.remove(object);if(object.isInstancedMesh)object.dispose();if(!shared)object.geometry?.dispose();}
 function render(){if(disposed)return;renderer.render(scene,camera);if(labels){labels.replaceChildren();if(state?.type==='Geom-Plate')for(const id of handleIndices){const p=state.mesh.vertices[id];if(!visible(p))continue;const point=new THREE.Vector3(...p).project(camera),x=(point.x+1)*width/2,y=(1-point.y)*height/2;if(x<0||x>width-20||y<12||y>height)continue;const label=document.createElement('span');label.textContent='N'+(id+1);label.translate=false;label.style.left=(x+7)+'px';label.style.top=(y-17)+'px';if(state.selection.vertex===id)label.className='active';labels.append(label);}}}
 function resize(){width=Math.max(1,canvas.clientWidth);height=Math.max(1,canvas.clientHeight);const aspect=width/height;camera.left=-half*aspect;camera.right=half*aspect;camera.top=half;camera.bottom=-half;camera.updateProjectionMatrix();renderer.setSize(width,height,false);render();}
 function fit(){const b=state?.analysis.bounds,min=[0,0,0],max=[1,1,isSurfaceCellDomain(state?.domain)?0:1];if(b)for(let a=0;a<3;a++){min[a]=Math.min(min[a],b.min[a]);max[a]=Math.max(max[a],b.max[a]);}const centre=min.map((v,a)=>(v+max[a])/2),span=Math.max(...max.map((v,a)=>v-min[a]));half=Math.max(.7,span*.9);controls.target.set(...centre);camera.position.set(centre[0]+span*2.7,centre[1]-span*3.4,centre[2]+span*2.5);camera.zoom=1;resize();controls.update();}
 function geometry(indices){const positions=[];for(const t of indices)for(const i of t)positions.push(...state.mesh.vertices[i]);const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.computeVertexNormals();return g;}
 function rebuild(){
  for(const o of [meshObject,edges,bounds,badEdges,badPoints])release(o);meshObject=edges=bounds=badEdges=badPoints=null;
  const reference=strutDomainGeometry(state.domain),lines=[];for(const [a,b] of reference.edges)lines.push(...reference.corners[a],...reference.corners[b]);bounds=line(lines,boundsMaterial);group.add(bounds);
  if(state.analysis.triangles.length){const g=geometry(state.analysis.triangles);meshObject=new THREE.Mesh(g,material);group.add(meshObject);edges=new THREE.LineSegments(state.type==='Geom-Plate'?new THREE.WireframeGeometry(g):new THREE.EdgesGeometry(g,25),edgeMaterial);group.add(edges);}
  const bad=[];for(const [a,b] of state.analysis.badEdges)bad.push(...state.mesh.vertices[a],...state.mesh.vertices[b]);badEdges=line(bad,badMaterial);badEdges.renderOrder=5;group.add(badEdges);
  const p=[];for(const i of state.analysis.outside)p.push(...state.mesh.vertices[i]);const pg=new THREE.BufferGeometry();pg.setAttribute('position',new THREE.Float32BufferAttribute(p,3));badPoints=new THREE.Points(pg,pointMaterial);badPoints.renderOrder=5;group.add(badPoints);
 }
 function selection(){
  release(selected);release(handles,true);selected=handles=null;handleIndices=[];
  if(normals){group.remove(normals);normals.traverse(o=>{o.geometry?.dispose();if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();});normals=null;}
  const f=meshFace(state.mesh,state.selection.face),info=f&&state.analysis.faceInfo.get(f.id);if(!info)return;
  selected=new THREE.Mesh(geometry(info.triangles),selectedMaterial);selected.renderOrder=2;group.add(selected);
  if(state.type==='Geom-Plate'){
   handleIndices=f.indices;handles=new THREE.InstancedMesh(sphere,handleMaterial,handleIndices.length);handleIndices.forEach((id,i)=>{matrix.makeTranslation(...state.mesh.vertices[id]);handles.setMatrixAt(i,matrix);handles.setColorAt(i,new THREE.Color(state.selection.vertex===id?0xfff3ca:0xffbd47));});handles.renderOrder=3;group.add(handles);
  }
  if(state.normals){normals=new THREE.Group();normals.renderOrder=6;normals.add(new THREE.ArrowHelper(new THREE.Vector3(...info.normal),new THREE.Vector3(...info.centre),.23,0xffdf78,.055,.028));normals.traverse(o=>{o.renderOrder=6;if(o.material){o.material.depthTest=false;o.material.transparent=true;}});group.add(normals);}
 }
 function update(next){if(disposed)return;state=next;const changed=lastMesh!==state.mesh||lastDomain!==state.domain||lastType!==state.type;if(changed){rebuild();lastMesh=state.mesh;lastType=state.type;}const domainChanged=lastDomain!==state.domain;lastDomain=state.domain;
  const planes=state.section?[new THREE.Plane(new THREE.Vector3(...[0,1,2].map(a=>a===state.sectionAxis?-1:0)),state.sectionPosition)]:[];
  for(const mat of [material,edgeMaterial,selectedMaterial,handleMaterial])mat.clippingPlanes=planes;
  material.opacity=state.type==='Geom-Plate'?.48:1;material.depthWrite=state.type!=='Geom-Plate';if(edges)edges.visible=state.edges;if(badEdges)badEdges.visible=state.showIssues;if(badPoints)badPoints.visible=state.showIssues;selection();if(domainChanged)fit();else render();
 }
 function position(e){const r=canvas.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top};}
 function ray(e){const p=position(e);pointer.set(p.x/width*2-1,1-p.y/height*2);raycaster.setFromCamera(pointer,camera);return raycaster.ray;}
 function visible(p){return !state.section||p[state.sectionAxis]<=state.sectionPosition+1e-9;}
 function hitVertex(e){const p=position(e);let id=null,distance=14;if(state.type!=='Geom-Plate')return null;for(const index of handleIndices){const point=state.mesh.vertices[index];if(!visible(point))continue;const s=new THREE.Vector3(...point).project(camera),d=Math.hypot((s.x+1)*width/2-p.x,(1-s.y)*height/2-p.y);if(d<distance){id=index;distance=d;}}return id;}
 function hitFace(e){if(!meshObject)return null;ray(e);const hits=raycaster.intersectObject(meshObject,false);return hits.find(h=>visible(h.point.toArray()))||null;}
 function down(e){if(e.button!==0||disposed||getState().busy)return;const s=getState(),vertex=hitVertex(e),hit=vertex===null?hitFace(e):null,id=vertex!==null?s.selection.face:hit?s.analysis.triangleFaces[hit.faceIndex]:null;
  if(id===null)return;const wasSelected=s.selection.face===id;if(vertex!==null)onSelectVertex(vertex);else onSelectFace(id);controls.enabled=false;canvas.setPointerCapture(e.pointerId);
  if(s.type!=='Geom-Plate'||vertex===null&&!wasSelected){gesture={kind:'pick'};return;}
  const face=meshFace(s.mesh,id),info=faceGeometry(s.mesh,face),plane=new THREE.Plane().setFromNormalAndCoplanarPoint(new THREE.Vector3(...info.normal),new THREE.Vector3(...info.centre)),start=ray(e).intersectPlane(plane,new THREE.Vector3());
  if(!start){gesture={kind:'pick'};onMessage('The plate is edge-on. Rotate the view before dragging.');return;}
  gesture={kind:vertex!==null?'vertex':'face',id,vertex,plane,start,original:vertex!==null?[...s.mesh.vertices[vertex]]:null,points:(vertex!==null?[vertex]:face.indices).map(i=>[...s.mesh.vertices[i]]),x:e.clientX,y:e.clientY,moved:false};onBeginDrag();
 }
 function move(e){const g=gesture;if(!g||g.kind==='pick')return;if(!g.moved&&Math.hypot(e.clientX-g.x,e.clientY-g.y)<3)return;const point=ray(e).intersectPlane(g.plane,new THREE.Vector3());if(!point)return;g.moved=true;const delta=constrainMeshDelta(getState().domain,g.points,point.sub(g.start).toArray());onDrag(g.kind==='vertex'?{kind:g.kind,index:g.vertex,position:g.original.map((v,a)=>v+delta[a])}:{kind:g.kind,id:g.id,delta});}
 function up(e){const g=gesture;gesture=null;controls.enabled=true;if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);if(g&&g.kind!=='pick')onCommitDrag();}
 function cancel(){if(gesture&&gesture.kind!=='pick')onCancelDrag();gesture=null;controls.enabled=true;render();}
 canvas.addEventListener('pointerdown',down,true);canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',cancel);controls.addEventListener('change',render);const observer=new ResizeObserver(resize);observer.observe(canvas);resize();
 return{update,fit,cancel,dispose(){if(disposed)return;cancel();disposed=true;observer.disconnect();controls.dispose();for(const [event,handler,capture] of [['pointerdown',down,true],['pointermove',move,false],['pointerup',up,false],['pointercancel',cancel,false]])canvas.removeEventListener(event,handler,capture);for(const o of [meshObject,edges,bounds,selected,badEdges,badPoints])release(o);release(handles,true);if(normals)normals.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});for(const mat of [material,edgeMaterial,boundsMaterial,selectedMaterial,badMaterial,pointMaterial,handleMaterial])mat.dispose();sphere.dispose();renderer.dispose();renderer.forceContextLoss();}};
}
