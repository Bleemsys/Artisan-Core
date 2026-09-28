import {parseInp} from './inp-parser.mjs';
self.onmessage=async({data})=>{
  try{
    const response=await fetch(data.url);if(!response.ok)throw Error(`Could not read INP (${response.status}).`);
    const chunks=[];let loaded=0;const reader=response.body.getReader();
    while(true){const {value,done}=await reader.read();if(done)break;loaded+=value.length;if(loaded>128*1024*1024)throw Error('INP viewing is limited to 128 MB per file.');chunks.push(value);self.postMessage({type:'progress',loaded,total:data.fileSize,stage:'Reading INP…'});}
    const bytes=new Uint8Array(loaded);let at=0;for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.length;}
    const result=parseInp(new TextDecoder().decode(bytes),stage=>self.postMessage({type:'progress',loaded:0,total:0,stage}));
    const transfer=[result.positions.buffer,result.lines.buffer,result.edges.buffer,result.topology.nodeIds.buffer,result.topology.coordinates.buffer];
    self.postMessage({type:'done',...result},transfer);
  }catch(e){self.postMessage({type:'error',message:e.message||String(e)});}
};
