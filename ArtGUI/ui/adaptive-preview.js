import * as THREE from './vendor/three.module.js';
import {PREVIEW_BYTES, GRAPHICS_BYTES, projectedDiameter, selectPreviewTiles, selectPreviewTileGroups} from './preview-policy.mjs';
import {prepareHierarchy} from './adaptive-hierarchy.js';

// The native cache owns spatial indexing. Only a few small blocks enter the WebView.
export function createAdaptivePreview({viewer, fileUrl, invoke, onStats = () => {}, toast = () => {}}) {
  const states = new Map();
  let timer = null, serial = 0, inFlight = 0, paused = false, tileBudget = PREVIEW_BYTES, drawQueued=false, preferSurface=true;
  const oldBefore=viewer.onBeforePreviewRender;
  viewer.onBeforePreviewRender=()=>{
    oldBefore?.();viewer.camera.updateMatrixWorld();
    const frustum=new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(viewer.camera.projectionMatrix,viewer.camera.matrixWorldInverse));
    for(const state of states.values())if(state.hierarchy&&!state.disposed&&viewer.layers.get(state.id)===state.layer)state.hierarchy.update(frustum,viewer.canvas.clientHeight||800);
    queueMicrotask(pump);
  };
  const oldRender = viewer.onPreviewRender;
  viewer.onPreviewRender = () => { oldRender?.(); schedule(); };
  viewer.onLayerDisposed = id => remove(id);
  viewer.canvas.addEventListener?.('webglcontextlost', event => {
    event.preventDefault(); paused = true; tileBudget = Math.max(8 * 1024 ** 2, tileBudget / 2);
    for (const state of states.values()) {
      for (const request of state.pending.values()) request.abort();
      for (const child of state.loaded.values()) {child.parent?.remove(child);child.geometry.dispose();}
      state.loaded.clear();state.hierarchy?.contextLost();
    }
    toast('Graphics resources were interrupted. Preview will resume with a smaller detail budget.');
  });
  viewer.canvas.addEventListener?.('webglcontextrestored', () => { paused = false; viewer.render(); schedule(); });

  function schedule() { if(timer!==null)return;timer=setTimeout(()=>{timer=null;update();},80); }
  function requestDraw(){if(drawQueued)return;drawQueued=true;(globalThis.requestAnimationFrame||((f)=>setTimeout(f,16)))(()=>{drawQueued=false;viewer.render();});}
  function pump(){
    if(paused)return;
    while(inFlight<2){
      let chosen=null;
      for(const state of states.values()){
        if(state.disposed)continue;
        const surface=state.hierarchy?.next(),tile=[...state.desired].find(id=>!state.loaded.has(id)&&!state.pending.has(id)&&!state.failed.has(id));
        if(preferSurface&&surface!==undefined){chosen={state,surface};break;}
        if(tile!==undefined){chosen={state,tile};break;}
        if(surface!==undefined){chosen={state,surface};break;}
      }
      if(!chosen)break;
      preferSurface=!preferSurface;
      if(chosen.surface!==undefined){inFlight++;chosen.state.hierarchy.load(chosen.surface).finally(()=>{inFlight--;if(!chosen.state.disposed){report(chosen.state);pump();}});}
      else loadTile(chosen.state,chosen.state.tiles[chosen.tile]);
    }
  }
  function remove(id) {
    const state = states.get(id); if (!state) return;
    state.disposed = true;state.hierarchy?.close();
    for (const request of state.pending.values()) request.abort();
    for (const child of state.loaded.values()) { child.parent?.remove(child); child.geometry.dispose(); }
    state.pending.clear(); state.loaded.clear(); states.delete(id);
  }
  function clear() { for (const id of [...states.keys()]) remove(id); clearTimeout(timer);timer=null; }

  async function read(path, expected, signal) {
    if (!expected) return new Float32Array();
    if (expected > 4 * 1024 ** 2 && !path.endsWith('overview.bin') && !path.endsWith('overview-lines.bin')) throw Error('Preview block exceeds its memory budget.');
    const response = await fetch(fileUrl(path), {signal});
    if (!response.ok) throw Error(`Could not read preview block (${response.status}).`);
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength !== expected) throw Error('Preview cache block has changed or is incomplete. Open Preview again.');
    const positions = new Float32Array(bytes);
    for (let i = 0; i < positions.length; i++) if (!Number.isFinite(positions[i])) throw Error('Preview contains invalid coordinates.');
    return positions;
  }

  async function open(manifest, {id, path, signal, current = () => true}) {
    let hierarchy=null;
    if(manifest.lod){
      const poolBytes=Math.min(2048,manifest.lod.nodes.length)*512*32;
      if(poolBytes+viewer.geometryBytes()>GRAPHICS_BYTES){await invoke('close_preview_lod',{handle:manifest.lod.handle}).catch(()=>{});throw Error('The viewer memory budget is full. Close an unused model before opening another preview.');}
      hierarchy=await prepareHierarchy({manifest,viewer,invoke,current,signal,onDirty:requestDraw,toast});
      if(!hierarchy)return false;
      try{viewer.setLayer(id,new Float32Array(),{center:manifest.center,bounds:[manifest.boundsMin,manifest.boundsMax],path,mode:'quick',total:manifest.triangles,previewFactory:hierarchy.factory});}
      catch(error){hierarchy.close();throw error;}
    }else{
      const overviewBytes=manifest.overviewCount*36+manifest.overviewLinesCount*24;
      if(overviewBytes+viewer.geometryBytes()>GRAPHICS_BYTES)throw Error('The viewer memory budget is full. Close an unused model before opening another preview.');
      const [positions,lines]=await Promise.all([read(manifest.overviewPath,manifest.overviewCount*36,signal),read(manifest.overviewLinesPath,manifest.overviewLinesCount*24,signal)]);
      if(!current()||signal?.aborted)return false;
      viewer.setLayer(id,positions,{center:manifest.center,bounds:[manifest.boundsMin,manifest.boundsMax],path,mode:'quick',total:manifest.triangles,lines});
    }
    const layer=viewer.layers.get(id);
    hierarchy?.attach(layer);
    if(hierarchy&&manifest.tiles.some(tile=>tile.vertices===2)){
      const beams=new THREE.LineSegments(new THREE.BufferGeometry(),viewer.lineMaterial(layer.material,layer.material.uniforms.opacity.value));
      beams.userData.role='beams';layer.mesh.add(beams);
    }
    const tiles = manifest.tiles.map(tile => {
      const box = new THREE.Box3(new THREE.Vector3(...tile.min).sub(viewer.origin), new THREE.Vector3(...tile.max).sub(viewer.origin));
      const sphere = box.getBoundingSphere(new THREE.Sphere());
      return {...tile, cell:manifest.lod?.tileCells?.[tile.id]??tile.cell, box, sphere, bytes: tile.count * tile.vertices * 12};
    });
    states.set(id, {id, path, serial: ++serial, manifest, layer, tiles, loaded: new Map(), pending: new Map(), desired: new Set(), disposed: false, failed: new Set(),hierarchy});
    layer.preview = manifest;requestDraw();schedule();return true;
  }

  function update() {
    if (paused) return;
    const camera = viewer.camera; camera.updateMatrixWorld();
    const frustum = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    const height = viewer.canvas.clientHeight || 800;
    for (const state of states.values()) {
      if (state.disposed || viewer.layers.get(state.id) !== state.layer) { remove(state.id); continue; }
      const visible = state.layer.mesh.visible && state.layer.material.uniforms.opacity.value > 0;
      const candidates = visible ? state.tiles.map(tile => {
        const distance = Math.max(camera.position.distanceTo(tile.sphere.center), 1e-10);
        const pixels = projectedDiameter(tile.sphere.radius, distance, height, {orthographicSpan: camera.isOrthographicCamera ? camera.top - camera.bottom : 0, fov: camera.fov || 42, zoom: camera.zoom});
        const sectionVisible = !viewer.section.enabled || (() => {
          const p = viewer.plane, corner = new THREE.Vector3(p.x >= 0 ? tile.box.max.x : tile.box.min.x, p.y >= 0 ? tile.box.max.y : tile.box.min.y, p.z >= 0 ? tile.box.max.z : tile.box.min.z);
          return p.x * corner.x + p.y * corner.y + p.z * corner.z + p.w >= 0;
        })();
        const focusDistance = Math.max(viewer.controls.target.distanceTo(tile.sphere.center), tile.sphere.radius * .25, 1e-10);
        return {...tile, pixels, score: pixels / (1 + focusDistance / Math.max(tile.sphere.radius, 1e-10)), visible: sectionVisible && frustum.intersectsBox(tile.box) && !state.failed.has(tile.id)};
      }) : [];
      const otherBytes = Math.max(0, viewer.geometryBytes() - [...state.loaded.values()].reduce((n, child) => n + child.geometry.attributes.position.array.byteLength, 0));
      const budget = Math.min(tileBudget, Math.max(0, GRAPHICS_BYTES / 2 - otherBytes));
      state.desired = new Set((state.hierarchy?selectPreviewTileGroups:selectPreviewTiles)(candidates, new Set(state.loaded.keys()), budget));
      let changed = false;
      for (const [id, controller] of state.pending) if (!state.desired.has(id)) controller.abort();
      for (const [id, child] of state.loaded) if (!state.desired.has(id)) { child.parent?.remove(child); child.geometry.dispose(); state.loaded.delete(id); changed = true; }
      if(changed){state.hierarchy?.exact(state.loaded);report(state);requestDraw();}
    }
    pump();
  }

  async function loadTile(state, tile) {
    const controller = new AbortController(); state.pending.set(tile.id, controller); inFlight++;
    try {
      const positions = await read(tile.path, tile.bytes, controller.signal);
      if (controller.signal.aborted || state.disposed || !state.desired.has(tile.id) || viewer.layers.get(state.id) !== state.layer) return;
      const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.computeBoundingSphere();
      let child;
      if (tile.vertices === 3) child = new THREE.Mesh(geometry, state.layer.material);
      else {
        const lineMaterial = state.layer.mesh.children.find(c => c.userData.role === 'beams')?.material;
        if (!lineMaterial) { geometry.dispose(); return; }
        child = new THREE.LineSegments(geometry, lineMaterial);
      }
      child.userData.previewTile = true;
      try {viewer.validateUpload?.(child);} catch (error) {geometry.dispose();throw error;}
      state.layer.mesh.add(child); state.loaded.set(tile.id, child);
      state.hierarchy?.exact(state.loaded);report(state);requestDraw();
    } catch (error) {
      if (error.name !== 'AbortError' && !state.disposed) {
        state.failed.add(tile.id);
        if (!state.warned) { toast(`Preview detail could not load: ${error.message}. The overview remains available.`); state.warned = true; }
      }
    } finally {
      inFlight--;
      if (state.pending.get(tile.id) === controller) state.pending.delete(tile.id);
      if(!state.disposed)pump();
    }
  }
  function report(state) {
    onStats(state.id, {triangles: state.manifest.overviewCount + [...state.loaded.entries()].reduce((n, [id]) => n + (state.tiles[id].vertices === 3 ? state.tiles[id].count : 0), 0), loadedTiles: state.loaded.size, total: state.manifest.triangles,...state.hierarchy?.stats()});
  }
  return {open, remove, clear, schedule, states};
}
