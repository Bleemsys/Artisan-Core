const MIB=1024**2;
export function assessFullDetailMemory(snapshot,{now=Date.now(),pendingBytes=0}={}){
  if(!snapshot||!Number.isFinite(snapshot.sampledAt)||now-snapshot.sampledAt>5000||snapshot.sampledAt>now+1000||!Number.isFinite(snapshot.totalBytes)||snapshot.totalBytes<=0||!Number.isFinite(snapshot.availableBytes)||snapshot.availableBytes<0||snapshot.availableBytes>snapshot.totalBytes){
    return {warning:true,reason:'Current memory readings are unavailable. Loading cannot be monitored until readings recover.'};
  }
  // This reserve scales with RAM; pending buffers may also have driver copies.
  const reserve=Math.max(512*MIB,Math.min(2*1024*MIB,snapshot.totalBytes*.1));
  const required=reserve+64*MIB+Math.max(0,pendingBytes)*2;
  return {warning:snapshot.availableBytes<required,availableBytes:snapshot.availableBytes,reserveBytes:reserve,
    reason:`Available system memory is ${(snapshot.availableBytes/1024**3).toFixed(2)} GiB. Loading has reached the reserved memory headroom.`};
}

export function createFullDetailMemoryGuard({invoke,pause,signal,current=()=>true,now=Date.now}){
  let checkedAt=-Infinity,checkedBytes=0,sample=null,sampleBytes=0,overrideUntil=-Infinity,overrideBytes=0;
  function active(){if(signal?.aborted||!current())throw new DOMException('Loading cancelled','AbortError');}
  return {async check({currentBytes=0,nextBytes=0,force=false}={}){
    active();let time=now();
    if(force||time-checkedAt>=1000||currentBytes-checkedBytes>=16*MIB){
      try{const next=await invoke('resource_snapshot');active();if(next?.sampledAt!==sample?.sampledAt)sampleBytes=currentBytes;sample=next;}
      catch(error){active();sample=null;sampleBytes=currentBytes;}
      time=now();checkedAt=time;checkedBytes=currentBytes;
    }
    const assessment=assessFullDetailMemory(sample,{now:time,pendingBytes:Math.max(0,currentBytes-sampleBytes)+nextBytes});
    if(!assessment.warning){overrideUntil=-Infinity;return;}
    if(time<overrideUntil&&currentBytes+nextBytes<=overrideBytes)return;
    const proceed=await pause({...assessment,geometryBytes:currentBytes,nextBytes});active();
    if(!proceed)throw new DOMException('Full-detail loading cancelled','AbortError');
    // A choice permits only a bounded amount of further work, never disables checks.
    time=now();overrideUntil=time+5000;overrideBytes=currentBytes+nextBytes+64*MIB;
  }};
}
