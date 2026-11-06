import test from 'node:test';
import assert from 'node:assert/strict';
import {geometryOperationError,geometryPreviewWorkflow,geometrySource} from '../ui/geometry-model.js';
import {parseNumericJson,stringifyNumericJson} from '../ui/numeric-json.js';

const sphere=()=>parseNumericJson('{"Name":"Sphere","Paras":{"ori":[0.0,0.0,0.0],"r":1.5},"k_factor":1.7,"push2GeomField":false}');
test('smoothing accepts zero and values greater than one; rejects negative and nonfinite',()=>{
 const p=sphere();assert.equal(geometryOperationError(p),'');p.k_factor=0;assert.equal(geometryOperationError(p),'');
 for(const n of [-1,NaN,Infinity]){p.k_factor=n;assert.ok(geometryOperationError(p));}
});
test('invalid primitive dimensions are rejected and mesh transforms remain editable before loading',()=>{
 const p=sphere();p.Paras.r=0;assert.ok(geometryOperationError(p));p.Paras.r=2;p.Paras.ori[1]=NaN;assert.ok(geometryOperationError(p));
 assert.equal(geometryOperationError({Name:'part.stl',Paras:{Scale:[1,2,3],Trans:[0,0,0],Rot:[0,0,0]}}),'');
 assert.ok(geometryOperationError({Name:'part.stl',Paras:{Scale:[1,0,1]}}));
 assert.equal(geometrySource({Source:{Type:'Field',ID:'mask'}}),'Field');
});
test('geometry preview excludes earlier exports and downstream commands without changing saved workflow',()=>{
 const p=sphere(),doc={Setup:{Type:'Sample'},WorkFlow:{1:{Add_Geometry:sphere(),Export:{outfile:'earlier.stl'},ExportMeshID:{MeshID:'stored',outfile:'stored.stl'}},2:{Subtract_Geometry:p},3:{Add_Lattice:{la_name:'Cubic'}},4:{Export:{outfile:'final.stl'}}},PostProcess:{CombineMeshes:true},ArtGUI:{version:1}};
 const before=stringifyNumericJson(doc),preview=geometryPreviewWorkflow(doc,'2','Subtract_Geometry','preview.stl');
 assert.equal(stringifyNumericJson(doc),before);assert.equal(preview.ArtGUI,undefined);assert.equal(Object.keys(preview.WorkFlow).length,3);
 assert.ok(preview.WorkFlow[1].Add_Geometry);assert.equal(preview.WorkFlow[1].Export,undefined);assert.equal(preview.WorkFlow[1].ExportMeshID,undefined);assert.deepEqual(preview.WorkFlow[3],{Export:{outfile:'preview.stl'}});
 assert.match(stringifyNumericJson(preview),/0\.0/);assert.throws(()=>geometryPreviewWorkflow(doc,'3','Subtract_Geometry','x.stl'));
});
