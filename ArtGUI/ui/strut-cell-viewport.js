import * as THREE from './vendor/three.module.js';
import {OrbitControls} from './vendor/addons/controls/OrbitControls.js';
import {strutDomainGeometry,isStrutPoint,constrainStrutDrag} from './strut-cell-model.js';

// A dedicated cell scene leaves the main model, camera and result layers intact.
export function createStrutCellViewport({canvas,labels,getState,onSelect,onNodeClick,onConnectionClick,onConnect,onBeginDrag,onDrag,onCommitDrag,onCancelDrag,onMessage}){
 const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false});renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));renderer.setClearColor(0x17232f);
 const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-1,1,1,-1,.01,100);camera.up.set(0,0,1);
 const controls=new OrbitControls(camera,canvas);controls.enableDamping=false;controls.minZoom=.3;controls.maxZoom=8;
 const root=new THREE.Group();scene.add(root);scene.add(new THREE.HemisphereLight(0xffffff,0x334155,2.4));
 const light=new THREE.DirectionalLight(0xffffff,2.5);light.position.set(2,-3,5);scene.add(light);
 const sphere=new THREE.SphereGeometry(.024,12,8),nodeMaterial=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.4});
 const lineMaterial=new THREE.LineBasicMaterial({color:0x70adf5}),ghostMaterial=new THREE.LineBasicMaterial({color:0x70adf5,transparent:true,opacity:.24}),boxMaterial=new THREE.LineBasicMaterial({color:0x668296,transparent:true,opacity:.55});
 const selectionMaterial=new THREE.MeshStandardMaterial({color:0xffb653,roughness:.5}),cylinder=new THREE.CylinderGeometry(.014,.014,1,10);
 const draftMaterial=new THREE.LineDashedMaterial({color:0xffb653,dashSize:.04,gapSize:.025});
 const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2(),matrix=new THREE.Matrix4(),yAxis=new THREE.Vector3(0,1,0);
 let state=null,nodeMesh=null,lineMesh=null,ghostMesh=null,boxMesh=null,highlight=null,draftLine=null,width=1,height=1,gesture=null,disposed=false,framedNeighbours=null,framedDomain=null;
 const domainOf=()=>state?.cell.base.definition.ladomain||'Hex',hasNeighbours=()=>state?.neighbours&&domainOf()==='Hex';
 const v=p=>new THREE.Vector3(...p),node=id=>getState().cell.nodes.find(n=>n.id===id);
 function disposeObject(object){if(!object)return;root.remove(object);if(object.isInstancedMesh)object.dispose();if(object!==nodeMesh&&object!==highlight)object.geometry?.dispose();}
 function lineObject(values,material){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(values,3));return new THREE.LineSegments(g,material);}
 function draw(){if(disposed)return;renderer.render(scene,camera);updateLabels();}
 function updateLabels(){if(!state)return;const ids=state.cell.nodes.length<=60?state.cell.nodes:state.cell.nodes.filter(n=>n.id===state.selection?.id||n.id===state.pending);labels.replaceChildren();for(const n of ids){const p=v(n.position).project(camera);if(p.z< -1||p.z>1)continue;const x=(p.x+1)*width/2,y=(1-p.y)*height/2;if(x<0||x>width-25||y<8||y>height-18)continue;const label=document.createElement('span');label.textContent='N'+n.id;label.translate=false;label.style.left=(x+9)+'px';label.style.top=(y-16)+'px';if(state.selection?.kind==='node'&&state.selection.id===n.id)label.className='active';labels.append(label);}}
 function fit(){
  if(!state)return;
  const domain=domainOf(),outside=state.cell.nodes.some(n=>!isStrutPoint(n.position,domain));
  const centre=hasNeighbours()?[1,1,1]:outside?[.5,.5,.5]:strutDomainGeometry(domain).centre;
  controls.target.set(...centre);
  camera.position.set(centre[0]+2.7,centre[1]-3.4,centre[2]+2.5);
  camera.zoom=1;resize();controls.update();
 }
 function resize(){width=Math.max(1,canvas.clientWidth);height=Math.max(1,canvas.clientHeight);const half=hasNeighbours()?1.9:1.02,aspect=width/height;camera.left=-half*aspect;camera.right=half*aspect;camera.top=half;camera.bottom=-half;camera.updateProjectionMatrix();renderer.setSize(width,height,false);draw();}
 function update(next){
  state=next;for(const object of [nodeMesh,lineMesh,ghostMesh,boxMesh,highlight,draftLine])disposeObject(object);nodeMesh=lineMesh=ghostMesh=boxMesh=highlight=draftLine=null;
  if(state.cell.nodes.length){nodeMesh=new THREE.InstancedMesh(sphere,nodeMaterial,state.cell.nodes.length);state.cell.nodes.forEach((n,i)=>{matrix.makeTranslation(...n.position);nodeMesh.setMatrixAt(i,matrix);nodeMesh.setColorAt(i,new THREE.Color(!isStrutPoint(n.position,domainOf())?0xf0716b:state.selection?.kind==='node'&&state.selection.id===n.id||state.pending===n.id?0xffb653:0xdae7f7));});root.add(nodeMesh);}
  const positions=[];for(const e of state.cell.connections){const a=node(e.start),b=node(e.end);if(a&&b)positions.push(...a.position,...b.position);}lineMesh=lineObject(positions,lineMaterial);root.add(lineMesh);
  const offsets=hasNeighbours()?[[0,0,0],[1,0,0],[0,1,0],[0,0,1],[1,1,0],[1,0,1],[0,1,1],[1,1,1]]:[[0,0,0]],boxes=[],ghost=[];
  const {corners,edges}=strutDomainGeometry(domainOf());
  offsets.forEach((o,index)=>{for(const [a,b] of edges)boxes.push(...corners[a].map((x,i)=>x+o[i]),...corners[b].map((x,i)=>x+o[i]));if(index)for(let i=0;i<positions.length;i+=3)ghost.push(positions[i]+o[0],positions[i+1]+o[1],positions[i+2]+o[2]);});
  boxMesh=lineObject(boxes,boxMaterial);root.add(boxMesh);if(ghost.length){ghostMesh=lineObject(ghost,ghostMaterial);root.add(ghostMesh);}
  if(state.selection?.kind==='connection'){const e=state.cell.connections.find(e=>e.id===state.selection.id),a=e&&node(e.start),b=e&&node(e.end);if(a&&b){const start=v(a.position),end=v(b.position),delta=end.clone().sub(start);highlight=new THREE.Mesh(cylinder,selectionMaterial);highlight.position.copy(start).add(end).multiplyScalar(.5);highlight.scale.y=delta.length();if(delta.lengthSq())highlight.quaternion.setFromUnitVectors(yAxis,delta.normalize());root.add(highlight);}}
  if(framedNeighbours!==hasNeighbours()||framedDomain!==domainOf()){framedNeighbours=hasNeighbours();framedDomain=domainOf();fit();}else draw();
 }
 function screen(p){const a=v(p).project(camera);return{x:(a.x+1)*width/2,y:(1-a.y)*height/2,z:a.z};}
 function location(e){const r=canvas.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top};}
 function ray(e){const p=location(e);pointer.set(p.x/width*2-1,1-p.y/height*2);raycaster.setFromCamera(pointer,camera);return raycaster.ray;}
 function hitNode(e,except=null){const p=location(e);let best=null,score=Infinity;for(const n of getState().cell.nodes){if(n.id===except)continue;const a=screen(n.position),d=Math.hypot(p.x-a.x,p.y-a.y);if(d<=15&&d+a.z*.01<score){best=n.id;score=d+a.z*.01;}}return best;}
 function hitConnection(e){const p=location(e);let best=null,dist=9;for(const edge of getState().cell.connections){const a=node(edge.start),b=node(edge.end);if(!a||!b)continue;const x=screen(a.position),y=screen(b.position),dx=y.x-x.x,dy=y.y-x.y,t=Math.max(0,Math.min(1,((p.x-x.x)*dx+(p.y-x.y)*dy)/(dx*dx+dy*dy||1))),d=Math.hypot(p.x-x.x-t*dx,p.y-x.y-t*dy);if(d<dist){dist=d;best=edge.id;}}return best;}
 function hoverDraft(e,source){disposeObject(draftLine);draftLine=null;const a=node(source);if(!a)return;const target=hitNode(e,source),normal=camera.getWorldDirection(new THREE.Vector3()),plane=new THREE.Plane().setFromNormalAndCoplanarPoint(normal,v(a.position)),point=target!==null?v(node(target).position):ray(e).intersectPlane(plane,new THREE.Vector3());if(point){draftLine=lineObject([...a.position,...point.toArray()],draftMaterial);draftLine.computeLineDistances();root.add(draftLine);}draw();}
 function down(e){if(e.button!==0||disposed)return;const s=getState(),id=hitNode(e),edge=id===null?hitConnection(e):null;
  if(id===null){gesture={type:'background',x:e.clientX,y:e.clientY,edge};return;}
  if(s.rewire){controls.enabled=false;canvas.setPointerCapture(e.pointerId);gesture={type:'pick',id};return;}
  if(s.mode==='connect'){controls.enabled=false;canvas.setPointerCapture(e.pointerId);gesture={type:'connect',id,x:e.clientX,y:e.clientY};hoverDraft(e,id);return;}
  onSelect({kind:'node',id});controls.enabled=false;canvas.setPointerCapture(e.pointerId);
  const original=v(node(id).position),constraint=s.constraint,normal=new THREE.Vector3(),direction=camera.getWorldDirection(new THREE.Vector3());
  if(constraint.length===1){const axis=new THREE.Vector3(...['x','y','z'].map(a=>a===constraint?1:0));normal.copy(direction).addScaledVector(axis,-direction.dot(axis));if(normal.lengthSq()<.0001){onMessage('This axis points into the view. Rotate the cell before dragging.');gesture={type:'pick',id};return;}normal.normalize();}
  else normal.set(...['x','y','z'].map(a=>constraint.includes(a)?0:1));
  const plane=new THREE.Plane().setFromNormalAndCoplanarPoint(normal,original),start=ray(e).intersectPlane(plane,new THREE.Vector3());
  if(!start){gesture={type:'pick',id};onMessage('The movement plane is edge-on. Rotate the cell first.');return;}
  gesture={type:'move',id,original,start,plane,constraint,snap:s.snap,x:e.clientX,y:e.clientY,moved:false};onBeginDrag();
 }
 function move(e){const g=gesture,s=getState();if(g?.type==='move'){
   if(Math.hypot(e.clientX-g.x,e.clientY-g.y)<3&&!g.moved)return;g.moved=true;const p=ray(e).intersectPlane(g.plane,new THREE.Vector3());if(!p)return;const delta=p.sub(g.start),out=g.original.clone();for(const axis of ['x','y','z'])if(g.constraint.includes(axis)){let value=g.original[axis]+delta[axis];if(g.snap)value=Math.round(value/g.snap)*g.snap;out[axis]=Math.max(0,Math.min(1,+value.toFixed(10)));}onDrag(g.id,constrainStrutDrag(s.cell.base.definition.ladomain,g.original.toArray(),out.toArray(),g.constraint));return;
  }
  const source=g?.type==='connect'?g.id:s.pending??(s.rewire?s.cell.connections.find(e=>e.id===s.rewire.id)?.[s.rewire.endpoint==='start'?'end':'start']:null);if(source!=null)hoverDraft(e,source);
  canvas.style.cursor=hitNode(e)!==null?(s.mode==='connect'||s.rewire?'crosshair':'grab'):hitConnection(e)!==null?'crosshair':'grab';
 }
 function up(e){const g=gesture;gesture=null;controls.enabled=true;if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);disposeObject(draftLine);draftLine=null;if(!g)return;
  if(g.type==='move'){onCommitDrag();return;}
  if(g.type==='connect'){const target=hitNode(e,g.id),dragged=Math.hypot(e.clientX-g.x,e.clientY-g.y)>4;if(dragged&&target!==null)onConnect(g.id,target);else onNodeClick(g.id);return;}
  if(g.type==='pick'){onNodeClick(g.id);return;}
  if(g.edge!==null&&Math.hypot(e.clientX-g.x,e.clientY-g.y)<4)onConnectionClick(g.edge);
 }
 function cancel(){if(gesture?.type==='move')onCancelDrag();gesture=null;controls.enabled=true;disposeObject(draftLine);draftLine=null;draw();}
 // Capture precedes OrbitControls so edits do not rotate the camera as well.
 canvas.addEventListener('pointerdown',down,true);canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',cancel);controls.addEventListener('change',draw);
 const observer=new ResizeObserver(resize);observer.observe(canvas);resize();
 return{update,fit,cancel,dispose(){if(disposed)return;cancel();disposed=true;observer.disconnect();controls.dispose();for(const [type,fn,capture] of [['pointerdown',down,true],['pointermove',move,false],['pointerup',up,false],['pointercancel',cancel,false]])canvas.removeEventListener(type,fn,capture);for(const o of [nodeMesh,lineMesh,ghostMesh,boxMesh,highlight,draftLine])disposeObject(o);for(const resource of [sphere,cylinder,nodeMaterial,lineMaterial,ghostMaterial,boxMaterial,selectionMaterial,draftMaterial])resource.dispose();renderer.dispose();renderer.forceContextLoss();labels.replaceChildren();}};
}
