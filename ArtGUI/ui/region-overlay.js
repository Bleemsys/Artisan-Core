import {createViewportMessage} from './viewport-message.js';
import {createPrecisionGizmo,precisionElement,projectPrecisionElement,precisionPlaneDelta,precisionColours} from './precision-gizmo.js';
import * as THREE from './vendor/three.module.js';
import {geometryType,geometryError,meshSource,boxAxes,unit,geometryBounds,resizeGeometry,regionColours} from './region-model.js';
import {cloneNumericJson,setNumber} from './numeric-json.js';

const V=a=>new THREE.Vector3(...a);
let overlaySequence=0;
export function createRegionOverlay(viewer,{onSelect,onDrag,onCommit,onCancel,toast,colours=regionColours,legendLabel='Region outlines'}){
  const labelPrefix='region-guide-'+(++overlaySequence)+'-';
  const group=new THREE.Group();group.name='Scalar region outlines';viewer.scene.add(group);
  const labels=document.createElement('div');labels.className='region-labels';viewer.canvas.parentElement.append(labels);
  const legend=createViewportMessage(viewer,'region-legend');
  let readOnly=false,regions=[],selected=-1,hidden=new Set(),mode='move',snap=0,active=false,drag=null,handles=[],buttons=[],pick=false,bounds=new THREE.Box3(),precision=null,toolAxis=2,rotationChange=0,currentLegendLabel=legendLabel,readOnlyMessage='Read-only source bounds';
  const events=new AbortController(),signal=events.signal;
  function disposeChildren(){precision=null;for(const child of [...group.children]){child.traverse(o=>{if(!o.userData.sharedRegionGeometry)o.geometry?.dispose();if(o.material)for(const m of [].concat(o.material))m.dispose();});group.remove(child);}}
  function ray(e){const r=viewer.canvas.getBoundingClientRect(),caster=new THREE.Raycaster();caster.setFromCamera(new THREE.Vector2((e.clientX-r.left)/r.width*2-1,1-(e.clientY-r.top)/r.height*2),viewer.camera);return caster;}
  function quaternion(g){if(g.type==='Box')return new THREE.Quaternion().setFromAxisAngle(V(unit(g.rotation_axis||[0,0,1])),THREE.MathUtils.degToRad(g.rotation_degrees||0));if(g.type==='Cylinder')return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),V(unit(g.axis||[0,0,1])));return new THREE.Quaternion();}
  function makeMesh(g,color,chosen,region){
    const geometry=g.type==='Box'?new THREE.BoxGeometry(...g.size):g.type==='Sphere'?new THREE.SphereGeometry(g.radius,32,20):new THREE.CylinderGeometry(g.radius,g.radius,g.height,48);
    const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color,transparent:true,opacity:chosen?.16:.07,depthWrite:false,side:THREE.DoubleSide}));
    mesh.position.fromArray(g.center);mesh.quaternion.copy(quaternion(g));if(!region?.previewSource)group.add(mesh);else{mesh.material.dispose();}
    const coarse=g.type==='Sphere'?new THREE.SphereGeometry(g.radius,16,8):g.type==='Cylinder'?new THREE.CylinderGeometry(g.radius,g.radius,g.height,24,1,true):null;
    const outline=new THREE.Color(color).lerp(new THREE.Color('#ffffff'),.4);
    const wire=new THREE.LineSegments(g.type==='Box'?new THREE.EdgesGeometry(geometry):new THREE.WireframeGeometry(coarse),new THREE.LineBasicMaterial({color:outline,transparent:true,opacity:chosen?1:.8}));coarse?.dispose();wire.position.copy(mesh.position);wire.quaternion.copy(mesh.quaternion);group.add(wire);
    if(region?.previewSource){
      const layer=loadedMesh(region.previewSource);
      if(layer){const sourceBox=layer.box.clone().translate(viewer.origin),center=sourceBox.getCenter(new THREE.Vector3()),size=sourceBox.getSize(new THREE.Vector3()),wrapper=new THREE.Group(),copy=layer.mesh.clone(true);
        copy.visible=true;copy.position.add(viewer.origin).sub(center);copy.traverse(o=>{if(o.geometry)o.userData.sharedRegionGeometry=true;if(o.material)o.material=o.isLine?new THREE.LineBasicMaterial({color,transparent:true,opacity:.7,depthWrite:false}):new THREE.MeshBasicMaterial({color,transparent:true,opacity:.45,depthWrite:false,side:THREE.DoubleSide});});
        wrapper.position.fromArray(g.center);wrapper.quaternion.copy(quaternion(g));wrapper.scale.set(g.size[0]/size.x,g.size[1]/size.y,g.size[2]/size.z);wrapper.add(copy);group.add(wrapper);}
      geometry.dispose();
    }
    if(region?.guideKind==='plane'){const normal=new THREE.Vector3(0,0,1).applyQuaternion(quaternion(g)),arrow=new THREE.ArrowHelper(normal,V(g.center),Math.max(g.size[0],g.size[1])*.25,color);arrow.traverse(o=>{if(o.geometry)o.geometry=o.geometry.clone();});group.add(arrow);}
  }
  function loadedMesh(source){const norm=s=>String(s).replace(/^\\\\\?\\/,'').replaceAll('\\','/').toLowerCase();return [...viewer.layers.values()].find(l=>norm(l.path)===norm(source));}
  function rebuild(){
    disposeChildren();bounds.makeEmpty();handles=[];
    if(!active)return;
    regions.forEach((r,i)=>{
      if(hidden.has(i)||geometryError(r.geometry))return;
      const color=r.colour||colours[i%colours.length],g=r.geometry;
      if(geometryType(g)==='Mesh'){
        const layer=loadedMesh(meshSource(g));if(!layer)return;
        const b=layer.box.clone().translate(viewer.origin);bounds.union(b);
        // Share source buffers but own the overlay materials; never mutate the body.
        const mesh=layer.mesh.clone(true);mesh.position.add(viewer.origin);mesh.visible=true;
        mesh.traverse(o=>{if(o.geometry)o.userData.sharedRegionGeometry=true;if(o.material)o.material=o.isLine?new THREE.LineBasicMaterial({color,transparent:true,opacity:.4,depthWrite:false}):new THREE.MeshBasicMaterial({color,wireframe:true,transparent:true,opacity:.4,depthWrite:false});});group.add(mesh);
        handles.push({name:r.name||`Region ${i+1}`,point:b.getCenter(new THREE.Vector3()),region:i,kind:'select'});return;
      }
      makeMesh(g,color,i===selected,r);const b=geometryBounds(g);bounds.union(new THREE.Box3(V(b[0]),V(b[1])));
      if(readOnly)return;
      const c=V(g.center),length=Math.max(V(b[1]).sub(V(b[0])).length()*.24,1e-4);
      handles.push({name:r.name||`Region ${i+1}`,point:c,region:i,kind:i===selected&&mode==='move'?'free':'select',precisionCenter:i===selected});
      if(i!==selected)return;
      const axes=g.type==='Box'?boxAxes(g):[[1,0,0],[0,1,0],[0,0,1]];
      if(mode==='move'||(mode==='rotate'&&g.type!=='Sphere')){
        precision=createPrecisionGizmo(viewer,{center:c,mode,axis:toolAxis,delta:rotationChange,region:i});
        group.add(precision.group);handles.push(...precision.handles);precision.setActive(drag?.h.key||null);
      }
      if(mode==='resize'){
        if(g.type==='Box')axes.forEach((a,j)=>[-1,1].forEach(sign=>addHandle(c,a.map(x=>x*sign),g.size[j]/2,'resize',`${'XYZ'[j]} ${sign>0?'+':'−'} face`,{dimension:j,sign})));
        if(g.type==='Cylinder')[-1,1].forEach(sign=>addHandle(c,unit(g.axis||[0,0,1]).map(x=>x*sign),g.height/2,'resize',`${sign>0?'Top':'Bottom'} cap`,{dimension:'height',sign}));
        if(g.type==='Sphere'||g.type==='Cylinder'){
          const a=g.type==='Sphere'?new THREE.Vector3(1,0,0):new THREE.Vector3(1,0,0).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1),V(unit(g.axis||[0,0,1]))));
          addHandle(c,a.toArray(),g.radius,'resize','Radius',{dimension:'radius',sign:1});
        }
      }

    });
    function addHandle(c,a,length,kind,name,extra){const point=c.clone().addScaledVector(V(a),length);const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([c,point]),new THREE.LineBasicMaterial({color:kind==='move'?['#e46666','#51b777','#6ea9ff'][extra.axis]:'#eef5ff',depthTest:false}));group.add(line);handles.push({name,point,direction:V(a),kind,region:selected,...extra});}
    group.position.copy(viewer.origin).negate();
    if(!drag){labels.replaceChildren();buttons=handles.map(h=>{
      const b=h.precision?precisionElement(h):document.createElement('button');
      if(!h.precision){b.type='button';b.className='region-handle '+(['select','free'].includes(h.kind)?'region-name'+(h.precisionCenter?' precision-pivot-handle':''):'precision-resize');b.textContent=h.kind==='resize'?(typeof h.dimension==='number'?'XYZ'[h.dimension]:(h.dimension==='radius'?'R':'H'))+(h.sign>0?'+':'−'):h.name;
        if(['free','select'].includes(h.kind)){const name=document.createElement('span');name.textContent=h.name;name.translate=false;name.id=labelPrefix+h.region;b.replaceChildren(name);b.setAttribute('aria-labelledby',name.id);}b.title=h.kind==='resize'?'Drag a resize handle. Arrow keys adjust; Shift increases the step; Esc cancels.':h.precisionCenter?'Drag the pivot to move in the viewing plane. Arrow keys adjust; Esc cancels.':`Select ${h.name}`;if(!['free','select'].includes(h.kind))b.setAttribute('aria-label',h.name);b.style.setProperty('--region-colour',regions[h.region]?.colour||colours[h.region%colours.length]);}
      if(!['readout','dial-label'].includes(h.kind)){
        b.onpointerdown=e=>begin(e,h,b);b.onclick=()=>{if(h.kind==='axis-selector'){toolAxis=h.axis;rotationChange=0;rebuild();viewer.render();}else if(h.kind==='select')onSelect(h.region);};b.onkeydown=e=>keyboard(e,h);
        b.onpointerenter=()=>{precision?.setActive(h.key||null);viewer.render();};b.onpointerleave=()=>{if(!drag){precision?.setActive(null);viewer.render();}};
      }
      labels.append(b);return b;
    });}
    legend.textContent=pick?'Pick center: click a visible model surface. Esc cancels.':`${currentLegendLabel} · ${readOnly?readOnlyMessage:mode==='resize'?'Drag faces / caps; opposite side stays fixed':mode==='rotate'?'Precision rotate: choose an axis and drag the dial. Shift snaps to 15°':'Precision move: drag an axis, a plane pad or the pivot'}`;legend.title=legend.textContent;
  }
  function project(){if(!active)return;group.position.copy(viewer.origin).negate();handles.forEach((h,i)=>{const b=buttons[i];if(!b)return;if(h.precision){projectPrecisionElement(b,h,viewer);return;}const p=h.point.clone().sub(viewer.origin).project(viewer.camera),rect=viewer.canvas.getBoundingClientRect();b.hidden=p.z>1||p.z< -1;b.style.left=`${(p.x+1)*rect.width/2}px`;b.style.top=`${(1-p.y)*rect.height/2}px`;});}
  function begin(e,h,b){
    if(e.button!==0||['select','axis-selector','readout','dial-label'].includes(h.kind))return;
    e.preventDefault();e.stopPropagation();const original=cloneNumericJson(regions[h.region].geometry),point=h.point.clone().sub(viewer.origin),normal=['rotate','plane'].includes(h.kind)?h.normal.clone():viewer.camera.getWorldDirection(new THREE.Vector3());
    if(h.direction){normal.addScaledVector(h.direction,-normal.dot(h.direction));if(normal.length()<.02){toast('Turn the view slightly to drag along this axis.');return;}normal.normalize();}
    const plane=new THREE.Plane().setFromNormalAndCoplanarPoint(normal,point),start=ray(e).ray.intersectPlane(plane,new THREE.Vector3());if(!start){toast('Turn the view to see this rotation plane.');return;}
    drag={h,b,id:e.pointerId,original,previousRotationChange:rotationChange,plane,start,controls:viewer.controls,enabled:viewer.controls.enabled};viewer.controls.enabled=false;b.setPointerCapture(e.pointerId);viewer.pointerStart=null;
  }
  function applyMove(e){if(!drag||e.pointerId!==drag.id)return;e.preventDefault();e.stopPropagation();const hit=ray(e).ray.intersectPlane(drag.plane,new THREE.Vector3());if(!hit)return;
    const {original,h,start}=drag,delta=hit.clone().sub(start);let g=cloneNumericJson(original);
    if(h.kind==='resize')g=resizeGeometry(original,h.dimension,h.sign,delta.dot(h.direction),h.direction.toArray(),snap);
    else if(h.kind==='rotate'){
      const center=h.center.clone().sub(viewer.origin),a=start.clone().sub(center).normalize(),b=hit.clone().sub(center).normalize();let angle=Math.atan2(new THREE.Vector3().crossVectors(a,b).dot(h.normal),a.dot(b));if(e.shiftKey)angle=Math.round(angle/(Math.PI/12))*Math.PI/12;
      rotationChange=THREE.MathUtils.radToDeg(angle);const q=new THREE.Quaternion().setFromAxisAngle(h.normal,angle);
      if(g.type==='Cylinder')g.axis=V(unit(original.axis||[0,0,1])).applyQuaternion(q).toArray();
      else{q.multiply(quaternion(original)).normalize();if(q.w<0)q.set(-q.x,-q.y,-q.z,-q.w);const s=Math.hypot(q.x,q.y,q.z);g.rotation_axis=s>1e-9?[q.x/s,q.y/s,q.z/s]:[0,0,1];setNumber(g,'rotation_degrees',THREE.MathUtils.radToDeg(2*Math.atan2(s,q.w)),'float');}
    }else{if(h.kind==='plane')delta.copy(precisionPlaneDelta(delta,h.axes));else if(h.direction){const distance=delta.dot(h.direction);delta.copy(h.direction).multiplyScalar(distance);}g.center=g.center.map((v,i)=>{const d=delta.getComponent(i);return v+(snap>0?Math.round(d/snap)*snap:d);});}
    onDrag(g);rebuild();viewer.render();
  }
  function finish(cancel=false){if(!drag)return;const old=drag;drag=null;old.controls.enabled=old.enabled;if(old.b.hasPointerCapture(old.id))old.b.releasePointerCapture(old.id);if(cancel){rotationChange=old.previousRotationChange;onCancel(old.original);}else onCommit(old.original);rebuild();viewer.render();}
  function keyboard(e,h){
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)||!['move','plane','resize','rotate'].includes(h.kind))return;
    e.preventDefault();e.stopPropagation();const original=cloneNumericJson(regions[h.region].geometry),sign=['ArrowLeft','ArrowDown'].includes(e.key)?-1:1,amount=(snap||1)*(e.shiftKey?10:1)*sign;let g=cloneNumericJson(original);
    if(h.kind==='resize')g=resizeGeometry(original,h.dimension,h.sign,amount,h.direction.toArray(),snap);
    else if(h.kind==='rotate'){
      rotationChange=sign*(e.shiftKey?15:1);const q=new THREE.Quaternion().setFromAxisAngle(h.normal,THREE.MathUtils.degToRad(rotationChange));
      if(g.type==='Cylinder')g.axis=V(unit(original.axis||[0,0,1])).applyQuaternion(q).toArray();
      else{q.multiply(quaternion(original)).normalize();if(q.w<0)q.set(-q.x,-q.y,-q.z,-q.w);const n=Math.hypot(q.x,q.y,q.z);g.rotation_axis=n>1e-9?[q.x/n,q.y/n,q.z/n]:[0,0,1];setNumber(g,'rotation_degrees',THREE.MathUtils.radToDeg(2*Math.atan2(n,q.w)),'float');}
    }else{const direction=h.kind==='plane'?h.axes[['ArrowLeft','ArrowRight'].includes(e.key)?0:1]:h.direction;g.center=g.center.map((v,i)=>v+direction.getComponent(i)*amount);}
    onDrag(g);onCommit(original);rebuild();viewer.render();
  }
  labels.addEventListener('pointermove',applyMove,{signal});labels.addEventListener('pointerup',e=>{if(drag){e.stopPropagation();finish();}},{signal});labels.addEventListener('pointercancel',()=>finish(true),{signal});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&(drag||pick)){e.preventDefault();e.stopImmediatePropagation();finish(true);pick=false;rebuild();viewer.render();}},{signal,capture:true});
  viewer.canvas.addEventListener('pointermove',applyMove,{signal});viewer.canvas.addEventListener('pointerup',()=>finish(),{signal});viewer.canvas.addEventListener('pointercancel',()=>finish(true),{signal});
  viewer.canvas.addEventListener('pointerdown',e=>{if(!active||e.button!==0)return;
    if(!pick){const rect=viewer.canvas.getBoundingClientRect(),h=precision?.hitTest(e.clientX-rect.left,e.clientY-rect.top);if(h){e.stopImmediatePropagation();begin(e,h,viewer.canvas);}return;}
    e.preventDefault();e.stopImmediatePropagation();const hits=ray(e).intersectObjects([...viewer.layers.values()].filter(l=>l.mesh.visible).map(l=>l.mesh),true).filter(h=>h.object.isMesh&&h.face&&(!viewer.section.enabled||h.point.x*viewer.plane.x+h.point.y*viewer.plane.y+h.point.z*viewer.plane.z+viewer.plane.w>=0));if(!hits.length){toast('Click a visible model surface, or cancel with Escape.');return;}const original=cloneNumericJson(regions[selected].geometry),g=cloneNumericJson(original);g.center=hits[0].point.add(viewer.origin).toArray();onDrag(g);pick=false;onCommit(original);rebuild();viewer.render();},{signal,capture:true});
  const api={
    update(items,index,options={}){currentLegendLabel=options.legendLabel||legendLabel;readOnlyMessage=options.readOnlyMessage||'Read-only source bounds';readOnly=!!options.readOnly;regions=items;selected=index;hidden=options.hidden||new Set();mode=options.mode||'move';snap=options.snap||0;active=true;group.visible=true;legend.hidden=false;labels.hidden=false;rebuild();viewer.render();},
    hide(){finish(true);active=false;pick=false;group.visible=false;labels.hidden=true;legend.hidden=true;bounds.makeEmpty();disposeChildren();viewer.render();},
    frame(options){viewer.fit(options?.guidesOnly?api.getBounds():undefined);},pickCenter(){pick=!pick;rebuild();viewer.render();},
    beforeRender(){group.position.copy(viewer.origin).negate();precision?.update();},afterRender:project,
    getBounds(){return active?bounds.clone().translate(viewer.origin.clone().negate()):new THREE.Box3();},
    refresh(){if(active){rebuild();viewer.render();}},
    dispose(){api.hide();events.abort();labels.remove();legend.remove();viewer.scene.remove(group);}
  };return api;
}
