// Pure scheduling policy, shared by perspective and orthographic previews.
export const PREVIEW_BYTES = 64 * 1024 ** 2;
export const GRAPHICS_BYTES = 512 * 1024 ** 2;
export const MAX_BUFFER_BYTES = 1024 ** 3;

// A parent remains resident as the fallback for every not-yet-ready descendant.
// All branches compete for one point budget; a coarse view is always complete.
export function selectSurfaceCut(nodes, roots, metrics, maxPoints, targetSpacing = 2) {
  const required=new Set(),cut=new Set(),heap=[];let points=0;
  function push(id){const score=metrics[id]?.spacingPixels||0;let i=heap.length;heap.push({id,score});while(i){const p=(i-1)>>1;if(heap[p].score>=score)break;[heap[p],heap[i]]=[heap[i],heap[p]];i=p;}}
  function pop(){const top=heap[0],last=heap.pop();if(heap.length){heap[0]=last;let i=0;while(true){let c=i*2+1;if(c>=heap.length)break;if(c+1<heap.length&&heap[c+1].score>heap[c].score)c++;if(heap[i].score>=heap[c].score)break;[heap[i],heap[c]]=[heap[c],heap[i]];i=c;}}return top;}
  const cost=id=>nodes[id].slotCount??nodes[id].count;
  for(const id of roots){if(!metrics[id]?.visible)continue;required.add(id);cut.add(id);points+=cost(id);push(id);}
  while(heap.length){
    const {id,score}=pop();if(score<=targetSpacing*(metrics[id]?.refined ? .8 : 1))continue;
    const children=nodes[id].children.filter(c=>metrics[c]?.visible);
    if(!children.length)continue;
    const extra=children.reduce((n,c)=>n+(required.has(c)?0:cost(c)),0);
    if(points+extra>maxPoints)continue;
    cut.delete(id);points+=extra;
    for(const c of children){required.add(c);cut.add(c);push(c);}
  }
  return {required,cut,points};
}

export function readySurfaceCut(nodes,roots,required,resident){
  function cover(id){
    if(!required.has(id))return [];
    if(!resident.has(id))return null;
    const children=nodes[id].children.filter(c=>required.has(c));
    if(children.length){const covered=children.map(cover);if(covered.every(c=>c!==null))return covered.flat();}
    return resident.has(id)?[id]:null;
  }
  return roots.flatMap(id=>cover(id)||[]);
}

export function projectedDiameter(radius, distance, height, {orthographicSpan = 0, fov = 42, zoom = 1} = {}) {
  if (!(radius > 0) || !(height > 0)) return 0;
  if (orthographicSpan > 0) return 2 * radius * height * zoom / orthographicSpan;
  return radius * height * zoom / (Math.max(distance, radius * .01) * Math.tan(fov * Math.PI / 360));
}

export function selectPreviewTiles(candidates, resident = new Set(), budget = PREVIEW_BYTES) {
  // Hysteresis keeps a loaded tile until it shrinks below 52px; new tiles need 80px.
  const selected = [];
  let bytes = 0;
  for (const tile of candidates.filter(t => t.visible && t.pixels >= (resident.has(t.id) ? 52 : 80))
    .sort((a, b) => b.score - a.score || a.id - b.id)) {
    const size = tile.count * tile.vertices * 12;
    if (!Number.isSafeInteger(size) || size <= 0 || size > budget - bytes) continue;
    selected.push(tile.id); bytes += size;
  }
  return selected;
}

export function selectPreviewTileGroups(candidates,resident,budget){
  const groups=new Map();
  for(const tile of candidates){
    const key=tile.cell??`tile-${tile.id}`;
    let group=groups.get(key);if(!group){group={ids:[],bytes:0,visible:false,pixels:0,score:0};groups.set(key,group);}
    group.ids.push(tile.id);group.bytes+=tile.count*tile.vertices*12;
    group.visible ||= tile.visible;group.pixels=Math.max(group.pixels,tile.pixels);group.score=Math.max(group.score,tile.score);
  }
  const result=[];let bytes=0;
  for(const g of [...groups.values()].sort((a,b)=>b.score-a.score)){
    const threshold=g.ids.every(id=>resident.has(id))?52:80;
    if(!g.visible||g.pixels<threshold||g.bytes>budget-bytes)continue;
    result.push(...g.ids);bytes+=g.bytes;
  }
  return result;
}

export function resourceBudgets(viewer, performanceObject = globalThis.performance) {
  const memory = performanceObject?.memory;
  return {
    residentGraphicsBytes: viewer.geometryBytes(), graphicsBudgetBytes: GRAPHICS_BYTES,
    maxBufferBytes: MAX_BUFFER_BYTES,
    heapAvailableBytes: Number.isFinite(memory?.jsHeapSizeLimit) && Number.isFinite(memory?.usedJSHeapSize)
      ? Math.max(0, Math.floor((memory.jsHeapSizeLimit - memory.usedJSHeapSize) * .7)) : null
  };
}

export async function admitFullDetail({invoke, viewer, path, workflowPath, warn}) {
  try {
    const result = await invoke('check_full_detail', {path, workflowPath, ...resourceBudgets(viewer)});
    if (!result.allowed) { warn(result.reason); return false; }
    return true;
  } catch (error) {
    warn(`Full detail could not be checked: ${error?.message || error}. Continue using Preview.`);
    return false;
  }
}
