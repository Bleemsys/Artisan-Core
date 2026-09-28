export function createRunProgress({invoke,listen,onBusy,toast,labelFor=name=>name}){
  const $=id=>document.getElementById(id);
  let active=false,stopping=false,id='',started=0,timer=null,unlisten=null,lines=[],steps=[],cursor=-1,percent=null,stage='Ready to build',subdomain='',total='';
  const elapsed=()=>{const sec=Math.floor((Date.now()-started)/1000);return `${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`;};
  function toggleLog(open){$('run-log').hidden=!open;$('toggle-run-log').textContent=open?'Hide log':'Show log';$('toggle-run-log').setAttribute('aria-expanded',String(open));}
  function renderLog(){const pre=$('run-log-text'),scroll=$('run-log-scroll'),top=scroll.scrollTop;pre.textContent=lines.join('\n');if($('run-autoscroll').checked)scroll.scrollTop=scroll.scrollHeight;else scroll.scrollTop=top;}
  function append(newLines){lines.push(...newLines);if(lines.length>2000)lines=lines.slice(-2000);renderLog();}
  function paintStep(){document.querySelectorAll('[data-step]').forEach(card=>{const current=active&&steps[cursor]?.key===card.dataset.step;card.classList.toggle('step-running',current);if(current)card.setAttribute('aria-current','step');else card.removeAttribute('aria-current');});}
  function render(){
    $('status-text').textContent=labelFor(stage);$('status-text').title=[stage,subdomain&&`Subdomain ${subdomain}${total?' of '+total:''}`].filter(Boolean).join(' · ');
    $('run-detail').textContent=subdomain?`Subdomain ${subdomain}${total?' of '+total:''}`:labelFor(stage);
    $('run-percent').textContent=percent===null?'—':`${Math.round(percent)}%`;
    if(percent===null)$('run-progress-bar').removeAttribute('value');else $('run-progress-bar').value=percent;
    $('run-progress-bar').setAttribute('aria-label',`Generation progress${percent===null?'':': '+Math.round(percent)+'%'}`);
    if(active)$('run-elapsed').textContent=elapsed();paintStep();
  }
  function update(event){const u=event.payload??event;if(u.runId!==id)return;
    $('open-run-log').disabled=false;
    if(u.lines?.length){append(u.lines);if(active&&!stopping)for(const line of u.lines){
      const message=line.replace(/^.*?\[(?:INFO|WARNING|ERROR|DEBUG|CRITICAL)\]\s*/, '');
      let match=message.match(/^Number of Domain Partition:\s*(\d+)/);if(match)total=match[1];
      match=message.match(/^Calculating Sub-Domain:\s*(\d+)/);if(match){subdomain=match[1];cursor=-1;stage='Building domain';}
      match=message.match(/^Calculating\s+([A-Za-z][A-Za-z0-9_]*)\s*$/);if(match){stage=match[1];let next=steps.findIndex((s,i)=>i>cursor&&s.op===stage);if(next<0)next=steps.findIndex(s=>s.op===stage);cursor=next;}
      if(/^Setup basic fill domain/.test(message))stage='Preparing domain';
      if(/^PostProcessing Meshes/.test(message)){stage='Post-processing';cursor=-1;}
    }}
    // Completion is controlled by process exit, never by a progress-file value alone.
    if(active&&Number.isFinite(u.progress))percent=Math.max(percent??0,Math.min(99,u.progress));
    render();
  }
  $('toggle-run-log').onclick=()=>toggleLog($('run-log').hidden);
  $('run-autoscroll').onchange=()=>renderLog();
  $('copy-run-log').onclick=async()=>{try{await navigator.clipboard.writeText(lines.join('\n'));toast('Visible log copied.');}catch{toast('Could not copy the log. Select its text or use Open log.');}};
  $('open-run-log').onclick=async()=>{try{await invoke('open_run_log',{runId:id});}catch(e){toast(String(e));}};
  $('stop-generation').onclick=async()=>{if(!active)return;stopping=true;$('stop-generation').disabled=true;stage='Stopping…';render();try{await invoke('cancel_generation',{runId:id});}catch(e){if(active){stopping=false;$('stop-generation').disabled=false;toast(String(e));}}};
  function reset(){if(active)return;id='';lines=[];percent=null;stage='Ready to build';subdomain='';total='';$('run-live').hidden=true;$('toggle-run-log').hidden=true;$('generate').textContent='Generate model →';$('run-dot').className='status-dot';toggleLog(false);render();}
  return {
    get busy(){return active;},reset,paintStep,
    async run(args,workflow){
      if(active)return;active=true;stopping=false;id=crypto.randomUUID();started=Date.now();lines=[];percent=null;stage='Starting Artisan…';subdomain='';total='';cursor=-1;
      steps=Object.entries(workflow).sort(([a],[b])=>Number(a)-Number(b)).flatMap(([key,ops])=>Object.keys(ops).map(op=>({key,op})));
      $('run-live').hidden=false;$('toggle-run-log').hidden=false;$('stop-generation').hidden=false;$('stop-generation').disabled=false;$('generate').hidden=true;$('run-dot').className='status-dot running';$('run-elapsed').textContent='00:00';$('open-run-log').disabled=true;$('run-log-path').textContent='';toggleLog(false);renderLog();onBusy(true);render();timer=setInterval(render,1000);
      try{
        if(!listen)throw Error('Live progress requires the desktop app.');
        unlisten=await listen('artisan-run',update);
        const result=await invoke('generate_workflow',{...args,runId:id});
        $('run-elapsed').textContent=elapsed();active=false;stage=result.cancelled?'Stopped':result.success?'Completed':`Failed${result.exitCode!==null?' (exit '+result.exitCode+')':''}`;
        if(result.success)percent=100;
        $('run-dot').className='status-dot '+(result.success?'online':result.cancelled?'':'failed');
        append([result.cancelled?'Run stopped. Partial output files may remain.':result.success?'Generation completed.':`Artisan exited with code ${result.exitCode??'unknown'}. See the messages above.`]);
        $('run-log-path').textContent=result.logPath||'';$('open-run-log').disabled=!result.logPath;
        if(!result.success&&!result.cancelled)toggleLog(true);
      }catch(e){$('run-elapsed').textContent=elapsed();active=false;stage='Generation failed';$('run-dot').className='status-dot failed';append([String(e)]);toggleLog(true);}
      finally{active=false;clearInterval(timer);timer=null;unlisten?.();unlisten=null;onBusy(false);$('stop-generation').hidden=true;$('generate').hidden=false;$('generate').disabled=false;$('generate').textContent='Generate again';render();}
    }
  };
}
