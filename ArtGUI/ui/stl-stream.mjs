// Exact sharing is local to a bounded batch; vertices are never tolerance-welded.
export const BATCH_TRIANGLES=65536;
export class IndexedBatch {
  constructor(limit=BATCH_TRIANGLES){
    this.limit=limit;this.vertices=0;this.faces=0;
    this.positions=new Float32Array(limit*9);this.indices=new Uint32Array(limit*3);
    let slots=1;while(slots<limit*6)slots*=2;
    this.table=new Uint32Array(slots);this.mask=slots-1;this.bits=new Uint32Array(this.positions.buffer);
    this.scratch=new Float32Array(3);this.words=new Uint32Array(this.scratch.buffer);
    this.lo=[Infinity,Infinity,Infinity];this.hi=[-Infinity,-Infinity,-Infinity];
  }
  vertex(x,y,z){
    this.scratch[0]=x===0?0:x;this.scratch[1]=y===0?0:y;this.scratch[2]=z===0?0:z;
    if(!this.scratch.every(Number.isFinite))throw Error('STL contains invalid coordinates.');
    const [a,b,c]=this.words;
    let hash=Math.imul(a,73856093)^Math.imul(b,19349663)^Math.imul(c,83492791);
    hash=Math.imul(hash^(hash>>>16),0x85ebca6b);hash=Math.imul(hash^(hash>>>13),0xc2b2ae35);
    let slot=(hash^(hash>>>16))&this.mask;
    while(this.table[slot]){
      const id=this.table[slot]-1,k=id*3;
      if(this.bits[k]===a&&this.bits[k+1]===b&&this.bits[k+2]===c)return id;
      slot=(slot+1)&this.mask;
    }
    const id=this.vertices++,at=id*3;this.positions.set(this.scratch,at);this.table[slot]=id+1;
    for(let j=0;j<3;j++){this.lo[j]=Math.min(this.lo[j],this.scratch[j]);this.hi[j]=Math.max(this.hi[j],this.scratch[j]);}
    return id;
  }
  triangle(values){
    if(this.faces>=this.limit)throw Error('STL batch capacity exceeded.');
    for(let i=0;i<3;i++)this.indices[this.faces*3+i]=this.vertex(values[i*3],values[i*3+1],values[i*3+2]);
    this.faces++;
  }
  finish(){
    const positions=this.positions.slice(0,this.vertices*3),center=this.lo.map((v,i)=>(v+this.hi[i])/2);
    for(let i=0;i<positions.length;i++)positions[i]-=center[i%3];
    const Index=this.vertices<=65536?Uint16Array:Uint32Array;
    return {positions,indices:new Index(this.indices.subarray(0,this.faces*3)),center,triangles:this.faces,bounds:[this.lo,this.hi]};
  }
}
export async function readStlStream(chunks,{fileSize=0,batchTriangles=BATCH_TRIANGLES,onChunk=()=>{},onProgress=()=>{},isCancelled=()=>false}={}){
  if(!Number.isInteger(batchTriangles)||batchTriangles<1||batchTriangles>BATCH_TRIANGLES)throw Error('Invalid STL batch size.');
  let header=new Uint8Array(0),carry=new Uint8Array(0),format=null,count=0,processed=0,loaded=0;
  let batch=null,part='',asciiVertices=[],asciiFaces=0;
  const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity],decoder=new TextDecoder(),values=new Float32Array(9);
  const flush=async()=>{
    if(!batch?.faces)return;
    const result=batch.finish();batch=null;
    for(let j=0;j<3;j++){lo[j]=Math.min(lo[j],result.bounds[0][j]);hi[j]=Math.max(hi[j],result.bounds[1][j]);}
    await onChunk(result);
  };
  const triangle=v=>{batch ||= new IndexedBatch(batchTriangles);batch.triangle(v);processed++;if(batch.faces===batchTriangles)return flush();};
  const ascii=async text=>{
    part+=text;const lines=part.split(/\r?\n/);part=lines.pop();
    if(part.length>65536)throw Error('ASCII STL line exceeds 64 KiB.');
    for(const line of lines){
      const s=line.trim();if(!/^vertex\b/i.test(s))continue;
      const fields=s.split(/\s+/);if(fields.length!==4)throw Error('Invalid ASCII STL vertex.');
      const coords=fields.slice(1).map(Number);if(!coords.every(Number.isFinite))throw Error('Invalid ASCII STL coordinates.');
      asciiVertices.push(...coords);
      if(asciiVertices.length===9){const pending=triangle(asciiVertices);if(pending)await pending;asciiVertices=[];asciiFaces++;}
    }
  };
  try{
    for await(const input of chunks){
      if(isCancelled())throw new DOMException('Loading cancelled','AbortError');
      let bytes=input;loaded+=bytes.byteLength;
      if(format===null){
        const needed=Math.min(84-header.length,bytes.length),joined=new Uint8Array(header.length+needed);
        joined.set(header);joined.set(bytes.subarray(0,needed),header.length);header=joined;bytes=bytes.subarray(needed);
        if(header.length<84)continue;
        count=new DataView(header.buffer).getUint32(80,true);
        const expected=84+count*50,saysAscii=new TextDecoder().decode(header.subarray(0,5)).toLowerCase()==='solid';
        format=(fileSize?expected===fileSize:!saysAscii)?'binary':'ascii';
        if(format==='ascii')await ascii(decoder.decode(header,{stream:true}));
      }
      if(format==='binary'){
        let data=bytes;
        if(carry.length){data=new Uint8Array(carry.length+bytes.length);data.set(carry);data.set(bytes,carry.length);}
        const complete=Math.floor(data.length/50),view=new DataView(data.buffer,data.byteOffset,data.byteLength);
        for(let face=0;face<complete;face++){
          if(processed>=count)throw Error('Binary STL has unexpected trailing records.');
          const at=face*50+12;for(let j=0;j<9;j++)values[j]=view.getFloat32(at+j*4,true);
          const pending=triangle(values);if(pending)await pending;
        }
        carry=data.slice(complete*50);
      }else await ascii(decoder.decode(bytes,{stream:true}));
      onProgress({loaded,total:fileSize,stage:'Reading and sharing STL vertices…'});
    }
    if(format===null)throw Error('The STL file is too short or unreadable.');
    if(format==='ascii'){await ascii(decoder.decode()+'\n');if(asciiVertices.length)throw Error('Incomplete ASCII STL triangle.');count=asciiFaces;}
    else if(processed!==count||carry.length)throw Error('Binary STL ended before all triangles could be read.');
    if(!processed)throw Error('No STL triangles found.');
    if(isCancelled())throw new DOMException('Loading cancelled','AbortError');
    await flush();return {center:lo.map((v,i)=>(v+hi[i])/2),bounds:[lo,hi],triangles:count,totalTriangles:count,loaded};
  }finally{batch=null;}
}
