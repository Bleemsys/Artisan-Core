import * as THREE from './vendor/three.module.js';

export const precisionAxes=[[1,0,0],[0,1,0],[0,0,1]];
export const precisionColours=['#c94759','#18815d','#326ed3'];
const V=a=>new THREE.Vector3(...a);
const names='XYZ';

// Geometry is authored in pixels, then scaled in world space at the pivot.
// This keeps handles usable while the camera zooms and the model origin shifts.
export function precisionWorldPerPixel(viewer,center){
  const height=Math.max(1,viewer.canvas.getBoundingClientRect().height);
  const camera=viewer.camera;
  if(camera.isOrthographicCamera)return Math.abs(camera.top-camera.bottom)/(Math.max(camera.zoom,1e-8)*height);
  const local=center.clone().sub(viewer.origin);
  const depth=Math.abs(local.sub(camera.position).dot(camera.getWorldDirection(new THREE.Vector3())));
  return Math.max(1e-9,2*Math.max(camera.near||.01,depth)*Math.tan(THREE.MathUtils.degToRad(camera.fov||45)/2)/(Math.max(camera.zoom||1,1e-8)*height));
}
export function precisionPlaneDelta(delta,axes){
  const result=new THREE.Vector3();
  for(const axis of axes)result.addScaledVector(axis,delta.dot(axis));
  return result;
}
export function precisionRotationBasis(axis){
  const normal=V(precisionAxes[axis]),u=V(precisionAxes[(axis+1)%3]),v=new THREE.Vector3().crossVectors(normal,u);
  return {normal,u,v};
}
function segmentDistance(p,a,b){
  const dx=b.x-a.x,dy=b.y-a.y,d=dx*dx+dy*dy;
  const t=d?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/d)):0;
  return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);
}
function insidePolygon(point,polygon){
  let sign=0;
  for(let i=0;i<polygon.length;i++){
    const a=polygon[i],b=polygon[(i+1)%polygon.length],cross=(b.x-a.x)*(point.y-a.y)-(b.y-a.y)*(point.x-a.x);
    if(Math.abs(cross)<1e-6)continue;
    const next=Math.sign(cross);if(sign&&next!==sign)return false;sign=next;
  }
  return !!sign;
}
export function createPrecisionGizmo(viewer,{center,mode='move',axis=2,delta=0,...metadata}){
  const group=new THREE.Group();group.name='Precision movement controls';group.position.copy(center);
  const handles=[],primitives=[],visuals=new Map(),radius=78,length=76;
  let scale=1,hover=null;
  const colours=precisionColours;
  function material(color,opacity=1){return new THREE.MeshBasicMaterial({color,transparent:true,opacity,depthTest:false,depthWrite:false,side:THREE.DoubleSide});}
  function add(object,key){
    object.renderOrder=140;object.frustumCulled=false;group.add(object);
    if(key){if(!visuals.has(key))visuals.set(key,[]);visuals.get(key).push(object);}
    return object;
  }
  function line(points,color,key,opacity=.9,loop=false){
    const m=new THREE.LineBasicMaterial({color,transparent:true,opacity,depthTest:false,depthWrite:false});
    m.userData.baseOpacity=opacity;
    return add(new (loop?THREE.LineLoop:THREE.Line)(new THREE.BufferGeometry().setFromPoints(points),m),key);
  }
  function mesh(geometry,color,key,opacity=1){
    const m=material(color,opacity);m.userData.baseOpacity=opacity;
    return add(new THREE.Mesh(geometry,m),key);
  }
  function handle(values){
    const h={precision:true,...metadata,...values,point:center.clone(),localPoint:values.localPoint||new THREE.Vector3()};
    handles.push(h);return h;
  }
  if(mode==='move'){
    precisionAxes.forEach((a,i)=>{
      const direction=V(a),color=colours[i];
      for(const sign of [-1,1]){
        const d=direction.clone().multiplyScalar(sign),key='move-'+i+'-'+sign;
        const shaft=mesh(new THREE.CylinderGeometry(1.1,1.1,length-12,10),color,key,.9);
        shaft.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d);shaft.position.copy(d).multiplyScalar((length-12)/2);
        const cone=mesh(new THREE.ConeGeometry(5.6,12,16),color,key,.95);
        cone.quaternion.copy(shaft.quaternion);cone.position.copy(d).multiplyScalar(length-6);
        const h=handle({key,kind:'move',axis:i,sign,direction:d,color,name:'Move '+(sign<0?'-':'')+names[i],label:(sign<0?'−':'')+names[i],localPoint:d.clone().multiplyScalar(length),labelLocal:d.clone().multiplyScalar(length+16)});
        primitives.push({h,points:[d.clone().multiplyScalar(18),d.clone().multiplyScalar(length)],type:'line'});
      }
    });
    [[0,1],[1,2],[2,0]].forEach(pair=>{
      const [i,j]=pair,normalIndex=3-i-j,key='plane-'+i+j,color=colours[normalIndex],u=V(precisionAxes[i]),v=V(precisionAxes[j]);
      const points=[[22,22],[40,22],[40,40],[22,40]].map(p=>u.clone().multiplyScalar(p[0]).addScaledVector(v,p[1]));
      const geometry=new THREE.BufferGeometry().setFromPoints([points[0],points[1],points[2],points[0],points[2],points[3]]);
      geometry.computeVertexNormals();mesh(geometry,color,key,.13);line(points,color,key,.75,true);
      const h=handle({key,kind:'plane',axes:[u,v],normal:new THREE.Vector3().crossVectors(u,v),color,label:names[i]+names[j],name:'Move in '+names[i]+names[j]+' plane',localPoint:u.clone().add(v).multiplyScalar(31)});
      primitives.push({h,points,type:'polygon'});
    });
  }else{
    const {normal,u,v}=precisionRotationBasis(axis),color=colours[axis],key='rotate-'+axis;
    const onCircle=(angle,r=radius)=>u.clone().multiplyScalar(Math.cos(angle)*r).addScaledVector(v,Math.sin(angle)*r);
    const circle=Array.from({length:96},(_,n)=>onCircle(n*Math.PI/48));
    line(circle,color,key,.45,true);
    for(let n=0;n<24;n++){
      const angle=n*Math.PI/12;
      line([onCircle(angle),onCircle(angle,radius-(n%3===0?9:5))],color,key,n%3===0?.95:.6);
    }
    line([new THREE.Vector3(),onCircle(0,radius-12)],'#72839a',null,.4);
    const angle=THREE.MathUtils.degToRad(delta);
    if(Math.abs(angle)>1e-7){
      const count=Math.max(3,Math.ceil(Math.abs(delta)/4));
      const arc=Array.from({length:count},(_,n)=>onCircle(angle*n/(count-1)));
      mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(arc),Math.max(4,count),1.5,8,false),color,key,.95);
    }
    const end=onCircle(angle);
    const grip=mesh(new THREE.SphereGeometry(5,14,10),color,key,.98);grip.position.copy(end);
    const rotation=handle({key,kind:'rotate',axis,color,center:center.clone(),normal,name:'Rotate '+names[axis],label:'',localPoint:end,labelLocal:onCircle(angle,radius+18)});
    primitives.push({h:rotation,points:circle.concat([circle[0]]),type:'ring'});
    for(const [n,value] of [[0,'0°'],[1,'90°'],[2,'180°'],[3,'−90°']]){
      handle({kind:'dial-label',label:value,name:value,localPoint:onCircle(n*Math.PI/2,radius+13)});
    }
    for(let i=0;i<3;i++)handle({kind:'axis-selector',axis:i,color:colours[i],label:names[i],name:'Choose rotation axis '+names[i],active:i===axis,screenOffset:[(i-1)*31,-112]});
    handle({kind:'readout',label:'Δ '+delta.toFixed(1)+'°',name:'Rotation change',screenOffset:[0,112]});
  }
  const pivot=mesh(new THREE.SphereGeometry(3.2,12,8),'#ffffff',null);pivot.renderOrder=145;
  const pivotOutline=mesh(new THREE.SphereGeometry(4.3,12,8),'#30445f',null);pivotOutline.renderOrder=144;
  function projectLocal(local){
    const p=local.clone().multiplyScalar(scale).add(center).sub(viewer.origin).project(viewer.camera),rect=viewer.canvas.getBoundingClientRect();
    return new THREE.Vector2((p.x+1)*rect.width/2,(1-p.y)*rect.height/2);
  }
  const api={group,handles,
    update(){
      scale=precisionWorldPerPixel(viewer,center);group.scale.setScalar(scale);
      for(const h of handles){
        h.point.copy(h.localPoint).multiplyScalar(scale).add(center);
        if(h.labelLocal)h.labelPoint=h.labelLocal.clone().multiplyScalar(scale).add(center);
        h.disabled=h.kind==='plane'&&Math.abs(h.normal.dot(viewer.camera.getWorldDirection(new THREE.Vector3())))<.12;
      }
    },
    setActive(key){
      if(hover===key)return;hover=key;
      for(const [id,objects] of visuals)for(const object of objects)object.material.opacity=(object.material.userData.baseOpacity??1)*(key&&id!==key?.33:1);
    },
    hitTest(x,y){
      const pivot=center.clone().sub(viewer.origin).project(viewer.camera);if(!Number.isFinite(pivot.z)||pivot.z< -1||pivot.z>1)return null;
      const point=new THREE.Vector2(x,y);
      for(const p of primitives)if(p.type==='polygon'&&!p.h.disabled&&insidePolygon(point,p.points.map(projectLocal)))return p.h;
      let hit=null,best=9;
      for(const p of primitives){
        if(p.type==='polygon'||p.h.disabled)continue;
        const points=p.points.map(projectLocal);
        for(let i=1;i<points.length;i++){const distance=segmentDistance(point,points[i-1],points[i]);if(distance<best){best=distance;hit=p.h;}}
      }
      return hit;
    }
  };
  api.update();return api;
}
export function precisionElement(h){
  const passive=['readout','dial-label'].includes(h.kind),element=document.createElement(passive?'div':'button');
  if(!passive)element.type='button';
  element.className='region-handle precision-handle precision-'+h.kind;
  element.style.setProperty('--precision-colour',h.color||'#30445f');
  if(h.kind==='readout'){element.setAttribute('aria-label','Rotation change');element.setAttribute('aria-live','off');}
  else element.setAttribute('aria-label',h.name);
  if(h.kind==='axis-selector')element.setAttribute('aria-pressed',String(h.active));
  if(h.kind==='move'||h.kind==='rotate'){
    const label=document.createElement('span');label.className='precision-handle-label';label.textContent=h.label;element.append(label);
  }else element.textContent=h.label;
  if(h.kind==='dial-label')element.translate=false;
  if(!passive)element.title=h.kind==='axis-selector'?'Choose the rotation dial axis.':h.kind==='plane'?'Drag a plane pad to move along two axes. Arrow keys adjust; Esc cancels.':h.kind==='rotate'?'Drag the rotation dial. Arrow keys rotate by 1°; Shift snaps to 15°; Esc cancels.':'Drag an axis arrow. Arrow keys adjust; Shift + arrows uses a larger step; Esc cancels.';
  return element;
}
export function projectPrecisionElement(element,h,viewer){
  const r=viewer.canvas.getBoundingClientRect(),p=h.point.clone().sub(viewer.origin).project(viewer.camera);
  const x=(p.x+1)*r.width/2+(h.screenOffset?.[0]||0),y=(1-p.y)*r.height/2+(h.screenOffset?.[1]||0);
  element.hidden=!!h.disabled||p.z>1||p.z< -1||x< -25||x>r.width+25||y< -25||y>r.height+25;
  element.style.left=x+'px';element.style.top=y+'px';
  if(h.labelPoint){
    const label=h.labelPoint.clone().sub(viewer.origin).project(viewer.camera);
    element.style.setProperty('--label-x',((label.x-p.x)*r.width/2)+'px');
    element.style.setProperty('--label-y',(-(label.y-p.y)*r.height/2)+'px');
  }
}
