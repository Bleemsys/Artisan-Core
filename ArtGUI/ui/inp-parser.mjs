// Abaqus mesh reader for flat, explicit-node Artisan/meshio exports.
const MAX_ITEMS=500000, MAX_FACES=2000000;
const shapes={
  line:{count:2,edges:[[0,1]]},tri:{count:3,faces:[[0,1,2]]},quad:{count:4,faces:[[0,1,2,3]]},
  tet:{count:4,solid:true,faces:[[0,2,1],[0,1,3],[1,2,3],[2,0,3]]},
  wedge:{count:6,solid:true,faces:[[0,2,1],[3,4,5],[0,1,4,3],[1,2,5,4],[2,0,3,5]]},
  hex:{count:8,solid:true,faces:[[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]]}
};
function shapeFor(type){
  if(/^(B[23]1(?:H|OS|OSH)?|T[23]D2[HT]?|R[23]D2|CONN[23]D2)$/.test(type))return shapes.line;
  if(/^(S3R?|STRI3|R3D3|M3D3|C(?:PS|PE|AX)3[HT]?)$/.test(type))return shapes.tri;
  if(/^(S4(?:R|R5|T|RT)?|R3D4|M3D4R?|C(?:PS|PE|AX)4(?:R|H|RH|P|RP|T|RT)?)$/.test(type))return shapes.quad;
  if(/^C3D4[HT]?$/.test(type))return shapes.tet;
  if(/^C3D6[HT]?$/.test(type))return shapes.wedge;
  if(/^C3D8(?:R|H|RH|I|IH|T|RT)?$/.test(type))return shapes.hex;
  throw Error(`Unsupported INP element type: ${type}. Export a linear beam, triangle, quad, tetrahedron, wedge or hexahedron mesh.`);
}
const idValue=(s)=>{const n=Number(s);if(!/^\d+$/.test(s)||!Number.isSafeInteger(n)||n<1)throw Error(`Invalid mesh ID: ${s}`);return n;};
export function parseInp(text,progress=()=>{}){
  const nodes=new Map(),elements=[],elementIds=new Set(),types={},sets=new Set();
  let mode='',type='',shape=null,pending=[],lineNumber=0,elset='',recordCount=0;
  for(const raw of text.split(/\r?\n/)){
    lineNumber++;const line=raw.trim();if(!line||line.startsWith('**'))continue;
    try{
      if(line.startsWith('*')){
        if(pending.length)throw Error('Incomplete element connectivity.');
        const parts=line.slice(1).split(',').map(s=>s.trim()),keyword=parts[0].toUpperCase(),opts={};
        for(const item of parts.slice(1)){const at=item.indexOf('=');if(at>=0)opts[item.slice(0,at).trim().toUpperCase()]=item.slice(at+1).trim();}
        if(['PART','ASSEMBLY','INSTANCE','INCLUDE','SYSTEM','NGEN','NFILL','NCOPY','ELGEN','ELCOPY','PARAMETER','IMPORT'].includes(keyword))throw Error(`*${keyword} is not supported. Export a flat mesh with explicit global nodes and elements.`);
        mode=keyword;
        if(keyword==='NODE'&&(opts.INPUT||(opts.SYSTEM&&opts.SYSTEM.toUpperCase()!=='R')))throw Error('External or non-Cartesian node definitions are not supported.');
        if(keyword==='ELEMENT'){if(opts.INPUT)throw Error('External element definitions are not supported.');type=(opts.TYPE||'').toUpperCase();shape=shapeFor(type);elset=opts.ELSET||'';if(elset)sets.add(elset);}
        if(keyword==='ELSET'&&opts.ELSET)sets.add(opts.ELSET);
        continue;
      }
      const values=line.split(',').map(s=>s.trim());while(values.at(-1)==='')values.pop();
      if(mode==='NODE'){
        if(values.length<3||values.length>4||values.some(s=>!s))throw Error('Expected node ID, X, Y, and optional Z.');
        const id=idValue(values[0]),p=values.slice(1).map(v=>Number(v.replace(/[dD]/,'e')));if(p.length===2)p.push(0);
        if(!p.every(Number.isFinite)||nodes.has(id))throw Error('Invalid coordinates or duplicate node ID.');
        nodes.set(id,p);if(nodes.size>MAX_ITEMS)throw Error('INP preview is limited to 500,000 nodes.');
      }else if(mode==='ELEMENT'){
        pending.push(...values.map(idValue));
        if(pending.length>shape.count+1)throw Error(`Expected ${shape.count} nodes for ${type}.`);
        if(pending.length===shape.count+1){const [id,...ids]=pending;if(elementIds.has(id))throw Error('Duplicate element ID.');elementIds.add(id);elements.push({id,type,nodes:ids,set:elset});types[type]=(types[type]||0)+1;pending=[];if(elements.length>MAX_ITEMS)throw Error('INP preview is limited to 500,000 elements.');}
      }
      if(++recordCount%20000===0)progress('Reading INP nodes and elements…');
    }catch(e){throw Error(`INP line ${lineNumber}: ${e.message}`);}
  }
  if(pending.length)throw Error('Incomplete final element.');
  if(!nodes.size||!elements.length)throw Error('No explicit nodes and supported elements found in this INP file.');
  const solidFaces=new Map(),shellFaces=[],beamIds=[],used=new Set();let faceCount=0;
  for(const element of elements){
    const s=shapeFor(element.type),ids=element.nodes;
    for(const id of ids){if(!nodes.has(id))throw Error(`Element ${element.id} references missing node ${id}.`);used.add(id);}
    if(s.edges){for(const edge of s.edges)beamIds.push(edge.map(i=>ids[i]));continue;}
    for(const face of s.faces){
      if(++faceCount>MAX_FACES)throw Error('INP preview exceeds the 2-million-face processing limit.');
      const f=face.map(i=>ids[i]);
      if(s.solid){const key=[...f].sort((a,b)=>a-b).join(',');const existing=solidFaces.get(key);if(existing)existing.count++;else solidFaces.set(key,{ids:f,count:1});}
      else shellFaces.push(f);
    }
  }
  progress('Preparing INP outer surfaces and element edges…');
  const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
  for(const id of used){const p=nodes.get(id);for(let a=0;a<3;a++){lo[a]=Math.min(lo[a],p[a]);hi[a]=Math.max(hi[a],p[a]);}}
  const center=lo.map((v,i)=>v/2+hi[i]/2),faces=[...shellFaces,...[...solidFaces.values()].filter(f=>f.count===1).map(f=>f.ids)],edges=new Map();
  let triCount=0;for(const f of faces)triCount+=f.length-2;
  const positions=new Float32Array(triCount*9);let at=0;
  function write(out,index,id){const p=nodes.get(id);for(let a=0;a<3;a++){const v=p[a]-center[a];if(!Number.isFinite(Math.fround(v)))throw Error('Mesh coordinates exceed display range.');out[index++]=v;}return index;}
  for(const f of faces){for(let i=1;i<f.length-1;i++)for(const id of [f[0],f[i],f[i+1]])at=write(positions,at,id);for(let i=0;i<f.length;i++){const pair=[f[i],f[(i+1)%f.length]],key=[...pair].sort((a,b)=>a-b).join(',');edges.set(key,pair);}}
  function lineBuffer(pairs){const out=new Float32Array(pairs.length*6);let offset=0;for(const pair of pairs)for(const id of pair)offset=write(out,offset,id);return out;}
  const nodeIds=Float64Array.from(nodes.keys()),coordinates=new Float64Array(nodes.size*3);at=0;for(const p of nodes.values())for(const v of p)coordinates[at++]=v;
  return {positions,lines:lineBuffer(beamIds),edges:lineBuffer([...edges.values()]),center,bounds:[lo,hi],
    metadata:{nodeCount:nodes.size,elementCount:elements.length,types,elementSets:[...sets],beamCount:beamIds.length,surfaceTriangles:triCount},
    topology:{nodeIds,coordinates,elements}};
}
