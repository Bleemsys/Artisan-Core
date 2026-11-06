import {cloneNumericJson, setNumber} from './numeric-json.js';

export const STRUT_LIMITS={nodes:1000,connections:5000};
export const HEX_CORNERS=[[0,0,0],[1,0,0],[1,1,0],[0,1,0],[0,0,1],[1,0,1],[1,1,1],[0,1,1]];
export const TET_CORNERS=[[0,0,0],[1,0,0],[0,1,0],[0,0,1]];
export const STRUT_DOMAINS=['Hex','Tet'];
const DOMAIN_TOLERANCE=1e-9;
const copy=cloneNumericJson;
const same=(a,b)=>a.every((v,i)=>Math.abs(v-b[i])<1e-10);
const finitePoint=p=>Array.isArray(p)&&p.length===3&&p.every(v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1);
export function strutDomainGeometry(domain){
 if(!STRUT_DOMAINS.includes(domain))throw Error('The visual strut editor supports Hex and Tet reference cells.');
 return domain==='Tet'?{corners:TET_CORNERS,edges:[[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]],centre:[.25,.25,.25]}:{corners:HEX_CORNERS,edges:[[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]],centre:[.5,.5,.5]};
}
export const isStrutPoint=(p,domain)=>STRUT_DOMAINS.includes(domain)&&finitePoint(p)&&(domain!=='Tet'||p[0]+p[1]+p[2]<=1+DOMAIN_TOLERANCE);
const coordinateError=domain=>domain==='Tet'?'Tet node coordinates must be finite numbers with X ≥ 0, Y ≥ 0, Z ≥ 0 and X + Y + Z ≤ 1.':'Hex node coordinates must be finite numbers between 0 and 1.';
export function blankStrutDefinition(domain='Hex'){strutDomainGeometry(domain);return{type:'strut',definition:{pts:[],cnnt:[],ladomain:domain}};}
export function setStrutCellDomain(cell,domain){strutDomainGeometry(domain);cell.base.definition.ladomain=domain;}

// Keep a drag inside the reference element while leaving held coordinates
// unchanged. A Tet drag projects its movable coordinates onto the remaining
// non-negative simplex, so the node can slide along the sloping boundary.
export function constrainStrutDrag(domain,original,candidate,axes){
 strutDomainGeometry(domain);
 const moving=[0,1,2].filter(i=>axes.includes('xyz'[i])),out=original.map((v,i)=>moving.includes(i)?Math.max(0,Math.min(1,candidate[i])):v);
 if(domain==='Tet'&&moving.length){
  const budget=Math.max(0,1-original.reduce((sum,v,i)=>sum+(moving.includes(i)?0:v),0)),values=moving.map(i=>out[i]);
  if(budget===0)moving.forEach(i=>out[i]=0);
  else if(values.reduce((a,b)=>a+b,0)>budget){
   const sorted=[...values].sort((a,b)=>b-a);let sum=0,theta=0;
   for(let i=0;i<sorted.length;i++){sum+=sorted[i];const next=(sum-budget)/(i+1);if(sorted[i]>next)theta=next;}
   moving.forEach(i=>out[i]=Math.max(0,out[i]-theta));
  }
 }
 return out;
}

export function strutCellFromDefinition(value){
  if(value?.type!=='strut'||!STRUT_DOMAINS.includes(value.definition?.ladomain))throw Error('The visual strut editor supports Hex and Tet reference cells.');
  const {pts,cnnt}=value.definition;
  if(!Array.isArray(pts)||!Array.isArray(cnnt))throw Error('The definition needs node coordinates and connection pairs.');
  if(pts.length>STRUT_LIMITS.nodes||cnnt.length>STRUT_LIMITS.connections)throw Error('This cell is too large for interactive editing. Use the definition fields instead.');
  if(pts.some(p=>!isStrutPoint(p,value.definition.ladomain)))throw Error(coordinateError(value.definition.ladomain));
  if(cnnt.some(e=>!Array.isArray(e)||e.length!==2||e.some(i=>!Number.isInteger(i)||i<0||i>=pts.length)||e[0]===e[1]))throw Error('Connections must refer to two different zero-based node indices.');
  return {base:copy(value),nodes:pts.map((p,i)=>({id:i+1,position:copy(p)})),connections:cnnt.map((e,i)=>({id:i+1,start:e[0]+1,end:e[1]+1})),nextNodeId:pts.length+1,nextConnectionId:cnnt.length+1};
}
export function strutCellToDefinition(cell){
  const out=copy(cell.base),indices=new Map(cell.nodes.map((n,i)=>[n.id,i]));
  out.definition.pts=cell.nodes.map(n=>copy(n.position));
  out.definition.cnnt=cell.connections.map(e=>{if(!indices.has(e.start)||!indices.has(e.end))throw Error('A connection refers to a missing node.');return [indices.get(e.start),indices.get(e.end)];});
  return out;
}
export function cellNode(cell,id){return cell.nodes.find(n=>n.id===id);}
export function nodeAt(cell,p,except=null){return cell.nodes.find(n=>n.id!==except&&same(n.position,p));}
function checkedPoint(cell,p){if(!isStrutPoint(p,cell.base.definition.ladomain))throw Error(coordinateError(cell.base.definition.ladomain));return p;}
export function addCellNode(cell,p){
  checkedPoint(cell,p);if(nodeAt(cell,p))throw Error('A node already exists at this position.');
  if(cell.nodes.length>=STRUT_LIMITS.nodes)throw Error('The interactive node limit has been reached.');
  const position=copy(p);position.forEach((v,i)=>setNumber(position,i,v,'float'));
  const n={id:cell.nextNodeId++,position};cell.nodes.push(n);return n.id;
}
export function moveCellNode(cell,id,p){
  checkedPoint(cell,p);const n=cellNode(cell,id);if(!n)throw Error('Select an existing node.');
  if(nodeAt(cell,p,id))throw Error('Another node already occupies this position.');
  p.forEach((v,i)=>{if(!Object.is(v,n.position[i]))setNumber(n.position,i,v,'float');});
}
function checkConnection(cell,start,end,except=null){
  const a=cellNode(cell,start),b=cellNode(cell,end);
  if(!a||!b||start===end)throw Error('Choose two different existing nodes.');
  if(same(a.position,b.position))throw Error('A connection cannot have zero length.');
  if(cell.connections.some(e=>e.id!==except&&((e.start===start&&e.end===end)||(e.start===end&&e.end===start))))throw Error('These nodes are already connected.');
}
export function addCellConnection(cell,start,end){
  checkConnection(cell,start,end);if(cell.connections.length>=STRUT_LIMITS.connections)throw Error('The interactive connection limit has been reached.');
  const e={id:cell.nextConnectionId++,start,end};cell.connections.push(e);return e.id;
}
export function updateCellConnection(cell,id,start,end){checkConnection(cell,start,end,id);const e=cell.connections.find(e=>e.id===id);if(!e)throw Error('Select an existing connection.');e.start=start;e.end=end;}
export function removeCellSelection(cell,selection){
  if(selection?.kind==='node'){cell.nodes=cell.nodes.filter(n=>n.id!==selection.id);cell.connections=cell.connections.filter(e=>e.start!==selection.id&&e.end!==selection.id);}
  else if(selection?.kind==='connection')cell.connections=cell.connections.filter(e=>e.id!==selection.id);
}
export function addReferenceNodes(cell,positions){
  positions.forEach(p=>checkedPoint(cell,p));
  const missing=positions.filter(p=>!nodeAt(cell,p));if(cell.nodes.length+missing.length>STRUT_LIMITS.nodes)throw Error('The interactive node limit has been reached.');
  return missing.map(p=>addCellNode(cell,p));
}
export function connectCellHub(cell,id){
  if(!cellNode(cell,id))throw Error('Select a hub node first.');
  const corners=strutDomainGeometry(cell.base.definition.ladomain).corners,targets=cell.nodes.filter(n=>n.id!==id&&corners.some(p=>same(n.position,p))&&!cell.connections.some(e=>(e.start===id&&e.end===n.id)||(e.end===id&&e.start===n.id)));
  if(cell.connections.length+targets.length>STRUT_LIMITS.connections)throw Error('The interactive connection limit has been reached.');
  return targets.map(n=>addCellConnection(cell,id,n.id));
}
export function strutCellError(cell){
  if(!STRUT_DOMAINS.includes(cell.base.definition.ladomain))return 'Choose Hex or Tet as the reference domain.';
  if(cell.nodes.some(n=>!isStrutPoint(n.position,cell.base.definition.ladomain)))return coordinateError(cell.base.definition.ladomain);
  if(cell.nodes.length<2)return 'Add at least two nodes.';
  if(!cell.connections.length)return 'Add at least one connection.';
  const pairs=new Set();
  for(const e of cell.connections){const a=cellNode(cell,e.start),b=cellNode(cell,e.end);if(!a||!b||e.start===e.end)return 'A connection refers to missing or identical nodes.';if(same(a.position,b.position))return 'A connection has zero length.';const key=[e.start,e.end].sort((a,b)=>a-b).join(':');if(pairs.has(key))return 'Duplicate connections need to be removed before applying.';pairs.add(key);}
  return '';
}
export function strutCellWarnings(cell){
  const messages=[],used=new Set(cell.connections.flatMap(e=>[e.start,e.end]));
  const isolated=cell.nodes.filter(n=>!used.has(n.id)).length;if(isolated)messages.push(`${isolated} nodes have no connections.`);
  const seen=new Set();let duplicates=0;for(const n of cell.nodes){const key=n.position.map(v=>v.toPrecision(12)).join(':');if(seen.has(key))duplicates++;seen.add(key);}if(duplicates)messages.push('Some nodes occupy the same position; they have been preserved.');
  if(cell.connections.length){const adjacency=new Map(cell.nodes.filter(n=>used.has(n.id)).map(n=>[n.id,[]]));for(const e of cell.connections){adjacency.get(e.start)?.push(e.end);adjacency.get(e.end)?.push(e.start);}let components=0;const visited=new Set();for(const id of adjacency.keys()){if(visited.has(id))continue;components++;const pending=[id];while(pending.length){const n=pending.pop();if(visited.has(n))continue;visited.add(n);pending.push(...adjacency.get(n).filter(v=>!visited.has(v)));}}if(components>1)messages.push('The topology has disconnected groups.');}
  return messages;
}
