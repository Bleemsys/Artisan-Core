import * as THREE from './vendor/three.module.js';
import {normalFrame} from './spatial-model.js';
import {directionMatches,pairDirection} from './slot-model.js';

const amber='#ffc16a',cyan='#84d3ff';
const v=value=>new THREE.Vector3(...value);

function plateBox(box,domain){
  if(!Array.isArray(box?.ori)||box.ori.length!==3||!box.ori.every(Number.isFinite)||
    !Array.isArray(box.length)||box.length.length!==3||!box.length.every(x=>Number.isFinite(x)&&x>0))return null;
  const normal=box.normal??[0,0,1];
  if(!Array.isArray(normal)||normal.length!==3||!normal.every(Number.isFinite)||!Math.hypot(...normal))return null;
  const rotation=normalFrame(normal,box.z_angle||0,true),inverse=rotation.clone().invert();
  const origin=v(box.ori),half=v(box.length),limits=new THREE.Box3(half.clone().negate(),half.clone());
  if(domain?.length===3&&domain.every(range=>range?.length===2&&range.every(Number.isFinite))){
    const local=new THREE.Box3();
    for(const x of domain[0])for(const y of domain[1])for(const z of domain[2])
      local.expandByPoint(new THREE.Vector3(x,y,z).sub(origin).applyQuaternion(inverse));
    limits.intersect(local);
  }
  if(limits.isEmpty())return null;
  const center=limits.getCenter(new THREE.Vector3()).applyQuaternion(rotation).add(origin);
  return {center,size:limits.getSize(new THREE.Vector3()),rotation,inverse,origin,limits,normal:v(normal).normalize()};
}

function jointExtent(a,b,direction){
  if(!a||!b)return null;
  const axis=v(direction).normalize(),planeA=a.origin.dot(a.normal),planeB=b.origin.dot(b.normal);
  const divisor=a.normal.dot(b.normal.clone().cross(axis));
  if(Math.abs(divisor)<1e-6)return null;
  const origin=b.normal.clone().cross(axis).multiplyScalar(planeA)
    .add(axis.clone().cross(a.normal).multiplyScalar(planeB)).divideScalar(divisor);
  let lo=-Infinity,hi=Infinity;
  for(const plate of [a,b]){
    const start=origin.clone().sub(plate.origin).applyQuaternion(plate.inverse),dir=axis.clone().applyQuaternion(plate.inverse);
    for(let i=0;i<3;i++){
      const p=start.getComponent(i),d=dir.getComponent(i),min=plate.limits.min.getComponent(i),max=plate.limits.max.getComponent(i);
      if(Math.abs(d)<1e-9){if(p<min||p>max)return null;continue;}
      const near=(min-p)/d,far=(max-p)/d;
      lo=Math.max(lo,Math.min(near,far));hi=Math.min(hi,Math.max(near,far));
    }
  }
  return hi>lo&&Number.isFinite(lo)&&Number.isFinite(hi)?{origin,axis,lo,hi}:null;
}

export function createSlotOverlay(viewer,onIsolate){
  const group=new THREE.Group(),platesGroup=new THREE.Group(),guideGroup=new THREE.Group();
  group.add(platesGroup,guideGroup);viewer.scene.add(group);
  group.name='Slot joint preview';
  const host=viewer.canvas.parentElement,toolbar=document.getElementById('viewer-toolbar'),empty=document.getElementById('viewport-empty');
  const toggle=document.createElement('button');toggle.type='button';toggle.className='button slot-isolate';toggle.textContent='Isolate pair';toggle.hidden=true;
  toggle.onclick=onIsolate;toolbar.append(toggle);
  const labels=['A','B','Split'].map(kind=>{
    const label=document.createElement('span');
    label.className='slot-viewport-label slot-label-'+kind.toLowerCase();
    label.translate=false;label.hidden=true;host.append(label);
    return label;
  });
  let frame=null,params=null,points=[],suppressed=[],pairBounds=new THREE.Box3(),displayBounds=new THREE.Box3(),hasGeometry=false;
  function clear(target){
    const materials=new Set();
    for(const child of [...target.children]){
      child.traverse(obj=>{obj.geometry?.dispose();if(obj.material)materials.add(obj.material);});
      target.remove(child);
    }
    for(const material of materials)material.dispose();
  }
  function guidePlate(box,colour,selected){
    const material=viewer.material(colour);
    material.uniforms.opacity.value=selected?.52:.14;
    material.transparent=true;material.depthWrite=false;
    const geometry=new THREE.BoxGeometry(...box.size);
    const mesh=new THREE.Mesh(geometry,material);
    mesh.position.copy(box.center);mesh.quaternion.copy(box.rotation);
    mesh.renderOrder=selected?5:3;
    const edges=new THREE.LineSegments(new THREE.EdgesGeometry(geometry),
      new THREE.LineBasicMaterial({color:colour,transparent:true,opacity:selected?.8:.20,depthWrite:false}));
    edges.renderOrder=selected?6:4;mesh.add(edges);
    mesh.updateMatrixWorld(true);
    const bounds=new THREE.Box3().setFromObject(mesh);
    platesGroup.add(mesh);return bounds;
  }
  function computedPlate(batches,colour){
    const material=viewer.material(colour);
    const bounds=new THREE.Box3();
    for(const batch of batches){
      const geo=new THREE.BufferGeometry();
      geo.setAttribute('position',new THREE.BufferAttribute(batch.positions,3));
      geo.setIndex(new THREE.BufferAttribute(batch.indices,1));
      const mesh=new THREE.Mesh(geo,material);
      mesh.position.fromArray(batch.center);platesGroup.add(mesh);
      bounds.union(new THREE.Box3(v(batch.bounds[0]),v(batch.bounds[1])));
    }
    return bounds;
  }
  function rebuild(plates,p,isolate,preview,domain){
    clear(platesGroup);
    pairBounds.makeEmpty();displayBounds.makeEmpty();
    const selected=[plates.get(p.A),plates.get(p.B)].map(box=>plateBox(box,domain));
    points=[null,null,null];
    for(const [i,side,colour] of [[0,'A',amber],[1,'B',cyan]]){
      const box=selected[i],batches=preview?.meshes[side];
      const bounds=batches?.length?computedPlate(batches,colour):box?guidePlate(box,colour,true):null;
      if(bounds&&!bounds.isEmpty()){
        pairBounds.union(bounds);displayBounds.union(bounds);
        const point=bounds.getCenter(new THREE.Vector3());
        // Put the callout on a free edge rather than directly at the crossing.
        point.x=bounds.min.x+.14*(bounds.max.x-bounds.min.x);
        if(i===1)point.z=bounds.max.z-.12*(bounds.max.z-bounds.min.z);
        points[i]=point;labels[i].textContent=side+' · '+p[side];
      }
    }
    if(!isolate){
      let shown=0;
      for(const [id,record] of plates){
        if(shown>=64)break;
        if(id===p.A||id===p.B)continue;
        const box=plateBox(record,domain);
        if(!box)continue;
        const colour=selected[0]&&Math.abs(box.normal.dot(selected[0].normal))>.98?amber:cyan;
        displayBounds.union(guidePlate(box,colour,false));shown++;
      }
    }
    toggle.hidden=pairBounds.isEmpty();
    toggle.setAttribute('aria-pressed',String(isolate));
    const joint=pairDirection(plates.get(p.A),plates.get(p.B));
    return joint&&directionMatches(p.direction,joint)?jointExtent(...selected,p.direction):null;
  }
  function splitGuide(p,extent,computed){
    clear(guideGroup);
    points[2]=null;
    if(!extent||computed)return;
    const {origin,axis,lo,hi}=extent,split=lo+(p.split_ratio??.5)*(hi-lo);
    for(const [side,colour] of [['A',amber],['B',cyan]]){
      const end=p['open_'+side]==='Negative'?lo:hi,delta=(end-split);
      const shape=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),axis.clone().multiplyScalar(delta)]);
      const dash=(hi-lo)/32;
      const line=new THREE.Line(shape,new THREE.LineDashedMaterial({color:colour,dashSize:dash,gapSize:dash*.52,
        transparent:true,opacity:.96,depthTest:false,depthWrite:false}));
      line.position.copy(origin).addScaledVector(axis,split);line.computeLineDistances();line.renderOrder=20;guideGroup.add(line);
    }
    points[2]=origin.clone().addScaledVector(axis,split);
    labels[2].textContent=String(Number(((p.split_ratio??.5)*100).toPrecision(5)))+'%';
  }
  function updateEmpty(show){
    if(show)empty?.classList.add('hidden');
    else if(hasGeometry&&!viewer.layers.size&&!viewer.fieldLayers.size)empty?.classList.remove('hidden');
    hasGeometry=show;
  }
  return {
    update(plates,p,isolate,preview,domain,fit){
      const sig=JSON.stringify([[...plates],p.A,p.B,p.direction,isolate,domain]);
      if(frame?.sig!==sig||frame?.preview!==preview){
        frame={sig,preview,isolate,extent:rebuild(plates,p,isolate,preview,domain),guide:null};
      }
      params=p;
      const guide=JSON.stringify([p.split_ratio,p.open_A,p.open_B]);
      if(frame.guide!==guide){splitGuide(p,frame.extent,!!preview);frame.guide=guide;}
      updateEmpty(!displayBounds.isEmpty());
      if(fit&&!pairBounds.isEmpty())viewer.fit(pairBounds.clone().translate(viewer.origin.clone().negate()));
      else viewer.render();
    },
    getBounds(){return displayBounds.clone().translate(viewer.origin.clone().negate());},
    beforeRender(){
      group.position.copy(viewer.origin).negate();
      suppressed=[];
      if(frame?.isolate&&hasGeometry)for(const id of ['source','result']){
        const mesh=viewer.layers.get(id)?.mesh;
        if(mesh?.visible){mesh.visible=false;suppressed.push(mesh);}
      }
    },
    afterRender(){
      for(const mesh of suppressed)mesh.visible=true;
      suppressed=[];
      const rect=viewer.canvas.getBoundingClientRect();
      labels.forEach((label,i)=>{
        const point=points[i];
        label.hidden=!params||!point;
        if(!point)return;
        const xy=point.clone().sub(viewer.origin).project(viewer.camera);
        label.hidden=xy.z< -1||xy.z>1||Math.abs(xy.x)>1||Math.abs(xy.y)>1;
        label.style.left=Math.max(44,Math.min(rect.width-44,(xy.x+1)*rect.width/2))+'px';
        label.style.top=Math.max(20,Math.min(rect.height-20,(1-xy.y)*rect.height/2+(i===0?12:-9)))+'px';
      });
    },
    hide(){
      params=null;frame=null;points=[];
      clear(platesGroup);clear(guideGroup);displayBounds.makeEmpty();pairBounds.makeEmpty();
      for(const label of labels)label.hidden=true;
      toggle.hidden=true;updateEmpty(false);viewer.render();
    }
  };
}
