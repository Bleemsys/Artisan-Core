import {readStlStream} from './stl-stream.mjs';
import {stlByteRanges} from './stl-source.mjs';
let acknowledge=null;
self.onmessage=async({data})=>{
  if(data.type==='chunk-accepted'){acknowledge?.();acknowledge=null;return;}
  try{
    const result=await readStlStream(stlByteRanges(data.url,data.fileSize),{
      fileSize:data.fileSize,
      onProgress:p=>self.postMessage({type:'progress',...p}),
      onChunk:chunk=>new Promise(resolve=>{
        acknowledge=resolve;self.postMessage({type:'chunk',...chunk},[chunk.positions.buffer,chunk.indices.buffer]);
      })
    });
    self.postMessage({type:'done',...result});
  }catch(error){self.postMessage({type:'error',message:error?.message||String(error)});}
};
