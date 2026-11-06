import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyCellMesh,meshFromArrays,parseCellMesh,inspectCellMesh,exampleFrameMesh,cellMeshObj,compactCellMesh,faceGeometry,fitCellMesh,transformCellMesh,referencePlate,addPlate,updateMeshVertex,translateMeshFace,reverseMeshFace,removeMeshFace,constrainMeshDelta} from '../ui/mesh-cell-model.js';
const bytes=text=>new TextEncoder().encode(text).buffer;
test('authored frame is closed, outward-oriented and round trips as editable OBJ polygons',()=>{
 const mesh=exampleFrameMesh(),a=inspectCellMesh(mesh,'Geom','Hex');assert.deepEqual(a.errors,[]);assert.equal(a.openEdges,0);assert.ok(a.volume>0);assert.equal(mesh.faces[0].indices.length,4);
 const restored=parseCellMesh(bytes(cellMeshObj(mesh)),'frame.obj');assert.deepEqual(compactCellMesh(restored),compactCellMesh(mesh));assert.deepEqual(inspectCellMesh(restored,'Geom','Hex').errors,[]);
 assert.ok(cellMeshObj(mesh).split('\n').filter(l=>l.startsWith('f ')).every(l=>l.trim().split(/\s+/).length===4));
 const reversed=inspectCellMesh(reverseMeshFace(mesh),'Geom','Hex');assert.ok(reversed.errors.some(e=>e.includes('inward')));
});
test('STL import welds coincident vertices and preserves complete binary and ASCII triangles',()=>{
 const buffer=new ArrayBuffer(84+2*50),view=new DataView(buffer);view.setUint32(80,2,true);const triangles=[[[0,0,.5],[1,0,.5],[1,1,.5]],[[0,0,.5],[1,1,.5],[0,1,.5]]];triangles.forEach((t,i)=>t.flat().forEach((v,j)=>view.setFloat32(84+i*50+12+j*4,v,true)));
 const binary=parseCellMesh(buffer,'surface.stl');assert.equal(binary.vertices.length,4);assert.equal(binary.faces.length,2);assert.deepEqual(inspectCellMesh(binary,'Geom-Plate','Hex').errors,[]);assert.ok(inspectCellMesh(binary,'Geom','Hex').errors.some(e=>e.includes('closed')));
 const ascii=parseCellMesh(bytes('solid surface\n'+triangles.map(t=>'facet normal 0 0 1\nouter loop\n'+t.map(p=>'vertex '+p.join(' ')).join('\n')+'\nendloop\nendfacet').join('\n')+'\nendsolid'),'surface.stl');assert.deepEqual(compactCellMesh(ascii),compactCellMesh(binary));
});
test('OBJ negative indices work and malformed, degenerate, crossing or nonplanar faces fail atomically',()=>{
 const obj='v 0 0 .5\nv 1 0 .5\nv 1 1 .5\nv 0 1 .5\nf -4/-1 -3/-1 -2/-1 -1/-1';assert.equal(parseCellMesh(bytes(obj),'plate.obj').faces[0].indices.length,4);
 for(const input of ['v 0 0 0\nf 1 2 3','v NaN 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3','v 0 0 0'])assert.throws(()=>parseCellMesh(bytes(input),'bad.obj'));
 assert.throws(()=>meshFromArrays([[0,0,0],[1,1,0],[1,0,0],[0,1,0]],[[0,1,2,3]]));assert.throws(()=>meshFromArrays([[0,0,0],[1,0,0],[1,1,.2],[0,1,0]],[[0,1,2,3]]),/plane/);
});
test('concave polygons triangulate with their declared normal and duplicate faces are identified',()=>{
 const mesh=meshFromArrays([[0,0,.5],[1,0,.5],[1,1,.5],[.5,.4,.5],[0,1,.5]],[[0,1,2,3,4]]),info=faceGeometry(mesh,mesh.faces[0]);assert.equal(info.triangles.length,3);assert.ok(info.normal[2]>0);assert.ok(faceGeometry(reverseMeshFace(mesh),reverseMeshFace(mesh).faces[0]).normal[2]<0);
 mesh.faces.push({...mesh.faces[0],id:2});assert.ok(inspectCellMesh(mesh,'Geom-Plate','Hex').errors.some(e=>e.includes('Duplicate')));
});
test('fitting retains proportions and contains Geometry or Plate meshes in Hex and Tet',()=>{
 const mesh=transformCellMesh(exampleFrameMesh(),{scale:[24,18,20],translation:[100,200,300]}),before=JSON.stringify(mesh);
 for(const domain of ['Hex','Tet']){const fitted=fitCellMesh(mesh,domain),a=inspectCellMesh(fitted,'Geom',domain);assert.deepEqual(a.errors,[]);assert.ok(Math.abs(a.bounds.size[1]/a.bounds.size[0]-18/24)<1e-8);assert.ok(Math.abs(a.bounds.size[2]/a.bounds.size[0]-20/24)<1e-8);}
 assert.equal(JSON.stringify(mesh),before);assert.throws(()=>transformCellMesh(mesh,{scale:[0,1,1]}));
});
test('plate creation, edits and export preserve face identity and reject invalid coupled edits',()=>{
 let result=addPlate(emptyCellMesh(),referencePlate('XY',.5,'Hex'),'Hex'),mesh=result.mesh;assert.equal(result.id,1);assert.equal(faceGeometry(mesh,mesh.faces[0]).plane,'XY');assert.throws(()=>addPlate(mesh,referencePlate('XY',.5,'Hex'),'Hex'),/already exists/);
 const before=JSON.stringify(mesh);assert.throws(()=>updateMeshVertex(mesh,0,[0,0,.7],'Hex'),/plane/);assert.equal(JSON.stringify(mesh),before);
 mesh=translateMeshFace(mesh,1,[0,0,.2],'Hex');assert.ok(Math.abs(faceGeometry(mesh,mesh.faces[0]).position-.7)<1e-12);assert.throws(()=>translateMeshFace(mesh,1,[0,0,.5],'Hex'));
 const next=addPlate(mesh,referencePlate('XZ',.5,'Hex'),'Hex');assert.equal(next.id,2);const removed=removeMeshFace(next.mesh,1);assert.equal(removed.faces[0].id,2);assert.equal(compactCellMesh(removed).vertices.length,4);
 const tet=addPlate(emptyCellMesh(),referencePlate('XY',.4,'Tet'),'Tet');assert.equal(tet.mesh.faces[0].indices.length,3);assert.deepEqual(inspectCellMesh(tet.mesh,'Geom-Plate','Tet').errors,[]);
});
test('mouse displacement is clipped as one vector, preserving face planarity and held coordinates',()=>{
 const points=[[.2,.2,.2],[.4,.2,.2],[.2,.4,.2]],delta=constrainMeshDelta('Tet',points,[1,1,0]);for(const p of points){const next=p.map((v,a)=>v+delta[a]);assert.ok(next.reduce((a,b)=>a+b,0)<=1+1e-9);assert.equal(next[2],.2);}assert.ok(Math.abs(delta[0]-delta[1])<1e-12);
 assert.deepEqual(constrainMeshDelta('Hex',[[0,0,0],[1,1,0]],[0,0,2]),[0,0,1]);
});
