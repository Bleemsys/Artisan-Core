import test from 'node:test';
import assert from 'node:assert/strict';
import {latticeError,latticeWorkflowError,latticeThicknessKind,latticePreviewWorkflow,latticePreviewKey} from '../ui/lattice-model.js';
import {spatialTargets,applySpatialGeometry} from '../ui/spatial-model.js';
import {parseNumericJson,stringifyNumericJson} from '../ui/numeric-json.js';
const params=()=>parseNumericJson('{"la_name":"BCCubic","size":[2.0,2.0,2.0],"thk":0.16,"Rot":[0.0,0.0,0.0],"Trans":[0.0,0.0,0.0],"Fill":true,"Inv":false,"Cube_Request":{}}');
test('lattice validation and thickness labels preserve public parameter meanings',()=>{
 const p=params();assert.equal(latticeError(p),'');delete p.Inv;assert.match(latticeError(p),/boolean/);p.Inv=false;p.size[1]=0;assert.match(latticeError(p),/positive/);p.size[1]=2;p.Cube_Request={custom:3};assert.match(latticeError(p),/ID/);p.Cube_Request.ID=0;assert.equal(latticeError(p),'');
 assert.equal(latticeThicknessKind('BCCubic'),'strut');assert.equal(latticeThicknessKind('Gyroid'),'TPMS');assert.equal(latticeThicknessKind('Custom','strut'),'strut');assert.equal(latticeThicknessKind('Custom.mld'),'other');assert.match(latticeWorkflowError({'2':{Add_Lattice:{}}}),/Step 2/);
});
test('lattice preview retains prerequisites and numeric tokens but never later steps or earlier exports',()=>{
 const doc={Setup:{Type:'Sample',res:[.1,.1,.1]},WorkFlow:{'1':{Define_Lattice:{la_name:'Custom',definition:{type:'strut',definition:{pts:[]}}}},'2':{Export:{outfile:'original.stl'}},'3':{Add_Lattice:{...params(),custom:{keep:7}}},'4':{HS_Interpolate:{invalid:'later'}}},PostProcess:{CleanExportedMesh:false},ArtGUI:{geometry:[]}};
 const before=stringifyNumericJson(doc),out=latticePreviewWorkflow(doc,'3','preview.stl');assert.deepEqual(Object.keys(out.WorkFlow),['1','2','3']);assert.ok(out.WorkFlow['1'].Define_Lattice);assert.equal(out.WorkFlow['2'].Add_Lattice.custom.keep,7);assert.equal(out.WorkFlow['3'].Export.outfile,'preview.stl');assert.equal(out.ArtGUI,undefined);assert.equal(stringifyNumericJson(doc),before);assert.match(stringifyNumericJson(out),/2\.0/);
 const key=latticePreviewKey(doc,'3');doc.WorkFlow['4'].HS_Interpolate.invalid='change';assert.equal(latticePreviewKey(doc,'3'),key);doc.ArtGUI.geometry.push({path:'display.stl'});assert.equal(latticePreviewKey(doc,'3'),key);doc.WorkFlow['1'].Define_Lattice.definition.definition.changed=true;assert.notEqual(latticePreviewKey(doc,'3'),key);doc.Setup.res[0]=.2;assert.notEqual(latticePreviewKey(doc,'3'),key);
});
test('lattice frame handles move and rotate independently without changing cell size or thickness',()=>{
 const p=params(),target=spatialTargets('Add_Lattice',p).targets[0];assert.equal(target.kind,'lattice');assert.deepEqual(target.modes,['move','rotate']);applySpatialGeometry('Add_Lattice',p,target,{...target.geometry,center:[4,5,6]},'move');assert.deepEqual(p.Trans,[4,5,6]);assert.deepEqual(p.size,[2,2,2]);applySpatialGeometry('Add_Lattice',p,target,{...target.geometry,rotation_axis:[0,0,1],rotation_degrees:90},'rotate');assert.ok(Math.abs(p.Rot[2]-Math.PI/2)<1e-10);assert.equal(p.thk,.16);assert.deepEqual(p.Trans,[4,5,6]);assert.throws(()=>applySpatialGeometry('Add_Lattice',p,target,target.geometry,'resize'),/unavailable/);
});
