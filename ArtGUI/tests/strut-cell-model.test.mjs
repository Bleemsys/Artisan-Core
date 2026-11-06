import test from 'node:test';
import assert from 'node:assert/strict';
import {parseNumericJson,stringifyNumericJson,cloneNumericJson} from '../ui/numeric-json.js';
import {blankStrutDefinition,strutCellFromDefinition,strutCellToDefinition,addCellNode,moveCellNode,addCellConnection,updateCellConnection,removeCellSelection,addReferenceNodes,connectCellHub,strutCellError,strutCellWarnings,HEX_CORNERS,TET_CORNERS,strutDomainGeometry,isStrutPoint,setStrutCellDomain,constrainStrutDrag} from '../ui/strut-cell-model.js';

test('imports and exports numeric tokens, point order and unfamiliar definition fields without mutating input',()=>{
 const source=parseNumericJson('{"type":"strut","note":"custom","definition":{"pts":[[0.0,0,0e0],[1.0,1.0,1.0]],"cnnt":[[0,1]],"ladomain":"Hex","extra":{"factor":1.00}}}');
 const before=stringifyNumericJson(source),cell=strutCellFromDefinition(source);assert.equal(stringifyNumericJson(strutCellToDefinition(cell)),before);
 moveCellNode(cell,2,[.8,1,1]);assert.equal(stringifyNumericJson(source),before);assert.equal(strutCellToDefinition(cell).definition.extra.factor,1);
});
test('deletion and reordering preserve stable connectivity, with contiguous zero-based exported indices',()=>{
 const c=strutCellFromDefinition(blankStrutDefinition());const a=addCellNode(c,[0,0,0]),b=addCellNode(c,[1,0,0]),d=addCellNode(c,[1,1,1]);addCellConnection(c,a,d);addCellConnection(c,b,d);removeCellSelection(c,{kind:'node',id:b});c.nodes.reverse();const out=strutCellToDefinition(c);assert.deepEqual(out.definition.cnnt,[[1,0]]);assert.equal(c.connections[0].start,a);assert.equal(addCellNode(c,[0,1,0]),4);
});
test('rejects nonfinite/outside/duplicate points and invalid or duplicate connections atomically',()=>{
 const c=strutCellFromDefinition(blankStrutDefinition());addCellNode(c,[0,0,0]);addCellNode(c,[1,1,1]);addCellConnection(c,1,2);const before=cloneNumericJson(c);
 for(const p of [[NaN,0,0],[1.01,0,0],[0,0,0]])assert.throws(()=>addCellNode(c,p));
 assert.throws(()=>moveCellNode(c,2,[0,0,0]));assert.throws(()=>addCellConnection(c,2,1));assert.throws(()=>addCellConnection(c,1,99));assert.deepEqual(c,before);
});
test('reference insertion and hub connections create a complete editable custom cell',()=>{
 const c=strutCellFromDefinition(blankStrutDefinition());assert.equal(addReferenceNodes(c,HEX_CORNERS).length,8);assert.equal(addReferenceNodes(c,HEX_CORNERS).length,0);const hub=addCellNode(c,[.5,.5,.65]);assert.equal(connectCellHub(c,hub).length,8);assert.equal(strutCellError(c),'');assert.deepEqual(strutCellWarnings(c),[]);
});
test('reconnecting validates before changing an edge',()=>{
 const c=strutCellFromDefinition(blankStrutDefinition());addReferenceNodes(c,HEX_CORNERS);const a=addCellConnection(c,1,2);addCellConnection(c,1,3);assert.throws(()=>updateCellConnection(c,a,1,3));assert.equal(c.connections[0].end,2);updateCellConnection(c,a,2,4);assert.deepEqual(c.connections[0],{id:a,start:2,end:4});
});
test('preserves imported coincident nodes, reports invalid zero-length edges and excludes other domains',()=>{
 const value={type:'strut',definition:{pts:[[0,0,0],[0,0,0],[1,1,1]],cnnt:[[0,1]],ladomain:'Hex'}};const c=strutCellFromDefinition(value);assert.equal(c.nodes.length,3);assert.match(strutCellError(c),/zero length/);assert.ok(strutCellWarnings(c).some(m=>m.includes('same position')));assert.throws(()=>strutCellFromDefinition({...value,definition:{...value.definition,ladomain:'Other'}}),/reference cell/);
});

test('Tet uses the documented four vertices, centroid and coupled coordinate limits',()=>{
 assert.deepEqual(TET_CORNERS,[[0,0,0],[1,0,0],[0,1,0],[0,0,1]]);assert.equal(strutDomainGeometry('Tet').edges.length,6);assert.deepEqual(strutDomainGeometry('Tet').centre,[.25,.25,.25]);
 for(const p of [...TET_CORNERS,[1/3,1/3,1/3],[.2,.3,.5]])assert.equal(isStrutPoint(p,'Tet'),true);
 for(const p of [[.4,.4,.4],[-.01,0,0],[0,0,1.01],[NaN,0,0]])assert.equal(isStrutPoint(p,'Tet'),false);
 const cell=strutCellFromDefinition(blankStrutDefinition('Tet'));addReferenceNodes(cell,TET_CORNERS);const centre=addCellNode(cell,[.25,.25,.25]);assert.equal(connectCellHub(cell,centre).length,4);assert.equal(strutCellError(cell),'');
 const before=cloneNumericJson(cell);assert.throws(()=>moveCellNode(cell,centre,[.5,.5,.5]),/X \+ Y \+ Z/);assert.deepEqual(cell,before);
 assert.throws(()=>addReferenceNodes(cell,[[.1,.1,.1],[1,1,0]]));assert.deepEqual(cell,before);
});

test('switching domains preserves coordinates, IDs, connections and extras while reporting incompatible nodes',()=>{
 const cell=strutCellFromDefinition({type:'strut',note:'keep',definition:{pts:[[0,0,0],[.5,.5,.5]],cnnt:[[0,1]],ladomain:'Hex',custom:4}}),before=cloneNumericJson(cell);
 setStrutCellDomain(cell,'Tet');assert.deepEqual(cell.nodes,before.nodes);assert.deepEqual(cell.connections,before.connections);assert.match(strutCellError(cell),/X \+ Y \+ Z/);
 moveCellNode(cell,2,[.25,.25,.25]);assert.equal(strutCellError(cell),'');assert.equal(strutCellToDefinition(cell).definition.ladomain,'Tet');assert.equal(strutCellToDefinition(cell).note,'keep');
 setStrutCellDomain(cell,'Hex');assert.equal(strutCellError(cell),'');assert.throws(()=>setStrutCellDomain(cell,'Other'));assert.equal(cell.base.definition.ladomain,'Hex');
});

test('surface struts use square or triangle corners and stay in the XY plane when dragged',()=>{
 assert.deepEqual(strutDomainGeometry('Quad').corners,[[0,0,0],[1,0,0],[1,1,0],[0,1,0]]);
 assert.deepEqual(strutDomainGeometry('Triangle').corners,[[0,0,0],[1,0,0],[0,1,0]]);
 assert.equal(isStrutPoint([.8,.8,0],'Quad'),true);
 assert.equal(isStrutPoint([.8,.8,0],'Triangle'),false);
 assert.equal(isStrutPoint([.2,.2,.1],'Quad'),false);
 assert.deepEqual(constrainStrutDrag('Triangle',[.25,.25,0],[1,1,1],'xy'),[.5,.5,0]);
 assert.deepEqual(constrainStrutDrag('Triangle',[.25,.25,0],[1,1,1],'x'),[.75,.25,0]);
 assert.deepEqual(constrainStrutDrag('Quad',[.25,.25,0],[1,1,1],'xyz'),[1,1,0]);
});

test('Tet definitions round trip exact numeric tokens and reject points outside the simplex',()=>{
 const raw='{"type":"strut","note":1.00,"definition":{"pts":[[0.0,0,0e0],[1.00,0.0,0.0],[0.25,0.25,0.25]],"cnnt":[[0,2],[1,2]],"ladomain":"Tet","extra":3.00}}',source=parseNumericJson(raw);
 assert.equal(stringifyNumericJson(strutCellToDefinition(strutCellFromDefinition(source))),stringifyNumericJson(source));
 assert.throws(()=>strutCellFromDefinition({type:'strut',definition:{pts:[[.5,.5,.5]],cnnt:[],ladomain:'Tet'}}),/Tet/);
});

test('drag limits preserve held axes and slide along Tet faces, edges and vertices',()=>{
 const p=[.25,.25,.25],xy=constrainStrutDrag('Tet',p,[.9,.9,.9],'xy');assert.deepEqual(xy,[.375,.375,.25]);
 assert.deepEqual(constrainStrutDrag('Tet',p,[.9,.9,.9],'x'),[.5,.25,.25]);
 assert.deepEqual(constrainStrutDrag('Tet',[0,0,1],[.9,.9,1],'xy'),[0,0,1]);
 assert.deepEqual(constrainStrutDrag('Hex',p,[2,-1,.8],'xy'),[1,0,.25]);
 for(const axes of ['x','y','z','xy','xz','yz'])for(const candidate of [[.9,.7,.8],[-1,.5,2],[1,0,0],[.1,.1,.1]]){
  const out=constrainStrutDrag('Tet',p,candidate,axes);assert.equal(isStrutPoint(out,'Tet'),true);for(let i=0;i<3;i++)if(!axes.includes('xyz'[i]))assert.equal(out[i],p[i]);
 }
});
