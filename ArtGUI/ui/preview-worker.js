const MAX_QUICK_TRIANGLES = 120_000;
let cancelled = false;

self.onmessage = async ({ data }) => {
  cancelled = false;
  try {
    await loadStl(data.url, data.mode, data.fileSize || 0);
  } catch (error) {
    if (!cancelled) self.postMessage({ type: 'error', message: error?.message || String(error) });
  }
};

self.onmessageerror = () => self.postMessage({ type: 'error', message: 'Could not read the geometry data.' });

function joinBytes(a, b) {
  if (!a.length) return b;
  const out = new Uint8Array(a.length + b.length);
  out.set(a); out.set(b, a.length);
  return out;
}

function targetFaceCount(total, mode) {
  return mode === 'full' ? total : Math.min(total, MAX_QUICK_TRIANGLES);
}

function allocPositions(faceCount) {
  try {
    return new Float32Array(faceCount * 9);
  } catch (error) {
    if (error instanceof RangeError) {
      throw new Error('Could not allocate memory for full-detail geometry. Use Quick Preview or a smaller mesh.');
    }
    throw error;
  }
}

async function loadStl(url, mode, expectedSize) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not read STL (${response.status}).`);
  const contentLength = Number(response.headers.get('content-length')) || expectedSize || 0;
  const reader = response.body?.getReader();
  if (!reader) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    parseWholeFile(bytes, mode, contentLength);
    return;
  }

  let loaded = 0, first = new Uint8Array(0), carry = new Uint8Array(0);
  let format = null, facetCount = 0, positions = null, pickedCount = 0;
  let nextTarget = 0, processed = 0, firstFacetBlock = true;
  let lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  const asciiChunks = [];

  const processBinary = bytes => {
    const data = joinBytes(carry, bytes);
    const start = firstFacetBlock ? 84 : 0;
    firstFacetBlock = false;
    const count = Math.floor(Math.max(0, data.length - start) / 50);
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    for (let face = 0; face < count; face++) {
      const index = processed + face;
      const offset = start + face * 50 + 12;
      const keep = index === nextTarget && pickedCount < positions.length / 9;
      const writeAt = pickedCount * 9;
      for (let v = 0; v < 9; v += 3) {
        const x=view.getFloat32(offset+v*4,true), y=view.getFloat32(offset+(v+1)*4,true), z=view.getFloat32(offset+(v+2)*4,true);
        lo[0]=Math.min(lo[0],x);lo[1]=Math.min(lo[1],y);lo[2]=Math.min(lo[2],z);
        hi[0]=Math.max(hi[0],x);hi[1]=Math.max(hi[1],y);hi[2]=Math.max(hi[2],z);
        if(keep){positions[writeAt+v]=x;positions[writeAt+v+1]=y;positions[writeAt+v+2]=z;}
      }
      if(keep){pickedCount++;nextTarget=pickedCount<positions.length/9?Math.floor((pickedCount+0.5)*facetCount/(positions.length/9)):facetCount;}
    }
    processed += count;
    const tailAt = start + count * 50;
    carry = data.slice(tailAt);
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done || cancelled) break;
    loaded += value.length;
    if (format === null) {
      first = joinBytes(first, value);
      if (first.length < 84) {
        self.postMessage({ type: 'progress', loaded, total: contentLength, stage: 'Reading STL header…' });
        continue;
      }
      const view = new DataView(first.buffer, first.byteOffset, first.byteLength);
      const possibleFacets = view.getUint32(80, true);
      const binaryLength = 84 + possibleFacets * 50;
      const saysAscii = new TextDecoder().decode(first.subarray(0, 5)).toLowerCase() === 'solid';
      const binary = possibleFacets > 0 && (binaryLength === contentLength || (!contentLength && !saysAscii));
      format = binary ? 'binary' : 'ascii';
      if (format === 'ascii') {
        asciiChunks.push(first);
      } else {
        facetCount = possibleFacets;
        const previewCount = targetFaceCount(facetCount, mode);
        positions = allocPositions(previewCount);
        nextTarget = Math.floor(0.5 * facetCount / previewCount);
        processBinary(first);
      }
      first = new Uint8Array(0);
    } else if (format === 'binary') {
      processBinary(value);
    } else {
      asciiChunks.push(value);
    }
    self.postMessage({ type: 'progress', loaded, total: contentLength, stage: format === 'binary' ? 'Preparing mesh…' : 'Reading ASCII STL…' });
  }
  if (cancelled) return;
  if (format === null) throw new Error('The STL file is too short or unreadable.');
  if (format === 'ascii') {
    parseAscii(joinAll(asciiChunks), mode, loaded);
    return;
  }
  if (processed !== facetCount || carry.length) throw new Error('The binary STL ended before all triangles could be read.');
  if (pickedCount !== positions.length / 9) throw new Error('Could not prepare the requested mesh preview.');
  finish(positions, facetCount, lo, hi, loaded);
}

function joinAll(chunks) {
  const size = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { out.set(chunk, offset); offset += chunk.length; }
  return out;
}

function parseAscii(bytes, mode, loaded) {
  const text = new TextDecoder().decode(bytes);
  const pattern = /vertex\s+([-+\deE.]+)\s+([-+\deE.]+)\s+([-+\deE.]+)/gi;
  let match, vertexCount = 0;
  while ((match = pattern.exec(text))) vertexCount++;
  const total = Math.floor(vertexCount / 3);
  if (!total) throw new Error('No STL triangles were found.');
  const count = targetFaceCount(total, mode), positions = allocPositions(count);
  let lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity], face = 0, vertex = 0, slot = 0;
  let nextTarget = Math.floor(0.5 * total / count);
  pattern.lastIndex = 0;
  while ((match = pattern.exec(text))) {
    const x = Number(match[1]), y = Number(match[2]), z = Number(match[3]);
    lo[0]=Math.min(lo[0],x);lo[1]=Math.min(lo[1],y);lo[2]=Math.min(lo[2],z);hi[0]=Math.max(hi[0],x);hi[1]=Math.max(hi[1],y);hi[2]=Math.max(hi[2],z);
    if (face === nextTarget) {const at=slot*9+vertex*3;positions[at]=x;positions[at+1]=y;positions[at+2]=z;}
    vertex++;
    if (vertex===3) {
      if (face===nextTarget) { slot++; nextTarget=slot<count?Math.floor((slot+0.5)*total/count):total; }
      face++; vertex=0;
    }
  }
  finish(positions,total,lo,hi,loaded);
}

function parseWholeFile(bytes, mode, size) {
  if (bytes.length < 84) throw new Error('The STL file is too short or unreadable.');
  const count = new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).getUint32(80,true);
  if (84 + count * 50 !== bytes.length) { parseAscii(bytes,mode,size); return; }
  const faces=targetFaceCount(count,mode), positions=allocPositions(faces), view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
  let slot=0,nextTarget=Math.floor(0.5*count/faces);
  for(let i=0;i<count;i++){
    const offset=84+i*50+12,keep=i===nextTarget,writeAt=slot*9;
    for(let v=0;v<9;v+=3){const x=view.getFloat32(offset+v*4,true),y=view.getFloat32(offset+(v+1)*4,true),z=view.getFloat32(offset+(v+2)*4,true);lo[0]=Math.min(lo[0],x);lo[1]=Math.min(lo[1],y);lo[2]=Math.min(lo[2],z);hi[0]=Math.max(hi[0],x);hi[1]=Math.max(hi[1],y);hi[2]=Math.max(hi[2],z);if(keep){positions[writeAt+v]=x;positions[writeAt+v+1]=y;positions[writeAt+v+2]=z;}}
    if(keep){slot++;nextTarget=slot<faces?Math.floor((slot+0.5)*count/faces):count;}
    if(i%50000===0)self.postMessage({type:'progress',loaded:Math.min(bytes.length,84+i*50),total:bytes.length,stage:'Preparing mesh…'});
  }
  finish(positions,count,lo,hi,size||bytes.length);
}

function finish(positions,total,lo,hi,loaded) {
  const center=lo.map((v,i)=>(v+hi[i])*0.5);
  for(let i=0;i<positions.length;i+=3){positions[i]-=center[0];positions[i+1]-=center[1];positions[i+2]-=center[2];}
  self.postMessage({type:'done',center,bounds:[lo,hi],positions:positions.buffer,triangles:positions.length/9,totalTriangles:total,loaded},[positions.buffer]);
}
