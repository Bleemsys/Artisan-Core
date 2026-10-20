import * as THREE from './vendor/three.module.js';
import {projectedDiameter,selectSurfaceCut,readySurfaceCut} from './preview-policy.mjs';
import {decodeSurfaceNode,createSurfacePool,syncSurfaceMaterial} from './surface-lod.js';

export async function prepareHierarchy({manifest,viewer,invoke,current,signal,onDirty,toast}){
  const info=manifest.lod;
  if(!invoke||!info?.handle)throw Error('The overview reader is unavailable. Reopen Preview with the updated application.');
  let pool=null,layer=null,closed=false,maxNodes=Math.min(2048,info.nodes.length),required=new Set(info.roots),queue=[],lastExact='';
  const pending=new Map(),failed=new Set(),metrics=info.nodes.map(()=>({visible:false,spacingPixels:0,refined:false}));
  let nodes=[],visibleCut=[];
  function close(){
    if(closed)return;closed=true;for(const ticket of pending.values())ticket.cancelled=true;
    pool?.dispose();invoke('close_preview_lod',{handle:info.handle}).catch(()=>{});
  }
  let roots;
  try{
    roots=await Promise.all(info.roots.map(async id=>decodeSurfaceNode(await invoke('read_preview_lod',{handle:info.handle,nodeId:id}),info.nodes[id].count)));
    if(!current()||signal?.aborted){close();return null;}
  }catch(error){close();throw error;}
  function factory(base){
    const bounds=new THREE.Box3(new THREE.Vector3(...manifest.boundsMin).sub(viewer.origin),new THREE.Vector3(...manifest.boundsMax).sub(viewer.origin));
    pool=createSurfacePool(base,viewer,info,bounds);
    info.roots.forEach((id,i)=>pool.add(id,roots[i]));pool.show(info.roots);roots=null;return pool.object;
  }
  function attach(nextLayer){
    layer=nextLayer;
    nodes=info.nodes.map(node=>{
      const box=new THREE.Box3(new THREE.Vector3(...node.min),new THREE.Vector3(...node.max)).translate(layer.mesh.position);
      return {...node,slotCount:512,box,sphere:box.getBoundingSphere(new THREE.Sphere())};
    });
    refresh();
  }
  function refresh(){
    if(!pool)return;
    visibleCut=readySurfaceCut(nodes,info.roots,required,pool.slots);pool.show(visibleCut);
  }
  function update(frustum,height){
    if(closed||!layer)return;
    syncSurfaceMaterial(pool.material,viewer);
    const camera=viewer.camera,visible=layer.mesh.visible&&layer.material.uniforms.opacity.value>0;
    for(const node of nodes){
      const metric=metrics[node.id],distance=Math.max(camera.near,camera.position.distanceTo(node.sphere.center)-node.sphere.radius*.25);
      metric.visible=visible&&frustum.intersectsBox(node.box);
      if(metric.visible&&viewer.section.enabled){
        const p=viewer.plane,b=node.box;
        metric.visible=p.x*(p.x>=0?b.max.x:b.min.x)+p.y*(p.y>=0?b.max.y:b.min.y)+p.z*(p.z>=0?b.max.z:b.min.z)+p.w>=0;
      }
      metric.spacingPixels=projectedDiameter(node.spacing/2,distance,height,{orthographicSpan:camera.isOrthographicCamera?camera.top-camera.bottom:0,fov:camera.fov||42,zoom:camera.zoom});
      metric.refined=node.children.some(c=>required.has(c));
    }
    const choice=selectSurfaceCut(nodes,info.roots,metrics,maxNodes*512);
    required=choice.required;
    // Root data is retained even while the model is hidden, for immediate recovery.
    for(const id of [...pool.slots.keys()])if(!required.has(id)&&!info.roots.includes(id))pool.remove(id);
    for(const [id,ticket]of pending)if(!required.has(id))ticket.cancelled=true;
    queue=[...required].sort((a,b)=>nodes[a].level-nodes[b].level||metrics[b].spacingPixels-metrics[a].spacingPixels||a-b);
    refresh();
  }
  function next(){return queue.find(id=>!pool.slots.has(id)&&!pending.has(id)&&!failed.has(id)&&(nodes[id].parent===null||pool.slots.has(nodes[id].parent)));}
  async function load(id){
    const ticket={cancelled:false};pending.set(id,ticket);
    try{
      const bytes=await invoke('read_preview_lod',{handle:info.handle,nodeId:id});
      if(closed||ticket.cancelled||!required.has(id))return;
      pool.add(id,decodeSurfaceNode(bytes,nodes[id].count));refresh();onDirty();
    }catch(error){
      if(!closed&&!ticket.cancelled){failed.add(id);if(!failed.warned){toast(`Overview detail could not load: ${error.message||error}. Coarser coverage is retained.`);failed.warned=true;}}
    }finally{if(pending.get(id)===ticket)pending.delete(id);}
  }
  const groups=new Map();
  info.tileCells.forEach((cell,id)=>{if(!groups.has(cell))groups.set(cell,[]);groups.get(cell).push(id);});
  function exact(loaded){
    const complete=[...groups].filter(([,ids])=>ids.every(id=>loaded.has(id))).map(([cell])=>cell),key=complete.join(',');
    if(key!==lastExact){lastExact=key;pool.exactCells(complete);}
  }
  function contextLost(){
    maxNodes=Math.max(16,Math.floor(maxNodes/2));
    for(const ticket of pending.values())ticket.cancelled=true;
    for(const id of [...pool.slots.keys()])if(!info.roots.includes(id))pool.remove(id);
    required=new Set(info.roots);queue=[];lastExact='';pool.exactCells([]);refresh();
  }
  function stats(){return {surfacePoints:visibleCut.reduce((n,id)=>n+nodes[id].count,0),overviewNodes:visibleCut.length};}
  return {factory,attach,close,update,next,load,exact,contextLost,stats,get pool(){return pool;},get required(){return required;},get visibleCut(){return visibleCut;}};
}
