// Range requests also bound Tauri's native asset-protocol response allocation.
export async function* stlByteRanges(url,fileSize,{fetchImpl=fetch,rangeBytes=1024*1024,signal}={}){
  if(!Number.isSafeInteger(fileSize)||fileSize<1)throw Error('A valid STL file size is required for bounded loading.');
  for(let start=0;start<fileSize;){
    const end=Math.min(fileSize-1,start+rangeBytes-1);
    const response=await fetchImpl(url,{headers:{Range:`bytes=${start}-${end}`},signal});
    if(!response.ok)throw Error(`Could not read STL (${response.status}).`);
    if(response.status===206){
      const match=/^bytes (\d+)-(\d+)\/(\d+)$/.exec(response.headers.get('content-range')||'');
      if(!match||Number(match[1])!==start||Number(match[2])>end||Number(match[2])<start||Number(match[3])!==fileSize){await response.body?.cancel();throw Error('STL range response does not match the requested file.');}
      const bytes=new Uint8Array(await response.arrayBuffer());
      if(bytes.length!==Number(match[2])-start+1)throw Error('Incomplete STL range response.');
      start+=bytes.length;yield bytes;
    }else{
      // Small data URLs and servers without Range support are still useful in tests.
      if(start!==0||fileSize>rangeBytes){await response.body?.cancel();throw Error('The file server must support byte ranges to load this large STL.');}
      const bytes=new Uint8Array(await response.arrayBuffer());
      if(bytes.length!==fileSize)throw Error('STL size changed while loading.');
      start=bytes.length;yield bytes;
    }
  }
}
