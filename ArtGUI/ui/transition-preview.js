import * as THREE from './vendor/three.module.js';
import {axisQuaternion} from './spatial-model.js';
import {transitionColours} from './transition-model.js';

// This scene contains only editable input guides, never a fabricated lattice result.
export function transitionGuideScene(targets,selected,domain){
 const group=new THREE.Group(),pickable=[],bounds=new THREE.Box3();
 for(const [i,target] of targets.entries()){
  const g=target.geometry,color=transitionColours[i%transitionColours.length],geometry=g.type==='Sphere'?new THREE.SphereGeometry(g.radius,32,20):new THREE.BoxGeometry(...g.size);
  const chosen=target.id===(typeof selected==='string'?selected:selected?.id);
  const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color,transparent:true,opacity:chosen ? .2 : .12,side:THREE.DoubleSide,depthWrite:false}));
  mesh.position.fromArray(g.center);if(g.type==='Box')mesh.quaternion.copy(axisQuaternion(g));mesh.userData.target=target.id;pickable.push(mesh);group.add(mesh);
  const coarse=g.type==='Sphere'?new THREE.SphereGeometry(g.radius,12,8):null;
  const edges=coarse?new THREE.WireframeGeometry(coarse):new THREE.EdgesGeometry(geometry);coarse?.dispose();
  const line=new THREE.LineSegments(edges,new THREE.LineBasicMaterial({color,transparent:true,opacity:g.type==='Sphere' ? .25 : .7}));line.position.copy(mesh.position);line.quaternion.copy(mesh.quaternion);group.add(line);
  if(target.kind==='plane'){const normal=new THREE.Vector3(0,0,1).applyQuaternion(axisQuaternion(g)),arrow=new THREE.ArrowHelper(normal,mesh.position,Math.max(g.size[0],g.size[1])*.28,color);arrow.traverse(o=>{if(o.geometry)o.geometry=o.geometry.clone();});group.add(arrow);}
  if(target.kind==='attractor'){const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...g.center),new THREE.Vector3(...g.center).add(new THREE.Vector3(g.radius,0,0))]),new THREE.LineBasicMaterial({color}));group.add(line);}
  mesh.updateMatrixWorld();bounds.union(new THREE.Box3().setFromObject(mesh));
 }
 if(Array.isArray(domain)&&domain.length===3&&domain.every(a=>a?.length===2&&a.every(Number.isFinite)&&a[1]>a[0])){
  const box=new THREE.Box3(new THREE.Vector3(...domain.map(a=>a[0])),new THREE.Vector3(...domain.map(a=>a[1])));bounds.union(box);group.add(new THREE.Box3Helper(box,0xcbd5e1));
 }
 if(bounds.isEmpty())bounds.set(new THREE.Vector3(-1,-1,-1),new THREE.Vector3(1,1,1));
 const origin=bounds.getCenter(new THREE.Vector3());group.position.copy(origin).negate();
 return {group,pickable,bounds:bounds.translate(origin.clone().negate()),dispose(){group.traverse(o=>{o.geometry?.dispose();for(const m of [].concat(o.material||[]))m.dispose();});}};
}

export function createTransitionPreview(canvas,onSelect){
 if(!canvas.ownerDocument.defaultView?.WebGLRenderingContext)return null;
 let renderer;try{renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false});}catch{return null;}
 renderer.setPixelRatio(Math.min(canvas.ownerDocument.defaultView.devicePixelRatio||1,2));
 const scene=new THREE.Scene();scene.background=new THREE.Color('#f8fafc');
 const camera=new THREE.PerspectiveCamera(35,2,.01,10000);camera.up.set(0,0,1);
 const labels=canvas.ownerDocument.createElement('div');labels.className='transition-mini-labels';labels.setAttribute('aria-hidden','true');
 let diagram=null,targets=[],selected=null,domain=null;
 function draw(){
  if(!canvas.isConnected||!diagram)return;
  const w=canvas.parentElement.clientWidth||350,h=175;renderer.setSize(w,h,false);camera.aspect=w/h;
  const radius=Math.max(diagram.bounds.getSize(new THREE.Vector3()).length()/2,.001),angle=Math.min(THREE.MathUtils.degToRad(17.5),Math.atan(Math.tan(THREE.MathUtils.degToRad(17.5))*camera.aspect));
  camera.position.copy(new THREE.Vector3(1.5,-2,1.3).normalize().multiplyScalar(radius/Math.sin(angle)*1.05));camera.near=Math.max(radius/10000,1e-7);camera.far=radius*100;camera.lookAt(0,0,0);camera.updateProjectionMatrix();renderer.render(scene,camera);
  [...labels.children].forEach((label,i)=>{const g=targets[i].geometry,p=new THREE.Vector3(...g.center).add(diagram.group.position);if(g.type==='Sphere')p.x+=g.radius;p.project(camera);label.style.left=`${(p.x+1)*w/2}px`;label.style.top=`${(1-p.y)*h/2}px`;label.hidden=p.z< -1||p.z>1;});
 }
 const observer=typeof ResizeObserver==='function'?new ResizeObserver(draw):null;observer?.observe(canvas.parentElement);
 const pick=e=>{if(!diagram)return;const rect=canvas.getBoundingClientRect(),ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,1-(e.clientY-rect.top)/rect.height*2),camera);const hit=ray.intersectObjects(diagram.pickable)[0];if(hit)onSelect(hit.object.userData.target);};
 canvas.addEventListener('click',pick);
 return {canvas,update(items,id,d){
  targets=items;selected=id;domain=d;observer?.disconnect();if(canvas.parentElement){observer?.observe(canvas.parentElement);canvas.parentElement.append(labels);}
  labels.replaceChildren();for(const target of targets){const label=canvas.ownerDocument.createElement('span');label.textContent=target.id==='plane:1'?'A':target.id==='plane:2'?'B':target.kind==='attractor'?'R':'Plane';if(target.id.startsWith('plane:')||target.kind==='attractor')label.translate=false;label.style.setProperty('--guide-colour',transitionColours[target.id==='plane:2'?1:0]);labels.append(label);}
  if(diagram){scene.remove(diagram.group);diagram.dispose();}diagram=transitionGuideScene(targets,selected,domain);scene.add(diagram.group);draw();
 },dispose(){observer?.disconnect();canvas.removeEventListener('click',pick);labels.remove();diagram?.dispose();renderer.dispose();renderer.forceContextLoss();}};
}
