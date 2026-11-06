import * as THREE from './vendor/three.module.js';

const cyan='#67dfee',amber='#ffc35b';
const fmt=value=>String(Number(value.toPrecision(8)));

export function createContourOverlay(viewer,onSelect){
  const group=new THREE.Group();
  group.name='Z contour paths';
  viewer.scene.add(group);
  const ruler=document.createElement('div');
  ruler.className='contour-ruler';ruler.hidden=true;
  ruler.innerHTML='<span class="contour-ruler-label" translate="no"></span><div class="contour-ruler-track"></div>';
  viewer.canvas.parentElement.append(ruler);
  const track=ruler.lastElementChild;
  const bounds=new THREE.Box3(),empty=document.getElementById('viewport-empty');
  const materials=[
    new THREE.LineBasicMaterial({color:cyan,transparent:true,opacity:.83,depthTest:false,depthWrite:false}),
    new THREE.LineBasicMaterial({color:amber,transparent:true,depthTest:false,depthWrite:false}),
    new THREE.LineDashedMaterial({color:cyan,transparent:true,opacity:.28,depthTest:false,depthWrite:false}),
    new THREE.LineDashedMaterial({color:amber,transparent:true,opacity:.9,depthTest:false,depthWrite:false})
  ];
  let record=null;
  function clear(){
    for(const line of [...group.children]){group.remove(line);line.geometry.dispose();}
    bounds.makeEmpty();
  }
  function add(vertices,index,guide,extent){
    if(!vertices.length)return;
    const origin=vertices[0];
    const data=new Float32Array(vertices.length*3);
    for(let i=0;i<vertices.length;i++)for(let axis=0;axis<3;axis++)data[i*3+axis]=vertices[i][axis]-origin[axis];
    if(!data.every(Number.isFinite))return;
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.BufferAttribute(data,3));
    const line=new THREE.LineSegments(geometry,materials[guide?2:0]);
    line.position.fromArray(origin);
    line.renderOrder=90;
    line.userData={index,guide};
    if(guide){
      const dash=extent/50;
      for(const material of materials.slice(2)){material.dashSize=dash;material.gapSize=dash*.6;}
      line.computeLineDistances();
    }else{
      geometry.computeBoundingBox();
      bounds.union(geometry.boundingBox.clone().translate(line.position));
    }
    group.add(line);
  }
  function rebuild(levels,slices,domain,unit){
    clear();
    const width=domain?.[0][1]-domain?.[0][0],depth=domain?.[1][1]-domain?.[1][0];
    const finite=levels.map((z,index)=>({z,index})).filter(({z})=>Number.isFinite(z)).sort((a,b)=>b.z-a.z);
    for(const {z,index} of finite){
      if(slices){
        const paths=slices.get(z)||[];
        const pairs=[];
        for(const path of paths){
          for(let i=0;i<path.length;i++)pairs.push(path[i],path[(i+1)%path.length]);
        }
        add(pairs,index,false);
      }else if(width>0&&depth>0){
        const [[x0,x1],[y0,y1]]=domain;
        const a=[x0,y0,z],b=[x1,y0,z],c=[x1,y1,z],d=[x0,y1,z];
        add([a,b,b,c,c,d,d,a],index,true,Math.max(width,depth));
      }
    }
    ruler.hidden=!finite.length;
    ruler.firstElementChild.textContent='Z ('+unit+')';
    track.replaceChildren();
    const max=finite[0]?.z,min=finite.at(-1)?.z,range=max-min;
    let last=-Infinity;
    for(const {z,index} of finite){
      const position=range>0?100*((max-z)/range):50;
      const button=document.createElement('button');
      button.type='button';button.dataset.contourTick=String(index);
      button.className='contour-tick';
      button.style.top=position+'%';
      button.dataset.label=position-last>=12?'true':'false';
      if(button.dataset.label==='true')last=position;
      button.setAttribute('aria-label','Z '+fmt(z)+' '+unit);
      button.title=button.getAttribute('aria-label');
      const label=document.createElement('span');
      label.textContent=fmt(z);label.translate=false;
      button.append(label);
      button.onclick=()=>onSelect(index);
      track.append(button);
    }
  }
  const api={
    update(levels,active,slices,domain,unit){
      const firstResult=!!slices&&!record?.slices,hadGeometry=!bounds.isEmpty();
      const signature=JSON.stringify([levels,slices?null:domain,unit]);
      if(record?.signature!==signature||record?.slices!==slices){
        rebuild(levels,slices,domain,unit);
        record={signature,slices};
      }
      for(const line of group.children){
        const {index,guide}=line.userData,selected=index===active;
        line.material=materials[(guide?2:0)+(selected?1:0)];
        line.renderOrder=selected?91:90;
      }
      for(const tick of track.children)tick.setAttribute('aria-pressed',String(Number(tick.dataset.contourTick)===active));
      if(!bounds.isEmpty())empty?.classList.add('hidden');
      else if(!viewer.layers.size&&!viewer.fieldLayers.size&&hadGeometry)empty?.classList.remove('hidden');
      if(firstResult&&!viewer.layers.size&&!bounds.isEmpty())viewer.fit();
      else viewer.render();
    },
    beforeRender(){group.position.copy(viewer.origin).negate();},
    getBounds(){return bounds.clone().translate(viewer.origin.clone().negate());},
    hide(){
      if(!bounds.isEmpty()&&!viewer.layers.size&&!viewer.fieldLayers.size)empty?.classList.remove('hidden');
      clear();ruler.hidden=true;track.replaceChildren();record=null;viewer.render();
    }
  };
  return api;
}
