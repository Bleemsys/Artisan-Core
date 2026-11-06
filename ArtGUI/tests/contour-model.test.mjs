import test from 'node:test';
import assert from 'node:assert/strict';
import {contourSchedule,contourSpacing,contourError,contourMeshIds,contourFingerprint,contourPreviewWorkflow,contourResults} from '../ui/contour-model.js';
import {parseNumericJson,stringifyNumericJson} from '../ui/numeric-json.js';

test('an even schedule includes an aligned endpoint and avoids float drift',()=>{
  assert.deepEqual(contourSchedule(0,.3,.1),[0,.1,.2,.3]);
  assert.deepEqual(contourSchedule(-2,2,3),[-2,1]);
  assert.deepEqual(contourSpacing([20,40,60,80,100]),{start:20,end:100,step:20});
  assert.equal(contourSpacing([20,40,50]),null);
  for(const args of [[0,1,0],[1,0,1],[0,1001,1],[0,1,NaN]])assert.throws(()=>contourSchedule(...args));
});

test('contour preview runs the prefix into scratch and preserves the output mode and number tokens',()=>{
  const doc=parseNumericJson('{"Setup":{"res":[1.0,1.0,1.0]},"WorkFlow":{"1":{"Export":{"outfile":"keep.inp"}},"2":{"Gen_Z_ContourLines":{"res":[1.2,1.2,1.2],"PlaneHeights":[0,1.5],"out_meshfile":"SliceLines"}},"3":{"ExportMeshID":{"MeshID":"SliceLines","elem_type":"Line","out_meshfile":"line.inp"}}},"PostProcess":{"CombineMeshes":true}}');
  const before=stringifyNumericJson(doc),fingerprint=contourFingerprint(doc,'2');
  const preview=contourPreviewWorkflow(doc,'2','C:/ViewScratch/contours.contour');
  assert.deepEqual(Object.keys(preview.WorkFlow),['2']);
  assert.match(stringifyNumericJson(preview),/1\.0/);
  assert.equal(preview.WorkFlow['2'].Gen_Z_ContourLines.out_meshfile,'C:/ViewScratch/contours.contour');
  assert.equal(stringifyNumericJson(doc),before);
  assert.deepEqual(contourMeshIds(doc.WorkFlow,'3'),['SliceLines']);
  doc.WorkFlow['2'].Gen_Z_ContourLines.out_meshfile='output.contour';
  assert.equal(contourFingerprint(doc,'2'),fingerprint);
  assert.deepEqual(contourMeshIds(doc.WorkFlow,'3'),[]);
});

test('contour results include empty slices and reject incomplete or invalid geometry',()=>{
  const file=JSON.stringify({'0.0':{polygons:{'1':{vertices:[[1,2,0],[1,3,0],[2,3,0]]}}},'1.5':{polygons:{}}});
  const result=contourResults(file,[0,1.5]);
  assert.equal(result.get(0).length,1);
  assert.deepEqual(result.get(1.5),[]);
  assert.throws(()=>contourResults(file,[2]));
  assert.throws(()=>contourResults('{"0":{"polygons":{"x":{"vertices":[[1,2,0],[1,"x",0]]}}}}',[0]));
  assert.match(contourError({PlaneHeights:[0,0],res:[1,1,1],out_meshfile:'Paths'}),/distinct/);
});
