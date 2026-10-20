import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../ui/vendor/three.module.js';
import {createAdaptivePreview} from '../ui/adaptive-preview.js';

test('camera zoom streams exact tiles, zoom out evicts, and removing a layer cancels its work', async () => {
  const originalFetch = globalThis.fetch;
  const triangle = new Float32Array([0,0,0, 1,0,0, 0,1,0]);
  let reads = 0;
  globalThis.fetch = async () => {reads++; return new Response(triangle.buffer.slice(0));};
  const camera = new THREE.PerspectiveCamera(42, 1, .01, 10000);
  camera.position.set(.5, .5, 5); camera.lookAt(.5, .5, 0); camera.updateProjectionMatrix();
  const viewer = {camera, canvas: {clientHeight: 800}, layers: new Map(), origin: new THREE.Vector3(),
    controls: {target: new THREE.Vector3(.5, .5, 0)}, section: {enabled: false},
    geometryBytes() {let n=0;for(const l of this.layers.values())l.mesh.traverse(c=>{n+=c.geometry?.attributes.position?.array.byteLength||0;});return n;},
    setLayer(id, positions) {this.onLayerDisposed?.(id);const geometry = new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));const material=new THREE.ShaderMaterial({uniforms:{opacity:{value:1}}});const mesh=new THREE.Mesh(geometry,material);this.layers.set(id,{mesh,material});},
    render() {this.onPreviewRender?.();}};
  const controller = createAdaptivePreview({viewer, fileUrl: p => p});
  try {
    await controller.open({overviewPath:'overview.bin',overviewLinesPath:'overview-lines.bin',overviewCount:1,overviewLinesCount:0,center:[0,0,0],boundsMin:[0,0,0],boundsMax:[1,1,0],triangles:1,tiles:[{id:0,path:'tile-0.bin',count:1,vertices:3,min:[0,0,0],max:[1,1,0]}]}, {id:'result',path:'test.stl'});
    await new Promise(resolve => setTimeout(resolve, 380));
    assert.equal(controller.states.get('result').loaded.size,1);assert.equal(reads,2);
    camera.position.z=100;viewer.render();
    await new Promise(resolve => setTimeout(resolve, 220));
    assert.equal(controller.states.get('result').loaded.size,0);
    controller.remove('result');assert.equal(controller.states.size,0);
  } finally {controller.clear();globalThis.fetch=originalFetch;}
});
