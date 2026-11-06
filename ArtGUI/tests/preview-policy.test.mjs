import {test} from 'node:test';
import assert from 'node:assert/strict';
import {projectedDiameter, selectPreviewTiles, admitFullDetail, resourceBudgets, initialGeometryMode, AUTO_FULL_DETAIL_BYTES} from '../ui/preview-policy.mjs';

test('initial detail selection uses an inclusive 800 MB file-size boundary',()=>{
 assert.equal(AUTO_FULL_DETAIL_BYTES,800*1024**2);
 for(const bytes of [1,10*1024**2,AUTO_FULL_DETAIL_BYTES-1,AUTO_FULL_DETAIL_BYTES])assert.equal(initialGeometryMode(bytes),'full');
 for(const bytes of [AUTO_FULL_DETAIL_BYTES+1,1024**3,20*1024**3])assert.equal(initialGeometryMode(bytes),'quick');
 for(const bytes of [undefined,null,NaN,Infinity,-1,0,'100',1.5])assert.equal(initialGeometryMode(bytes),'quick');
});

test('screen size follows zoom and model scale in both camera projections', () => {
  const far = projectedDiameter(2, 100, 800);
  assert.equal(projectedDiameter(20, 1000, 800), far);
  assert.equal(projectedDiameter(2, 50, 800), far * 2);
  assert.equal(projectedDiameter(2, 100, 800, {orthographicSpan: 100}), 32);
  assert.equal(projectedDiameter(2, 1000, 800, {orthographicSpan: 100, zoom: 2}), 64);
});
test('selection respects visibility, byte budget, priority, and hysteresis', () => {
  const tiles = [
    {id: 0, pixels: 90, visible: true, score: 3, count: 100, vertices: 3},
    {id: 1, pixels: 60, visible: true, score: 2, count: 100, vertices: 3},
    {id: 2, pixels: 200, visible: false, score: 4, count: 100, vertices: 3},
  ];
  assert.deepEqual(selectPreviewTiles(tiles, new Set(), 7200), [0]);
  assert.deepEqual(selectPreviewTiles(tiles, new Set([1]), 7200), [0, 1]);
  assert.deepEqual(selectPreviewTiles(tiles, new Set([1]), 3600), [0]);
  tiles[1].pixels = 51;
  assert.deepEqual(selectPreviewTiles(tiles, new Set([1]), 7200), [0]);
});
test('a refused or unavailable resource check only warns and never mutates the viewer', async () => {
  const viewer = {geometryBytes: () => 123}; let warnings = [];
  const before = JSON.stringify(viewer);
  assert.equal(await admitFullDetail({viewer, path: 'huge.stl', workflowPath: null, warn: m => warnings.push(m),
    invoke: async (command, args) => {assert.equal(command, 'check_full_detail');assert.equal(args.residentGraphicsBytes, 123);return {allowed: false, reason: 'Insufficient resources'};}}), false);
  assert.equal(JSON.stringify(viewer), before); assert.deepEqual(warnings, ['Insufficient resources']);
  assert.equal(await admitFullDetail({viewer, warn: m => warnings.push(m), invoke: async () => {throw Error('offline');}}), false);
  assert.match(warnings[1], /Continue using Preview/);
});
test('admitted loads proceed; unavailable GPU telemetry is a conservative budget, not invented VRAM', async () => {
  const viewer = {geometryBytes: () => 0};
  const budgets = resourceBudgets(viewer, {memory: {jsHeapSizeLimit: 1000, usedJSHeapSize: 500}});
  assert.equal(budgets.heapAvailableBytes, 350);
  assert.equal(resourceBudgets(viewer, {}).heapAvailableBytes, null);
  assert.equal(await admitFullDetail({viewer, invoke: async () => ({allowed: true}), warn: () => assert.fail('unexpected warning')}), true);
});
