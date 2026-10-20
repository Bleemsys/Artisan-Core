import {createFullDetailMemoryGuard} from './full-detail-memory.mjs';

export function loadIndexedGeometry({worker,viewer,layerId,path,url,fileSize,invoke,pause,signal,current=()=>true,onProgress=()=>{},yieldFrame=()=>new Promise(resolve=>setTimeout(resolve,0))}){
  return new Promise((resolve,reject)=>{
    let stage,settled=false;
    const active=()=>{if(signal?.aborted||!current())throw new DOMException('Loading cancelled','AbortError');};
    const guard=createFullDetailMemoryGuard({invoke,pause,signal,current});
    const finish=(error,result)=>{
      if(settled)return;settled=true;worker.terminate();worker.onmessage=null;worker.onerror=null;signal?.removeEventListener('abort',abort);
      if(error){stage?.dispose();reject(error);}else resolve(result);
    };
    const abort=()=>finish(new DOMException('Loading cancelled','AbortError'));
    signal?.addEventListener('abort',abort,{once:true});
    try{active();stage=viewer.beginFullDetail(layerId,path);}catch(error){finish(error);return;}
    worker.onmessage=async({data})=>{
      if(settled)return;
      try{
        active();
        if(data.type==='progress')onProgress(data);
        else if(data.type==='chunk'){
          await guard.check({currentBytes:stage.bytes,nextBytes:stage.estimate(data)});active();
          await yieldFrame();active();stage.append(data);active();
          // Backpressure: the worker cannot read the next batch before this upload succeeds.
          worker.postMessage({type:'chunk-accepted'});
        }else if(data.type==='done'){
          await guard.check({currentBytes:stage.bytes,force:true});active();
          await stage.commit(data,{beforeAllocate:async bytes=>{await guard.check({currentBytes:stage.bytes,nextBytes:bytes});active();},current:()=>!signal?.aborted&&current(),yieldFrame});
          finish(null,{...data,staged:true});
        }else if(data.type==='error')throw Error(data.message);
      }catch(error){finish(error);}
    };
    worker.onerror=event=>finish(Error(event.message||'Full-detail loading failed.'));
    // Check RAM before opening the file, including the bounded worker scratch space.
    guard.check({nextBytes:16*1024**2,force:true}).then(()=>{
      if(!settled){active();worker.postMessage({url,fileSize,mode:'full'});}
    }).catch(error=>finish(error));
  });
}
