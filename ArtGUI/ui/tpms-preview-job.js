export function createTpmsPreviewJob({onResult,onError,workerFactory=()=>new Worker(new URL('./tpms-cell-worker.js',import.meta.url),{type:'module'})}){
 let worker=null,revision=0,disposed=false;
 function cancel(){revision++;worker?.terminate();worker=null;}
 return{
  run(definition,resolution){cancel();if(disposed)return;const id=revision;
   try{worker=workerFactory();worker.onmessage=event=>{if(disposed||event.data.id!==revision)return;const current=worker;worker=null;current?.terminate();if(event.data.error)onError(event.data.error);else onResult(event.data.grid);};worker.onerror=event=>{if(disposed||id!==revision)return;worker?.terminate();worker=null;onError(event.message||'The preview worker could not run.');};worker.postMessage({id,definition,resolution});}
   catch(error){if(!disposed&&id===revision)onError(error.message||String(error));}
  },cancel,dispose(){cancel();disposed=true;}
 };
}
