import * as THREE from './vendor/three.module.js';
import {createRegionOverlay} from './region-overlay.js';
import {operationIcon} from './operation-icons.js';
import {paddedDomain,samplingGuideSegments} from './setup-model.js';

export function createSetupOverlay(viewer,{onDrag,onCommit,onCancel,onTool,toast}){
 const group=new THREE.Group();group.name='Sampling grid guide';viewer.scene.add(group);
 const parent=viewer.canvas.parentElement,tools=document.createElement('div'),labels=document.createElement('div');
 tools.className='setup-viewport-tools';tools.hidden=true;tools.setAttribute('role','group');tools.setAttribute('aria-label','Sampling domain tools');
 tools.innerHTML=`<button type="button" data-domain-mode="move">${operationIcon('move-3d')}<span>Move domain</span></button><button type="button" data-domain-mode="resize">${operationIcon('box')}<span>Resize bounds</span></button><button type="button" data-domain-fit>${operationIcon('scan')}<span>Fit view</span></button>`;
 labels.className='setup-dimension-labels';parent.append(tools,labels);
 let geometry=null,options={},regions=[],active=false;
 const base=createRegionOverlay(viewer,{colours:['#3989ee'],legendLabel:'Sampling domain',onSelect:()=>{},
  onDrag:g=>{geometry=g;regions[0].geometry=g;onDrag(g);rebuild();},onCommit,onCancel,toast});
 const domain=()=>geometry?.center.map((v,i)=>[v-geometry.size[i]/2,v+geometry.size[i]/2]);
 function clear(){for(const child of [...group.children]){child.geometry?.dispose();child.material?.dispose();group.remove(child);}labels.replaceChildren();}
 function rebuild(){
  clear();if(!active||!geometry)return;
  if(options.passive){
   const box=new THREE.BoxGeometry(...geometry.size),edges=new THREE.EdgesGeometry(box);box.dispose();
   const outline=new THREE.LineSegments(edges,new THREE.LineBasicMaterial({color:'#7fb0ed',transparent:true,opacity:.65,depthWrite:false}));
   outline.position.fromArray(geometry.center);group.add(outline);
  }
  const d=domain(),pts=samplingGuideSegments(d,options.res,options.padding);
  if(pts.length){
   const lines=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts.map(p=>new THREE.Vector3(...p))),new THREE.LineBasicMaterial({color:'#7fb0ed',transparent:true,opacity:.22,depthWrite:false}));
   group.add(lines);
  }
  const outer=paddedDomain(d,options.res,options.padding);
  if(outer&&options.padding>0){
   const b=new THREE.BoxGeometry(...outer.map(a=>a[1]-a[0])),edges=new THREE.EdgesGeometry(b);b.dispose();
   const line=new THREE.LineSegments(edges,new THREE.LineDashedMaterial({color:'#d3ac65',transparent:true,opacity:.65,dashSize:Math.max(...geometry.size)/50,gapSize:Math.max(...geometry.size)/80}));
   line.position.fromArray(geometry.center);line.computeLineDistances();group.add(line);
  }
  geometry.size.forEach((n,i)=>{const label=document.createElement('span');label.translate=false;label.textContent=`${'XYZ'[i]} ${Number(n.toPrecision(6))}`;label.dataset.axis=String(i);labels.append(label);});
 }
 for(const b of tools.querySelectorAll('[data-domain-mode]'))b.onclick=()=>onTool(b.dataset.domainMode);
 tools.querySelector('[data-domain-fit]').onclick=()=>base.frame();
 const api={
  update(g,opts){
   geometry=g;options=opts;active=!!g&&opts.visible!==false;group.visible=active;tools.hidden=!active||!!opts.passive;labels.hidden=!active;
   for(const b of tools.querySelectorAll('[data-domain-mode]')){b.hidden=!opts.editable;b.disabled=!opts.editable;b.setAttribute('aria-pressed',String(b.dataset.domainMode===opts.mode));}
   if(active&&!opts.passive){regions=[{name:opts.editable?'Sampling domain':'Source bounds',geometry:g}];base.update(regions,opts.editable?0:-1,{mode:opts.mode,snap:opts.snap,readOnly:!opts.editable});}
   else base.hide();
   rebuild();viewer.render();
  },
  hide(){base.hide();active=false;geometry=null;group.visible=false;tools.hidden=true;labels.hidden=true;clear();viewer.render();},
  frame(){if(active)base.frame();},
  beforeRender(){base.beforeRender();group.position.copy(viewer.origin).negate();},
  afterRender(){
   base.afterRender();if(!active||!geometry)return;
   const rect=viewer.canvas.getBoundingClientRect();
   [...labels.children].forEach((label,i)=>{
    const p=new THREE.Vector3(...geometry.center),offsets=[[0,-.65,-.65],[.65,0,-.65],[-.65,-.65,0]][i];
    offsets.forEach((n,j)=>p.setComponent(j,p.getComponent(j)+geometry.size[j]*n));
    p.sub(viewer.origin).project(viewer.camera);label.hidden=p.z>1||p.z< -1;label.style.left=`${Math.max(30,Math.min(rect.width-30,(p.x+1)*rect.width/2))}px`;label.style.top=`${Math.max(65,Math.min(rect.height-65,(1-p.y)*rect.height/2))}px`;
   });
  },
  getBounds(){const b=base.getBounds();const outer=active&&geometry?(paddedDomain(domain(),options.res,options.padding)||domain()):null;if(outer)b.union(new THREE.Box3(new THREE.Vector3(...outer.map(a=>a[0])).sub(viewer.origin),new THREE.Vector3(...outer.map(a=>a[1])).sub(viewer.origin)));return b;},
  dispose(){api.hide();base.dispose();tools.remove();labels.remove();viewer.scene.remove(group);},
 };
 return api;
}
