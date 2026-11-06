import {createViewportMessage} from './viewport-message.js';
import {createPrecisionGizmo,precisionElement,projectPrecisionElement,precisionPlaneDelta,precisionColours} from './precision-gizmo.js';
import * as THREE from './vendor/three.module.js';
import {geometryType,geometryError,meshSource,unit} from './region-model.js';
import {effectiveMotion,maskRegions,transformPoint} from './morph-model.js';
import {cloneNumericJson} from './numeric-json.js';

const V=a=>new THREE.Vector3(...a),colours={domain:0x49c9b2,fixed:0x82b8ff,source:0xffd49a,target:0xffa43b};
const finite3=v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite);
export function createMorphOverlay(viewer,{onSelect,onDrag,onCommit,onCancel,toast}){
  const root=new THREE.Group();root.name='Morph region guides';viewer.scene.add(root);
  const labels=document.createElement('div');labels.className='region-labels morph-labels';labels.hidden=true;viewer.canvas.parentElement.append(labels);
  const legend=createViewportMessage(viewer,'region-legend morph-legend');
  const controller=new AbortController(),signal=controller.signal;
  let params=null,workflow=null,key=null,index=0,active=false,mode='translate',snap=0,show=true,drag=null,pick=false,handles=[],buttons=[],bounds=new THREE.Box3(),precision=null,toolAxis=2,rotationChange=0;
  const selected=()=>params?.moving_regions?.[index];
  const validMotion=raw=>{const r=effectiveMotion(raw);return finite3(r.translation)&&finite3(r.rotation_center)&&finite3(r.rotation_axis)&&Math.hypot(...r.rotation_axis)>0&&Number.isFinite(r.rotation_degrees);};
  function loaded(source){const norm=s=>String(s).replace(/^\\\\\?\\/,'').replaceAll('\\','/').toLowerCase();return [...viewer.layers.values()].find(l=>norm(l.path)===norm(source));}
  function clear(){precision=null;for(const child of [...root.children]){child.traverse(o=>{if(!o.userData.sharedMorphGeometry)o.geometry?.dispose();for(const m of [].concat(o.material||[]))m.dispose();});root.remove(child);}}
  function sourceObject(g,color,target=false){
    if(geometryError(g))return null;
    if(geometryType(g)==='Mesh'){
      const layer=loaded(meshSource(g));if(!layer)return null;const mesh=layer.mesh.clone(true);mesh.visible=true;mesh.position.add(viewer.origin);
      mesh.traverse(o=>{if(o.geometry)o.userData.sharedMorphGeometry=true;if(o.material)o.material=o.isLine?new THREE.LineBasicMaterial({color,transparent:true,opacity:target?.85:.3,depthWrite:false}):new THREE.MeshBasicMaterial({color,wireframe:true,transparent:true,opacity:target?.6:.2,depthWrite:false});});return mesh;
    }
    const shape=g.type==='Box'?new THREE.BoxGeometry(...g.size):g.type==='Sphere'?new THREE.SphereGeometry(g.radius,16,8):new THREE.CylinderGeometry(g.radius,g.radius,g.height,24,1,true);
    const wire=new THREE.LineSegments(g.type==='Box'?new THREE.EdgesGeometry(shape):new THREE.WireframeGeometry(shape),new THREE.LineBasicMaterial({color,transparent:true,opacity:target?1:.8,depthWrite:false}));shape.dispose();wire.position.fromArray(g.center);
    if(g.type==='Box')wire.quaternion.setFromAxisAngle(V(unit(g.rotation_axis||[0,0,1])),(g.rotation_degrees||0)*Math.PI/180);
    if(g.type==='Cylinder')wire.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),V(unit(g.axis||[0,0,1])));
    return wire;
  }
  function addMask(id,color,motion){const container=new THREE.Group();
    for(const r of maskRegions(workflow,key,id)){const obj=sourceObject(r?.geometry,color,!!motion);if(obj)container.add(obj);}
    if(!container.children.length)return null;
    if(motion){const r=effectiveMotion(motion);container.quaternion.setFromAxisAngle(V(unit(r.rotation_axis)),r.rotation_degrees*Math.PI/180);container.position.copy(V(r.rotation_center).sub(V(r.rotation_center).applyQuaternion(container.quaternion)).add(V(r.translation)));}
    root.add(container);container.updateWorldMatrix(true,true);
    // Bounds are measured in model coordinates, independently of the viewer origin.
    const box=new THREE.Box3().setFromObject(container);box.translate(root.position.clone().negate());bounds.union(box);return box;
  }
  function maskCenter(){if(!selected())return null;const b=new THREE.Box3();
    for(const r of maskRegions(workflow,key,selected().mask)){const obj=sourceObject(r?.geometry,colours.source);if(!obj)continue;obj.updateWorldMatrix(true,true);b.union(new THREE.Box3().setFromObject(obj));obj.traverse(o=>{if(!o.userData.sharedMorphGeometry)o.geometry?.dispose();for(const m of [].concat(o.material||[]))m.dispose();});}
    return b.isEmpty()?null:b.getCenter(new THREE.Vector3()).toArray();
  }
  function line(points,color){const l=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color,transparent:true,opacity:.85,depthTest:false}));root.add(l);}
  function rebuild(){
    clear();bounds.makeEmpty();handles=[];if(!active)return;
    root.position.set(0,0,0);
    if(show){addMask(params.domain_mask,colours.domain);if(params.fixed_mask)addMask(params.fixed_mask,colours.fixed);}
    const motions=Array.isArray(params.moving_regions)?params.moving_regions:[];
    motions.forEach((raw,i)=>{
      if(!validMotion(raw))return;const r=effectiveMotion(raw);let source=null,target=null;
      if(show){source=addMask(r.mask,colours.source);target=addMask(r.mask,colours.target,r);}
      const center=source?.getCenter(new THREE.Vector3())||V(r.rotation_center),destination=V(transformPoint(center.toArray(),r));
      if(show){line([center,destination],colours.target);handles.push({name:`${r.mask||`Movement ${i+1}`} · target`,mask:r.mask,movementIndex:i+1,point:destination,kind:i===index&&mode==='translate'?'free':'select',index:i,precisionCenter:i===index});}
      if(i!==index||!show)return;
      const pivot=mode==='rotate'?V(r.rotation_center).add(V(r.translation)):destination;
      if(mode==='rotate')bounds.expandByPoint(pivot);
      precision=createPrecisionGizmo(viewer,{center:pivot,mode:mode==='rotate'?'rotate':'move',axis:toolAxis,delta:rotationChange,index:i});
      root.add(precision.group);handles.push(...precision.handles);precision.setActive(drag?.h.key||null);
    });
    root.position.copy(viewer.origin).negate();
    if(!drag){labels.replaceChildren();buttons=handles.map(h=>{
      const button=h.precision?precisionElement(h):document.createElement('button');
      if(!h.precision){button.type='button';button.className='region-handle region-name'+(h.precisionCenter?' precision-pivot-handle':'');
        const name=document.createElement('span');name.textContent=h.mask||`Movement ${h.movementIndex}`;name.translate=!h.mask;
        const suffix=document.createElement('span');suffix.textContent=' · target';button.append(name,suffix);
        button.setAttribute('aria-label','Moving target');button.title='Drag to change movement. Arrow keys adjust; Esc cancels.';button.style.setProperty('--region-colour','#e18b28');}
      if(!['readout','dial-label'].includes(h.kind)){
        button.onpointerdown=e=>begin(e,h,button);
        button.onclick=()=>{if(h.kind==='axis-selector'){toolAxis=h.axis;rotationChange=0;rebuild();viewer.render();}else if(h.kind==='select')onSelect(h.index);};
        button.onkeydown=e=>keyboard(e,h);button.onpointerenter=()=>{precision?.setActive(h.key||null);viewer.render();};button.onpointerleave=()=>{if(!drag){precision?.setActive(null);viewer.render();}};
      }
      labels.append(button);return button;
    });}
    const help=pick?'Pick rotation center on the original model. Esc cancels.':mode==='rotate'?'Precision rotate: choose an axis and drag the dial. Shift snaps to 15°.':'Precision move: drag an axis, a plane pad or the pivot.';
    legend.replaceChildren(...[pick?'':'Movement guides · teal: domain · blue: fixed · pale orange: source · orange: target. Compute preview for the deformed field.',help].filter(Boolean).flatMap((text,i)=>{const span=document.createElement('span');span.textContent=text;return i?[document.createTextNode(' · '),span]:[span];}));legend.title=legend.textContent;
  }
  function ray(e){const r=viewer.canvas.getBoundingClientRect(),caster=new THREE.Raycaster();caster.setFromCamera(new THREE.Vector2((e.clientX-r.left)/r.width*2-1,1-(e.clientY-r.top)/r.height*2),viewer.camera);return caster;}
  function begin(e,h,button){if(e.button!==0||['select','axis-selector','readout','dial-label'].includes(h.kind))return;e.preventDefault();e.stopPropagation();
    const original=cloneNumericJson(selected()),normal=['rotate','plane'].includes(h.kind)?h.normal.clone():viewer.camera.getWorldDirection(new THREE.Vector3()),point=h.point.clone().sub(viewer.origin);
    if(h.direction){normal.addScaledVector(h.direction,-normal.dot(h.direction));if(normal.length()<.02){toast('Turn the view slightly to drag along this axis.');return;}normal.normalize();}
    const plane=new THREE.Plane().setFromNormalAndCoplanarPoint(normal,point),start=ray(e).ray.intersectPlane(plane,new THREE.Vector3());if(!start){toast('Turn the view to see this rotation plane.');return;}
    drag={h,button,id:e.pointerId,original,previousRotationChange:rotationChange,normal,plane,start,controls:viewer.controls,enabled:viewer.controls.enabled};viewer.controls.enabled=false;viewer.pointerStart=null;button.setPointerCapture(e.pointerId);
  }
  function rotateMotion(raw,axis,angle){const r=effectiveMotion(raw),q=new THREE.Quaternion().setFromAxisAngle(axis,angle).multiply(new THREE.Quaternion().setFromAxisAngle(V(unit(r.rotation_axis)),r.rotation_degrees*Math.PI/180)).normalize();if(q.w<0)q.set(-q.x,-q.y,-q.z,-q.w);const n=Math.hypot(q.x,q.y,q.z);return {...cloneNumericJson(raw),rotation_axis:n>1e-10?[q.x/n,q.y/n,q.z/n]:[0,0,1],rotation_degrees:2*Math.atan2(n,q.w)*180/Math.PI};}
  function move(e){if(!drag||e.pointerId!==drag.id)return;e.preventDefault();e.stopPropagation();const hit=ray(e).ray.intersectPlane(drag.plane,new THREE.Vector3());if(!hit)return;const {h,original,start}=drag,r=effectiveMotion(original);let next;
    if(h.kind==='rotate'){const center=h.center.clone().sub(viewer.origin),a=start.clone().sub(center).normalize(),b=hit.clone().sub(center).normalize();let angle=Math.atan2(new THREE.Vector3().crossVectors(a,b).dot(h.normal),a.dot(b));if(e.shiftKey)angle=Math.round(angle/(Math.PI/12))*Math.PI/12;rotationChange=THREE.MathUtils.radToDeg(angle);next=rotateMotion(original,h.normal,angle);}
    else{const delta=hit.clone().sub(start);if(h.kind==='plane')delta.copy(precisionPlaneDelta(delta,h.axes));else if(h.direction){const distance=delta.dot(h.direction);delta.copy(h.direction).multiplyScalar(distance);}next={...cloneNumericJson(original),translation:r.translation.map((v,i)=>v+(snap>0?Math.round(delta.getComponent(i)/snap)*snap:delta.getComponent(i)))};}
    onDrag(next);rebuild();viewer.render();
  }
  function finish(cancel=false){if(!drag)return;const old=drag;drag=null;old.controls.enabled=old.enabled;if(old.button.hasPointerCapture(old.id))old.button.releasePointerCapture(old.id);if(cancel){rotationChange=old.previousRotationChange;onCancel(old.original);}else onCommit(old.original);rebuild();viewer.render();}
  function keyboard(e,h){
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)||!['move','plane','rotate'].includes(h.kind))return;
    e.preventDefault();e.stopPropagation();const original=cloneNumericJson(selected()),r=effectiveMotion(original),sign=['ArrowLeft','ArrowDown'].includes(e.key)?-1:1;let next;
    if(h.kind==='rotate'){rotationChange=sign*(e.shiftKey?15:1);next=rotateMotion(original,h.normal,THREE.MathUtils.degToRad(rotationChange));}
    else{const direction=h.kind==='plane'?h.axes[['ArrowLeft','ArrowRight'].includes(e.key)?0:1]:h.direction;next={...original,translation:r.translation.map((v,i)=>v+direction.getComponent(i)*(snap||1)*(e.shiftKey?10:1)*sign)};}
    onDrag(next);onCommit(original);rebuild();viewer.render();
  }
  labels.addEventListener('pointermove',move,{signal});labels.addEventListener('pointerup',e=>{if(drag){e.stopPropagation();finish();}},{signal});labels.addEventListener('pointercancel',()=>finish(true),{signal});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&(drag||pick)){e.preventDefault();e.stopImmediatePropagation();finish(true);pick=false;rebuild();viewer.render();}},{signal,capture:true});
  viewer.canvas.addEventListener('pointermove',move,{signal});viewer.canvas.addEventListener('pointerup',()=>finish(),{signal});viewer.canvas.addEventListener('pointercancel',()=>finish(true),{signal});
  viewer.canvas.addEventListener('pointerdown',e=>{if(!active||e.button!==0)return;
    if(!pick){const rect=viewer.canvas.getBoundingClientRect(),h=precision?.hitTest(e.clientX-rect.left,e.clientY-rect.top);if(h){e.stopImmediatePropagation();begin(e,h,viewer.canvas);}return;}
    e.preventDefault();e.stopImmediatePropagation();
    const hits=ray(e).intersectObjects([...viewer.layers.entries()].filter(([id,l])=>l.mesh.visible&&id!=='result').map(([,l])=>l.mesh),true).filter(h=>h.object.isMesh&&h.face&&(!viewer.section.enabled||h.point.x*viewer.plane.x+h.point.y*viewer.plane.y+h.point.z*viewer.plane.z+viewer.plane.w>=0));
    if(!hits.length){toast('Click a visible original model surface, or press Esc.');return;}const original=cloneNumericJson(selected());onDrag({...original,rotation_center:hits[0].point.add(viewer.origin).toArray()});pick=false;onCommit(original);rebuild();viewer.render();
  },{signal,capture:true});
  const api={update(p,w,k,i,options={}){params=p;workflow=w;key=k;index=i;mode=options.mode||'translate';snap=options.snap||0;show=options.showGuides!==false;active=true;root.visible=true;labels.hidden=false;legend.hidden=false;rebuild();viewer.render();},hide(){finish(true);active=false;pick=false;root.visible=false;labels.hidden=true;legend.hidden=true;bounds.makeEmpty();clear();},refresh(){if(active){rebuild();viewer.render();}},frame(){viewer.fit();},maskCenter,pickCenter(){if(selected()&&validMotion(selected())){pick=!pick;rebuild();viewer.render();}},beforeRender(){root.position.copy(viewer.origin).negate();precision?.update();},afterRender(){if(!active)return;handles.forEach((h,i)=>{const b=buttons[i];if(!b)return;if(h.precision){projectPrecisionElement(b,h,viewer);return;}const p=h.point.clone().sub(viewer.origin).project(viewer.camera),r=viewer.canvas.getBoundingClientRect();b.hidden=p.z< -1||p.z>1;b.style.left=`${(p.x+1)*r.width/2}px`;b.style.top=`${(1-p.y)*r.height/2+(['free','select'].includes(h.kind)?24:0)}px`;});},getBounds(){return active?bounds.clone().translate(viewer.origin.clone().negate()):new THREE.Box3();},dispose(){api.hide();controller.abort();labels.remove();legend.remove();viewer.scene.remove(root);}};
  return api;
}
