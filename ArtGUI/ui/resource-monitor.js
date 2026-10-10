const GIB=1024**3, MIB=1024**2;
export function formatMemory(value){
  if(!Number.isFinite(value)||value<0)return '—';
  return value>=GIB?`${(value/GIB).toFixed(1)} GiB`:`${(value/MIB).toFixed(value>=100*MIB?0:1)} MiB`;
}
export function formatPercent(value){return Number.isFinite(value)?`${Math.round(Math.max(0,Math.min(100,value)))}%`:'—';}
export function historySeries(snapshot,source,metric){
  if(!snapshot)return [];
  return (snapshot.history||[]).filter(point=>Number.isFinite(point.sampledAt)&&point.sampledAt>=snapshot.sampledAt-60000&&point.sampledAt<=snapshot.sampledAt)
    .sort((a,b)=>a.sampledAt-b.sampledAt).map(point=>{
      let value=source==='system'?(metric==='memory'?point.systemMemoryBytes:point.systemCpuPercent):point[source]?.[metric==='memory'?'memoryBytes':'cpuPercent'];
      if(source==='artisan'&&(!snapshot.runId||point.runId!==snapshot.runId))value=null;
      if(!Number.isFinite(value)||value<0)value=null;
      return {time:point.sampledAt,value:value===null?null:metric==='memory'?value/GIB:Math.min(100,value)};
    });
}
export function chartModel(points,width,metric,endTime){
  const left=40,right=Math.max(left+1,width-6),top=5,bottom=68;
  const values=points.map(p=>p.value).filter(Number.isFinite);
  const high=values.length?Math.max(...values):0;
  let max=100;
  if(metric==='memory'){
    const target=high>0?high*1.12:1,power=10**Math.floor(Math.log10(target));
    max=([1,2,5,10].find(n=>n*power>=target)||10)*power;
  }
  const end=Number.isFinite(endTime)?endTime:(points.at(-1)?.time||0),start=end-60000;
  const segments=[];let current=[],previousTime=null;
  for(const point of points){
    if(point.value===null||!Number.isFinite(point.value)||previousTime!==null&&point.time-previousTime>2500){if(current.length)segments.push(current);current=[];}
    if(Number.isFinite(point.value))current.push({x:left+(point.time-start)/60000*(right-left),y:bottom-point.value/max*(bottom-top),value:point.value,time:point.time});
    previousTime=point.time;
  }
  if(current.length)segments.push(current);
  return {left,right,top,bottom,max,segments,hasData:values.length>0};
}

export function createResourceMonitor({invoke}){
  const $=id=>document.getElementById(id),tabs=['workflow','resources'];
  let snapshot=null,timer=null,pending=false,disposed=false,tab='workflow',source='artisan',metric='memory';
  try{const saved=JSON.parse(localStorage.getItem('artisan.resources')||'null');if(['artisan','artgui','system'].includes(saved?.source))source=saved.source;if(['memory','cpu'].includes(saved?.metric))metric=saved.metric;}catch{}
  const store=()=>{try{localStorage.setItem('artisan.resources',JSON.stringify({source,metric}));}catch{}};
  function selectTab(next,focus=false){
    tab=next;
    for(const key of tabs){const button=$(key+'-tab'),panel=$(key+'-content'),selected=key===tab;button.setAttribute('aria-selected',String(selected));button.tabIndex=selected?0:-1;panel.hidden=!selected;panel.inert=!selected;}
    if(focus)$(tab+'-tab').focus();
    if(tab==='resources')draw();
  }
  for(const key of tabs){
    $(key+'-tab').onclick=()=>selectTab(key);
    $(key+'-tab').onkeydown=event=>{
      let next=null;if(event.key==='ArrowLeft'||event.key==='ArrowRight')next=key==='workflow'?'resources':'workflow';if(event.key==='Home')next='workflow';if(event.key==='End')next='resources';
      if(next){event.preventDefault();selectTab(next,true);}
    };
  }
  function labelAxis(value){if(value===0)return '0';return value>=10?value.toFixed(0):value>=1?value.toFixed(1):value>=.1?value.toFixed(2):value.toFixed(3);}
  function draw(){
    if(tab!=='resources')return;
    const svg=$('resource-chart'),width=svg.clientWidth;if(width<50)return;
    const points=historySeries(snapshot,source,metric),model=chartModel(points,width,metric,snapshot?.sampledAt);
    svg.setAttribute('viewBox',`0 0 ${width} 94`);
    const name={artisan:'Artisan',artgui:'ArtGUI',system:'System'}[source];
    svg.setAttribute('aria-label',`${name} ${metric==='memory'?'memory in GiB':'CPU as percent of total machine capacity'} over the last 60 seconds`);
    let markup='';
    for(const value of [0,model.max/2,model.max]){const y=model.bottom-value/model.max*(model.bottom-model.top);markup+=`<path class="resource-grid" d="M ${model.left} ${y} H ${model.right}"></path><text x="${model.left-6}" y="${y+3}" text-anchor="end">${labelAxis(value)}</text>`;}
    for(const segment of model.segments){
      markup+=`<polyline class="resource-line" points="${segment.map(p=>`${p.x},${p.y}`).join(' ')}"></polyline>`;
      const last=segment.at(-1);markup+=`<circle cx="${last.x}" cy="${last.y}" r="2" fill="#2867d8"><title>${last.value.toFixed(metric==='memory'?3:1)} ${metric==='memory'?'GiB':'%'} · ${new Date(last.time).toLocaleTimeString()}</title></circle>`;
    }
    if(!model.hasData)markup+=`<text x="${(model.left+model.right)/2}" y="37" text-anchor="middle">${!snapshot?'No readings available':source==='artisan'?'No Artisan samples yet':'Waiting for samples'}</text>`;
    markup+=`<text x="${model.left}" y="89">60 s ago</text><text x="${model.right}" y="89" text-anchor="end">Now</text>`;
    svg.innerHTML=markup;
  }
  function setText(id,value){$(id).textContent=value;}
  function renderGroup(name,usage){
    setText(`resource-${name}-ram`,formatMemory(usage?.memoryBytes));setText(`resource-${name}-cpu`,formatPercent(usage?.cpuPercent));
    const count=usage?.processCount||0;
    setText(`resource-${name}-count`,count?`${count} process${count===1?'':'es'}`:name==='artisan'?(snapshot?.runActive?'Starting…':'Idle'):'Unavailable');
  }
  function unavailable(message){
    snapshot=null;setText('resource-message',message);$('resource-message').classList.add('resource-unavailable');
    setText('resource-ram','—');setText('resource-ram-percent','—');setText('resource-available','Readings unavailable');setText('resource-cpu','—');setText('resource-peak','—');setText('resource-run-state','');
    renderGroup('artisan',null);renderGroup('artgui',null);
    $('resource-ram-meter').removeAttribute('aria-valuenow');$('resource-ram-meter').querySelector('span').style.width='0%';
    setText('run-resource-brief','RAM — · CPU —');$('run-resource-brief').title=message;
    draw();
  }
  function render(value){
    if(!value)return unavailable('Collecting resource readings…');
    if(!Number.isFinite(value.sampledAt)||Date.now()-value.sampledAt>5000)return unavailable('Resource readings are stale. Retrying…');
    snapshot=value;setText('resource-message','Live · updates every second');$('resource-message').classList.remove('resource-unavailable');
    const ramPercent=value.totalBytes>0?Math.max(0,Math.min(100,value.usedBytes/value.totalBytes*100)):null;
    setText('resource-ram',`${(value.usedBytes/GIB).toFixed(1)} / ${(value.totalBytes/GIB).toFixed(1)} GiB`);setText('resource-ram-percent',formatPercent(ramPercent));
    setText('resource-available',`${formatMemory(value.availableBytes)} available`);setText('resource-cpu',formatPercent(value.cpuPercent));
    $('resource-ram-meter').setAttribute('aria-valuenow',String(ramPercent??0));$('resource-ram-meter').querySelector('span').style.width=`${ramPercent??0}%`;
    renderGroup('artisan',value.artisan);renderGroup('artgui',value.artgui);
    setText('resource-run-state',value.runActive?'Artisan running':value.artisan?.processCount?'Workers still running':'Artisan idle');
    setText('resource-peak',formatMemory(value.peakBytes));
    setText('run-resource-brief',`RAM ${formatPercent(ramPercent)} · CPU ${formatPercent(value.cpuPercent)}`);
    $('run-resource-brief').title=`System RAM: ${formatMemory(value.usedBytes)} / ${formatMemory(value.totalBytes)}; ${formatMemory(value.availableBytes)} available. System CPU: ${formatPercent(value.cpuPercent)}.`;
    draw();
  }
  function setMetric(next){metric=next;$('resource-history-heading').textContent=metric==='memory'?'Memory history':'CPU history';$('resource-chart-unit').textContent=metric==='memory'?'GiB · last 60 s':'% of machine · last 60 s';document.querySelectorAll('[data-resource-metric]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.resourceMetric===metric)));draw();}
  $('resource-source').value=source;$('resource-source').onchange=event=>{source=event.target.value;store();draw();};
  document.querySelectorAll('[data-resource-metric]').forEach(button=>button.onclick=()=>{setMetric(button.dataset.resourceMetric);store();});
  selectTab('workflow');setMetric(metric);
  const observer=new ResizeObserver(draw);observer.observe($('resource-chart'));
  async function poll(){
    if(disposed||pending)return;clearTimeout(timer);pending=true;
    try{const value=await invoke('resource_snapshot');if(!disposed)render(value);}catch{if(!disposed)unavailable('Resource readings unavailable. Retrying…');}
    finally{pending=false;if(!disposed)timer=setTimeout(poll,document.hidden?5000:1000);}
  }
  function visibility(){clearTimeout(timer);poll();}
  function dispose(){disposed=true;clearTimeout(timer);observer.disconnect();document.removeEventListener('visibilitychange',visibility);}
  window.addEventListener('pagehide',dispose,{once:true});
  if(invoke){document.addEventListener('visibilitychange',visibility);poll();}else unavailable('Live resource monitoring requires the desktop app.');
  return {dispose,selectTab};
}
