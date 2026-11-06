import {createViewportMessage} from './viewport-message.js';
import * as THREE from './vendor/three.module.js';
import {createPrimitiveMeshGeometry} from './primitive-mesh-geometry.js';
import {primitiveMeshFrame,primitiveMeshOrigin,primitiveMeshPoint,primitiveMeshRanges,primitiveMeshError,displayedPrimitiveValue,isAxialPrimitive} from './primitive-mesh-model.js';
import {translate as t} from './i18n.js';
import {createPrecisionGizmo,precisionElement,projectPrecisionElement,precisionWorldPerPixel} from './precision-gizmo.js';

const V=a=>new THREE.Vector3(...a),axes=['X','Y','Z'],colours=['#c94759','#18815d','#326ed3'];
export function primitiveMeshHandles(keyword,p,mode='shape',selected=''){
  const origin=primitiveMeshOrigin(keyword,p),q=primitiveMeshFrame(keyword,p),ranges=primitiveMeshRanges(keyword,p),mid=ranges.map(r=>(r[0]+r[1])/2),size=keyword==='Gen_BoxMesh'?Math.max(...ranges.map(r=>r[1]-r[0])):p.r_range[1]*2;
  const world=a=>primitiveMeshPoint(keyword,p,a),dir=i=>new THREE.Vector3().setComponent(i,1).applyQuaternion(q),handles=[];
  const add=(path,name,coordinates,extra={})=>handles.push({path,name,point:world(coordinates),...extra});
  if(mode==='move'){
    handles.push({path:'ori',name:'Origin',point:origin.clone(),kind:'free',label:'Origin'});
    for(let i=0;i<3;i++)handles.push({path:'ori.'+i,name:'Move '+axes[i],label:axes[i],point:origin.clone().addScaledVector(dir(i),size*.55),direction:dir(i),kind:'linear',colour:colours[i]});
    return handles;
  }
  if(mode==='axis')return [{path:'Normal',name:'Normal direction',label:'Normal',kind:'axis',point:origin.clone().addScaledVector(V(p.Normal).normalize(),size*.7),colour:'#ce7627'}];
  if(keyword==='Gen_BoxMesh'){
    for(let i=0;i<3;i++)for(let side=0;side<2;side++){
      const c=[...mid];c[i]=ranges[i][side];add('xyz'[i]+'_range.'+side,axes[i]+' '+(side?'maximum':'minimum'),c,{label:axes[i]+(side?' +':' −'),kind:'linear',direction:dir(i),colour:colours[i]});
    }
    const r=size*.7,angle=p.z_angle;
    // The rotation dial is fixed to the pre-spin frame so the handle moves with z_angle.
    const base=primitiveMeshFrame(keyword,{...p,z_angle:0});
    handles.push({path:'z_angle',name:'In-plane rotation',label:'Rotate',kind:'angle',point:new THREE.Vector3(r*Math.cos(angle),r*Math.sin(angle),0).applyQuaternion(base),center:new THREE.Vector3(),normal:dir(2),frame:base,angle:'phi'});
    return handles;
  }
  const phi=mid[1],theta=keyword==='Gen_SphericalMesh'?mid[2]:null;
  for(let side=0;side<2;side++){
    const c=[...mid];c[0]=p.r_range[side];if(keyword==='Gen_CappedConeMesh')c[2]=0;const radial=keyword==='Gen_SphericalMesh'?new THREE.Vector3(Math.sin(theta)*Math.cos(phi),Math.sin(theta)*Math.sin(phi),Math.cos(theta)):new THREE.Vector3(Math.cos(phi),Math.sin(phi),0);
    add('r_range.'+side,side?'Outer radius':'Inner radius',c,{label:side?'R outer':'R inner',kind:'linear',direction:radial.applyQuaternion(q),offset:[side?30:-30,side?-16:16]});
  }
  const arcRadius=p.r_range[1]*1.15,phiZ=isAxialPrimitive(keyword)?p.Height*.55:0;
  for(let side=0;side<2;side++){
    if(keyword==='Gen_CappedConeMesh'&&p.phi_range[1]-p.phi_range[0]>=1-1e-10&&!selected.startsWith('phi_range'))continue;
    const c=[arcRadius,ranges[1][side],isAxialPrimitive(keyword)?phiZ:Math.PI/2];
    add('phi_range.'+side,side?'Phi end':'Phi start',c,{label:side?'Phi end':'Phi start',kind:'angle',center:origin.clone().addScaledVector(dir(2),phiZ),normal:dir(2),frame:q,angle:'phi',offset:[side?28:-28,side?15:-15]});
  }
  if(isAxialPrimitive(keyword))add('Height','Height',[p.r_range[1],phi,p.Height],{label:'Height',kind:'linear',direction:dir(2),...(keyword==='Gen_CappedConeMesh'?{offset:[100,-16]}:{})});
  else for(let side=0;side<2;side++){
    const c=[arcRadius,phi,ranges[2][side]],radial=new THREE.Vector3(Math.cos(phi),Math.sin(phi),0);
    add('theta_range.'+side,side?'Theta end':'Theta start',c,{label:side?'Theta end':'Theta start',kind:'angle',center:origin,normal:new THREE.Vector3(-Math.sin(phi),Math.cos(phi),0).applyQuaternion(q),frame:q,angle:'theta',radial,offset:[18,side?14:-14]});
  }
  if(keyword==='Gen_CappedConeMesh'){
    const radial=new THREE.Vector3(Math.cos(phi),Math.sin(phi),0).applyQuaternion(q);
    add('r_bottom','Bottom radius',[p.r_range[1],phi,p.Height],{label:'Bottom radius',kind:'linear',direction:radial,offset:[38,20]});
    add('UB_heightRatio','Taper start',[p.r_range[1],phi,p.Height*p.UB_heightRatio],{label:'Taper start',kind:'linear',direction:dir(2),scale:100/p.Height,colour:'#df8521',offset:[22,-12]});
  }
  return handles;
}

export function createPrimitiveMeshOverlay(viewer,{onSelect=()=>{},onDrag=()=>true,onBegin=()=>{},onCommit=()=>{},onCancel=()=>{},onDisplay=()=>{},toast=()=>{}}={}){
  const group=new THREE.Group();group.name='Primitive mesh editing preview';viewer.scene.add(group);
  const labels=document.createElement('div');labels.className='pm-handles';labels.hidden=true;viewer.canvas.parentElement.append(labels);
  const legend=createViewportMessage(viewer,'pm-legend');
  const events=new AbortController(),signal=events.signal;
  let active=false,keyword='',params=null,mode='shape',snap=0,display='edges',selected='',geometry=null,handles=[],buttons=[],drag=null,frameRequest=null,worldBounds=new THREE.Box3(),materials=[],wire=null,taperRing=null,precision=null,rotationAxis=0,rotationChange=0;
  function dispose(){for(const child of [...group.children]){child.traverse(o=>{o.geometry?.dispose();for(const m of [].concat(o.material||[]))m.dispose();});group.remove(child);}materials=[];wire=null;taperRing=null;geometry=null;precision=null;}
  function placementGuides(){
    const origin=primitiveMeshOrigin(keyword,params);
    for(const h of handles){
      if(!['linear','axis'].includes(h.kind))continue;
      const vector=h.point.clone().sub(origin),length=vector.length();if(length<1e-9)continue;
      const arrow=new THREE.ArrowHelper(vector.normalize(),new THREE.Vector3(),length,h.colour||'#2867d8',length*.16,length*.07);
      arrow.traverse(o=>{if(o.geometry)o.geometry=o.geometry.clone();if(o.material){o.material.transparent=true;o.material.depthTest=false;o.material.depthWrite=false;}o.renderOrder=135;});group.add(arrow);
    }
    handles.forEach(h=>worldBounds.expandByPoint(h.point));
    if(mode==='axis'){
      precision=createPrecisionGizmo(viewer,{center:origin,mode:'rotate',axis:rotationAxis,delta:rotationChange,path:'Normal'});
      precision.group.position.set(0,0,0);group.add(precision.group);
      for(const h of precision.handles){h.handleId='Normal:'+h.kind+':'+(h.key??h.axis??h.label);if(h.kind==='rotate')h.name='Rotate normal about '+axes[h.axis];}
      handles.push(...precision.handles);
    }
  }
  function rebuild(){
    frameRequest=null;if(!active||!params)return;
    dispose();worldBounds.makeEmpty();if(primitiveMeshError(keyword,params)){labels.hidden=true;legend.hidden=true;return;}
    geometry=createPrimitiveMeshGeometry(keyword,params,{dragging:!!drag});worldBounds.copy(geometry.bounds);
    // All guide vertices are relative to the mesh origin for large-coordinate stability.
    materials=geometry.faces.map(f=>new THREE.MeshBasicMaterial({color:f.path===selected?'#4b92f0':'#9bc3ee',transparent:true,opacity:display==='wireframe'?0:f.path===selected?.95:.8,side:THREE.DoubleSide,depthWrite:display!=='wireframe',polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1}));
    group.add(new THREE.Mesh(geometry.surface,materials));
    wire=new THREE.LineSegments(geometry.grid,new THREE.LineBasicMaterial({color:selected.startsWith('num_elem')?'#146ee3':'#49779e',transparent:true,opacity:display==='solid'?.12:.8}));group.add(wire);
    handles=primitiveMeshHandles(keyword,params,mode,drag?.handleSelection??selected);
    if(mode==='move'||mode==='axis')placementGuides();
    if(!drag){
      const existing=new Map([...labels.children].map(b=>[b.dataset.pmHandle,b]));buttons=handles.map(h=>{
        const id=h.handleId||h.path,passive=['readout','dial-label'].includes(h.kind),b=existing.get(id)||(h.precision?precisionElement(h):document.createElement('button'));existing.delete(id);
        if(!passive)b.type='button';if(!h.precision)b.classList.add('pm-handle');b.dataset.pmHandle=id;b.setAttribute('aria-label',t(h.name));
        if(!h.precision){b.title=t('Drag to edit. Arrow keys adjust; Shift increases the step; Escape cancels.');b.textContent=t(h.label);b.style.setProperty('--pm-handle-colour',h.colour||'#2867d8');}
        else if(passive||h.kind==='axis-selector')b.textContent=h.label;
        if(!passive){
          b.onpointerdown=e=>begin(e,h,b);b.onkeydown=e=>keyboard(e,h);b.onfocus=()=>select(h.path);
          b.onclick=h.kind==='axis-selector'?()=>{rotationAxis=h.axis;rotationChange=0;schedule();}:null;
          b.onpointerenter=()=>{precision?.setActive(h.key||null);highlight(h.path);viewer.render();};b.onpointerleave=()=>{if(!drag){precision?.setActive(null);highlight(selected);viewer.render();}};
        }
        if(!b.isConnected)labels.append(b);return b;
      });
      existing.forEach(b=>b.remove());
    }
    if(mode==='shape'&&(keyword!=='Gen_BoxMesh'||selected==='z_angle')&&(keyword!=='Gen_CappedConeMesh'||selected.startsWith('phi_range')))addArcs();
    if(mode==='shape'&&keyword==='Gen_CappedConeMesh')addTaperRing();
    labels.hidden=false;legend.hidden=false;legend.textContent=t(mode==='shape'&&keyword==='Gen_CappedConeMesh'&&selected==='UB_heightRatio'?'Taper start · drag the ring along the normal':mode==='move'?'Move origin · drag an XYZ arrow or the origin':mode==='axis'?'Rotate normal · choose X, Y or Z and drag the dial':geometry.simplified?'Simplified editing preview · saved divisions are unchanged':'Editing preview · drag a handle or edit its field');legend.title=legend.textContent;
    group.position.copy(primitiveMeshOrigin(keyword,params)).sub(viewer.origin);highlight(selected);viewer.render();
  }
  function addArcs(){
    const ranges=primitiveMeshRanges(keyword,params),radius=keyword==='Gen_BoxMesh'?Math.max(...ranges.map(r=>r[1]-r[0]))*.7:params.r_range[1]*1.15,points=[];
    for(let i=0;i<=64;i++){
      if(keyword==='Gen_BoxMesh')points.push(new THREE.Vector3(radius*Math.cos(i*Math.PI/32),radius*Math.sin(i*Math.PI/32),0).applyQuaternion(primitiveMeshFrame(keyword,{...params,z_angle:0})).sub(primitiveMeshOrigin(keyword,params)));
      else points.push(primitiveMeshPoint(keyword,params,[radius,ranges[1][0]+(ranges[1][1]-ranges[1][0])*i/64,isAxialPrimitive(keyword)?params.Height*.55:Math.PI/2]).sub(primitiveMeshOrigin(keyword,params)));
    }
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:'#397ee0',transparent:true,opacity:.65,depthTest:false})));
    if(keyword==='Gen_SphericalMesh'){
      const points=[];for(let i=0;i<=64;i++)points.push(primitiveMeshPoint(keyword,params,[radius,(ranges[1][0]+ranges[1][1])/2,ranges[2][0]+(ranges[2][1]-ranges[2][0])*i/64]).sub(primitiveMeshOrigin(keyword,params)));
      group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:'#397ee0',transparent:true,opacity:.65,depthTest:false})));
    }
  }
  function addTaperRing(){
    const angles=params.phi_range.map(n=>n*2*Math.PI),origin=primitiveMeshOrigin(keyword,params),points=[];
    for(let i=0;i<=96;i++)points.push(primitiveMeshPoint(keyword,params,[params.r_range[1],angles[0]+(angles[1]-angles[0])*i/96,params.Height*params.UB_heightRatio]).sub(origin));
    taperRing=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:'#df8521',depthTest:false,transparent:true,opacity:.95}));taperRing.renderOrder=150;group.add(taperRing);
  }
  function schedule(){if(frameRequest===null)frameRequest=requestAnimationFrame(rebuild);}
  function highlight(path){
    geometry?.faces.forEach((f,i)=>{materials[i].color.set(f.path===path?'#4b92f0':'#9bc3ee');materials[i].opacity=display==='wireframe'?0:f.path===path?.95:.8;});
    buttons.forEach((b,i)=>{const h=handles[i];b.classList.toggle('pm-selected',!h?.precision&&h?.path===path);if(h?.kind==='axis-selector')b.setAttribute('aria-pressed',String(h.active));else if(!['readout','dial-label'].includes(h?.kind))b.setAttribute('aria-pressed',String(h?.path===path));});
  }
  function select(path){selected=path;highlight(path);onSelect(path);viewer.render();}
  function ray(e){const r=viewer.canvas.getBoundingClientRect(),caster=new THREE.Raycaster();caster.setFromCamera(new THREE.Vector2((e.clientX-r.left)/r.width*2-1,1-(e.clientY-r.top)/r.height*2),viewer.camera);return caster.ray;}
  function begin(e,h,button){
    if(e.button!==0||drag||['axis-selector','readout','dial-label'].includes(h.kind))return;e.preventDefault();e.stopPropagation();
    const center=(h.center||h.point).clone().sub(viewer.origin),normal=h.normal?.clone()||viewer.camera.getWorldDirection(new THREE.Vector3());
    if(h.direction){normal.addScaledVector(h.direction,-normal.dot(h.direction));if(normal.length()<.03){toast('Turn the view slightly to drag along this axis.');return;}normal.normalize();}
    const plane=new THREE.Plane().setFromNormalAndCoplanarPoint(normal,center),start=ray(e).intersectPlane(plane,new THREE.Vector3());
    if(!start){toast('Turn the view to see this editing plane.');return;}
    const handleSelection=selected;select(h.path);onBegin();drag={handleSelection,h,button,id:e.pointerId,plane,start,origin:V(params.ori),worldOrigin:primitiveMeshOrigin(keyword,params),frame:primitiveMeshFrame(keyword,params),value:displayedPrimitiveValue(params,h.path),normal:V(params.Normal),controls:viewer.controls,enabled:viewer.controls.enabled,travel:0,previousRotation:rotationChange};
    if(h.kind==='angle')drag.previousAngle=pointerAngle(start,h);
    if(h.kind==='rotate')drag.previousDirection=start.clone().add(viewer.origin).sub(h.center).normalize();
    viewer.controls.enabled=false;viewer.pointerStart=null;button.setPointerCapture(e.pointerId);
  }
  function pointerAngle(point,h){
    const local=point.clone().add(viewer.origin).sub(h.center).applyQuaternion(h.frame.clone().invert());
    return h.angle==='theta'?Math.atan2(local.dot(h.radial),local.z):Math.atan2(local.y,local.x);
  }
  function clampValue(path,value){
    if(path==='UB_heightRatio')return THREE.MathUtils.clamp(value,0,99.9);
    if(path==='r_bottom')return Math.max(params.Preserve_thickness?params.r_range[1]-params.r_range[0]:0,value);
    if(path==='Height')return Math.max(1e-8,value);
    if(path==='z_angle')return THREE.MathUtils.clamp(value,0,360);
    const parts=path.split('.'),[key,index]=parts;
    if(key.endsWith('_range')){
      const side=Number(index),gap=key==='phi_range'||key==='theta_range'?1e-4:1e-8;
      if(side===0)value=Math.min(value,displayedPrimitiveValue(params,key+'.1')-gap);else value=Math.max(value,displayedPrimitiveValue(params,key+'.0')+gap);
      if(key==='r_range')value=Math.max(0,value);
      if(key==='phi_range')value=THREE.MathUtils.clamp(value,0,360);
      if(key==='theta_range')value=THREE.MathUtils.clamp(value,0,180);
    }
    return value;
  }
  function move(e){
    if(!drag||e.pointerId!==drag.id)return;e.preventDefault();e.stopPropagation();const d=drag,point=ray(e).intersectPlane(d.plane,new THREE.Vector3());if(!point)return;
    const delta=point.clone().sub(d.start),fine=e.altKey?.1:1;let value;
    if(d.h.kind==='angle'){
      const angle=pointerAngle(point,d.h);let step=angle-d.previousAngle;step=Math.atan2(Math.sin(step),Math.cos(step));d.travel+=step;d.previousAngle=angle;
      value=d.value+THREE.MathUtils.radToDeg(d.travel)*fine;if(e.shiftKey)value=Math.round(value/15)*15;
    }else if(d.h.kind==='rotate'){
      const current=point.clone().add(viewer.origin).sub(d.h.center).normalize();
      d.travel+=Math.atan2(d.h.normal.dot(d.previousDirection.clone().cross(current)),d.previousDirection.dot(current));d.previousDirection=current;
      let angle=d.travel*fine;if(e.shiftKey)angle=THREE.MathUtils.degToRad(Math.round(THREE.MathUtils.radToDeg(angle)/15)*15);
      rotationChange=THREE.MathUtils.radToDeg(angle);value=d.normal.clone().applyAxisAngle(d.h.normal,angle).toArray();
    }else if(d.h.kind==='free')value=d.origin.clone().addScaledVector(delta.clone().applyQuaternion(d.frame.clone().invert()),fine).toArray();
    else if(d.h.kind==='axis'){
      const length=Math.max(d.h.point.distanceTo(d.worldOrigin),1e-8);value=d.normal.clone().normalize().addScaledVector(delta,fine/length).normalize().multiplyScalar(d.normal.length()).toArray();
    }else{value=d.value+delta.dot(d.h.direction)*fine*(d.h.scale||1);const step=d.h.path==='UB_heightRatio'?(e.shiftKey?5:0):snap||(e.shiftKey?1:0);if(step)value=Math.round(value/step)*step;}
    if(Array.isArray(value)&&snap&&d.h.kind==='free')value=value.map(n=>Math.round(n/snap)*snap);
    if(d.h.path==='UB_heightRatio')value=Math.round(value*10)/10;
    if(!Array.isArray(value))value=clampValue(d.h.path,value);
    onDrag(d.h.path,value);schedule();
  }
  function finish(cancel=false){
    if(!drag)return;const d=drag;drag=null;d.controls.enabled=d.enabled;
    if(d.button.hasPointerCapture?.(d.id))d.button.releasePointerCapture(d.id);
    if(cancel)rotationChange=d.previousRotation;cancel?onCancel():onCommit();if(active)schedule();
  }
  function keyboard(e,h){
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)||['axis-selector','readout','dial-label'].includes(h.kind))return;e.preventDefault();e.stopPropagation();select(h.path);onBegin();
    const sign=['ArrowLeft','ArrowDown'].includes(e.key)?-1:1,amount=sign*(e.shiftKey?10:1)*(snap||1);let value;
    if(h.kind==='rotate'){rotationChange=sign*(e.shiftKey?15:1);value=V(params.Normal).applyAxisAngle(h.normal,THREE.MathUtils.degToRad(rotationChange)).toArray();}
    else if(h.kind==='axis'){const next=V(params.Normal).applyAxisAngle(new THREE.Vector3(['ArrowUp','ArrowDown'].includes(e.key)?1:0,['ArrowLeft','ArrowRight'].includes(e.key)?1:0,0),THREE.MathUtils.degToRad(sign*(e.shiftKey?15:1)));value=next.toArray();}
    else if(['axis-selector','readout','dial-label'].includes(h.kind))return;
    else if(h.kind==='free'){value=[...params.ori];value[['ArrowLeft','ArrowRight'].includes(e.key)?0:1]+=amount;}
    else value=clampValue(h.path,displayedPrimitiveValue(params,h.path)+amount);
    onDrag(h.path,value);onCommit();schedule();
  }
  labels.addEventListener('pointermove',move,{signal});labels.addEventListener('pointerup',e=>{if(drag&&e.pointerId===drag.id){e.stopPropagation();finish();}},{signal});labels.addEventListener('pointercancel',()=>finish(true),{signal});labels.addEventListener('lostpointercapture',()=>{if(drag)finish(true);},{signal});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&drag){e.preventDefault();e.stopImmediatePropagation();finish(true);}},{signal,capture:true});
  window.addEventListener('blur',()=>finish(true),{signal});
  viewer.canvas.addEventListener('pointerdown',e=>{
    if(!active||e.button!==0)return;
    if(mode==='shape'&&taperRing){
      const caster=new THREE.Raycaster();caster.ray.copy(ray(e));caster.params.Line.threshold=precisionWorldPerPixel(viewer,primitiveMeshOrigin(keyword,params))*7;group.updateMatrixWorld(true);
      if(caster.intersectObject(taperRing).length){const h=handles.find(h=>h.path==='UB_heightRatio');e.preventDefault();e.stopImmediatePropagation();begin(e,h,viewer.canvas);}return;
    }
    if(!['move','axis'].includes(mode))return;
    const r=viewer.canvas.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;let hit=mode==='axis'?precision?.hitTest(x,y):null;
    if(mode==='move'){
      const project=world=>{const p=world.clone().sub(viewer.origin).project(viewer.camera);return new THREE.Vector2((p.x+1)*r.width/2,(1-p.y)*r.height/2);},start=project(primitiveMeshOrigin(keyword,params));let best=9;
      for(const h of handles.filter(h=>h.path.startsWith('ori.')&&h.kind==='linear')){
        const end=project(h.point),dx=end.x-start.x,dy=end.y-start.y,length=Math.hypot(dx,dy);if(length<15)continue;
        const fraction=((x-start.x)*dx+(y-start.y)*dy)/(length*length);if(fraction<12/length||fraction>1.08)continue;
        const distance=Math.hypot(x-start.x-fraction*dx,y-start.y-fraction*dy);if(distance<best){best=distance;hit=h;}
      }
    }
    if(hit){e.preventDefault();e.stopImmediatePropagation();begin(e,hit,viewer.canvas);}
  },{signal,capture:true});
  viewer.canvas.addEventListener('pointermove',move,{signal});viewer.canvas.addEventListener('pointerup',e=>{if(drag&&e.pointerId===drag.id)finish();},{signal});viewer.canvas.addEventListener('pointercancel',()=>finish(true),{signal});
  const api={
    update(k,p,options={}){const nextMode=options.mode||'shape';if(nextMode==='axis'&&(mode!=='axis'||params!==p)){rotationAxis=[0,1,2].sort((a,b)=>Math.abs(p.Normal[a])-Math.abs(p.Normal[b]))[0];rotationChange=0;}keyword=k;params=p;mode=nextMode;snap=options.snap||0;display=options.display||'edges';selected=options.selected||'';active=true;group.visible=true;schedule();},
    select(path){const changed=selected!==path;selected=path;highlight(path);if(active&&changed)schedule();viewer.render();},
    setDisplay(mode){if(!['solid','wireframe','edges'].includes(mode))return;display=mode;onDisplay(mode);if(active)schedule();},
    hide(){active=false;finish(true);if(frameRequest!==null){cancelAnimationFrame(frameRequest);frameRequest=null;}group.visible=false;labels.hidden=true;legend.hidden=true;worldBounds.makeEmpty();dispose();viewer.render();},
    frame(){
      if(frameRequest!==null){cancelAnimationFrame(frameRequest);frameRequest=null;rebuild();}
      if(worldBounds.isEmpty())return;
      const box=worldBounds.clone().translate(viewer.origin.clone().negate());viewer.fit(box);
      const vertices=geometry.surface.attributes.position,offset=primitiveMeshOrigin(keyword,params).sub(viewer.origin),point=new THREE.Vector3();let left=Infinity,right=-Infinity,top=-Infinity,bottom=Infinity;
      for(let i=0;i<vertices.count;i++){point.fromBufferAttribute(vertices,i).add(offset).project(viewer.camera);left=Math.min(left,point.x);right=Math.max(right,point.x);top=Math.max(top,point.y);bottom=Math.min(bottom,point.y);}
      for(const h of handles)if(!h.precision){point.copy(h.point).sub(viewer.origin).project(viewer.camera);left=Math.min(left,point.x);right=Math.max(right,point.x);top=Math.max(top,point.y);bottom=Math.min(bottom,point.y);}
      const width=(right-left)/2,height=(top-bottom)/2;
      viewer.camera.zoom*=.72/Math.max(width,height,1e-8);viewer.camera.updateProjectionMatrix();viewer.render();
    },
    beforeRender(){if(active&&params)group.position.copy(primitiveMeshOrigin(keyword,params)).sub(viewer.origin);precision?.update();},
    afterRender(){if(!active)return;const rect=viewer.canvas.getBoundingClientRect();handles.forEach((h,i)=>{const b=buttons[i];if(!b)return;if(h.precision){projectPrecisionElement(b,h,viewer);return;}const p=h.point.clone().sub(viewer.origin).project(viewer.camera),x=(p.x+1)*rect.width/2+(h.offset?.[0]||0),y=(1-p.y)*rect.height/2+(h.offset?.[1]||0),halfWidth=(b.offsetWidth||50)/2+4,halfHeight=(b.offsetHeight||26)/2+4;b.hidden=p.z< -1||p.z>1||x< -48||x>rect.width+48||y< -48||y>rect.height+48;b.style.left=THREE.MathUtils.clamp(x,halfWidth,Math.max(halfWidth,rect.width-halfWidth))+'px';b.style.top=THREE.MathUtils.clamp(y,halfHeight,Math.max(halfHeight,rect.height-halfHeight))+'px';});},
    getBounds(){return active?worldBounds.clone().translate(viewer.origin.clone().negate()):new THREE.Box3();},
    refresh(){if(active)schedule();},cancel:()=>finish(true),
    dispose(){api.hide();events.abort();labels.remove();legend.remove();viewer.scene.remove(group);}
  };return api;
}
