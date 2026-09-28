import {operationIcon} from './operation-icons.js';

const common = ['Add_Lattice','Add_Shell','Boundary_Inflation','Proc_Mesh_Trim','Gen_BasicCartesianHexMesh','Export'];
const esc = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const storeKey = kind => `artisan.operation-picker.${kind}`;
function readSaved(kind, known){
  try {const value=JSON.parse(localStorage.getItem(storeKey(kind))||'[]');return Array.isArray(value)?[...new Set(value.filter(k=>known.has(k)))]:[];} catch {return [];}
}
function save(kind,value){try{localStorage.setItem(storeKey(kind),JSON.stringify(value));}catch{/* The picker also works when browser storage is unavailable. */}}

export function openOperationPicker({operations, steps, selected, showModal, closeModal, onAdd}){
  const opener=document.activeElement, known=new Map(operations.map(o=>[o.keyword,o]));
  let favorites=readSaved('favorites',known),recent=readSaved('recent',known),tab='common',query='',category='',active='',visible=[];
  const groups=[...new Set(operations.map(o=>o.category))];
  const icon=operationIcon;
  showModal(`<div class="modal-head"><div><h2 id="picker-title">Add step</h2><p>Choose an operation to add to your workflow.</p></div><button class="icon-button picker-close" data-close aria-label="Close Add step">${icon('x')}</button></div>
    <div class="picker-search"><span>${icon('search')}</span><input id="operation-search" type="search" aria-label="Search all operations" placeholder="Search operations…" autocomplete="off" spellcheck="false"></div>
    <div class="picker-tabs" role="group" aria-label="Operation lists">
      <button data-picker-tab="common" aria-pressed="true">Common</button><button data-picker-tab="recent" aria-pressed="false">${icon('rotate-ccw-clock')}Recent</button><button data-picker-tab="favorites" aria-pressed="false">${icon('star')}Favorites</button><button data-picker-tab="all" aria-pressed="false">All operations</button>
    </div>
    <div class="picker-filter" hidden><label for="operation-category">Category</label><select id="operation-category"><option value="">All categories</option>${groups.map(g=>`<option value="${esc(g)}">${esc(g)}</option>`).join('')}</select></div>
    <p id="picker-status" class="picker-status" role="status"></p>
    <div class="picker-list" id="operation-list" role="group" aria-label="Operations"></div>
    <div class="picker-footer"><div class="picker-insertion"><label for="operation-position">Insert</label><select id="operation-position"><option value="0">At start of workflow</option>${steps.map((s,i)=>`<option value="${i+1}">After Step ${i+1} — ${esc(s.label)}</option>`).join('')}<option value="end">At end of workflow</option></select></div>
    <div class="picker-actions"><p class="picker-keyboard"><span><kbd>${icon('arrow-up')}</kbd><kbd>${icon('arrow-down')}</kbd> to navigate</span><span><kbd>Enter</kbd> to add</span><span><kbd>Esc</kbd> to close</span></p><div><button class="button" data-close>Cancel</button><button class="button primary" id="confirm-operation">${icon('plus')}Add step</button></div></div></div>`);
  const modal=document.getElementById('modal'),search=modal.querySelector('#operation-search'),list=modal.querySelector('#operation-list'),confirm=modal.querySelector('#confirm-operation'),position=modal.querySelector('#operation-position');
  modal.classList.add('operation-picker');modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-labelledby','picker-title');
  const selectedIndex=steps.findIndex(s=>s.key===selected);position.value=selectedIndex>=0?String(selectedIndex+1):'end';
  function render(){
    const terms=query.toLowerCase().trim().split(/\s+/).filter(Boolean);
    visible=terms.length?operations.filter(o=>{const text=[o.label,o.keyword,o.category,o.description,...(o.searchTerms||[])].join(' ').toLowerCase();return terms.every(t=>text.includes(t));}):
      tab==='all'?operations.filter(o=>!category||o.category===category):(tab==='common'?common:tab==='recent'?recent:favorites).map(k=>known.get(k)).filter(Boolean);
    if(!visible.some(o=>o.keyword===active))active=visible[0]?.keyword||'';
    modal.querySelectorAll('[data-picker-tab]').forEach(b=>b.setAttribute('aria-pressed',String(!terms.length&&b.dataset.pickerTab===tab)));
    modal.querySelector('.picker-filter').hidden=Boolean(terms.length)||tab!=='all';
    const status=modal.querySelector('#picker-status');status.hidden=!terms.length&&tab==='common';
    status.textContent=terms.length?`Search results · ${visible.length} operation${visible.length===1?'':'s'}`:tab==='all'?`${visible.length} operations`:tab==='recent'?'Your most recently added operations':tab==='favorites'?'Your saved operations':'Frequently used operations';
    list.innerHTML=visible.length?visible.map(o=>`<div class="picker-row ${o.keyword===active?'selected':''}" data-row="${esc(o.keyword)}"><button type="button" class="picker-choice" data-op="${esc(o.keyword)}" aria-pressed="${o.keyword===active}" tabindex="${o.keyword===active?0:-1}"><span class="picker-operation-icon">${icon(o.icon)}</span><span class="picker-copy"><span class="picker-operation-title">${esc(o.label)}</span><span class="picker-description">${esc(o.description)}</span><code>${esc(o.keyword)}</code></span></button><button type="button" class="picker-favorite ${favorites.includes(o.keyword)?'is-favorite':''}" data-favorite="${esc(o.keyword)}" aria-pressed="${favorites.includes(o.keyword)}" aria-label="${favorites.includes(o.keyword)?'Remove':'Add'} ${esc(o.label)} ${favorites.includes(o.keyword)?'from':'to'} favorites" title="${favorites.includes(o.keyword)?'Remove from':'Add to'} favorites">${icon('star')}</button></div>`).join(''):
      `<div class="picker-empty">${terms.length?'No matching operations. Try a name, command or purpose.':tab==='favorites'?'Star an operation to keep it here.':tab==='recent'?'Operations you add will appear here.':'No operations in this category.'}</div>`;
    confirm.disabled=!active;
    list.querySelectorAll('[data-op]').forEach(b=>{b.onclick=()=>select(b.dataset.op,true);b.ondblclick=add;});
    list.querySelectorAll('[data-favorite]').forEach(b=>b.onclick=()=>{const k=b.dataset.favorite;favorites=favorites.includes(k)?favorites.filter(v=>v!==k):[...favorites,k];save('favorites',favorites);render();const next=[...list.querySelectorAll('[data-favorite]')].find(el=>el.dataset.favorite===k);(next||list.querySelector('[data-op]')||search).focus();});
  }
  function select(keyword,focus=false){
    active=keyword;
    list.querySelectorAll('[data-row]').forEach(row=>{const chosen=row.dataset.row===active;row.classList.toggle('selected',chosen);const button=row.querySelector('[data-op]');button.setAttribute('aria-pressed',String(chosen));button.tabIndex=chosen?0:-1;if(chosen){row.scrollIntoView({block:'nearest'});if(focus)button.focus();}});
  }
  function add(){
    if(!active||!visible.some(o=>o.keyword===active))return;
    const index=position.value==='end'?steps.length:Number(position.value);
    recent=[active,...recent.filter(k=>k!==active)].slice(0,12);save('recent',recent);
    onAdd(active,index);
  }
  search.oninput=()=>{query=search.value;active='';render();list.scrollTop=0;};
  modal.querySelectorAll('[data-picker-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.pickerTab;search.value=query='';active='';render();list.scrollTop=0;});
  modal.querySelector('#operation-category').onchange=e=>{category=e.target.value;active='';render();list.scrollTop=0;};
  confirm.onclick=add;
  const keydown=e=>{
    if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();closeModal();return;}
    const inChoices=e.target===search||e.target.closest('[data-op]');
    if(inChoices&&(e.key==='ArrowDown'||e.key==='ArrowUp')){e.preventDefault();const i=visible.findIndex(o=>o.keyword===active),next=Math.max(0,Math.min(visible.length-1,i+(e.key==='ArrowDown'?1:-1)));if(visible[next])select(visible[next].keyword,true);}
    else if(inChoices&&e.key==='Enter'){e.preventDefault();add();}
    else if(e.key==='Tab'){const items=[...modal.querySelectorAll('button:not(:disabled),input,select')].filter(el=>el.tabIndex>=0&&el.getClientRects().length),first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
  };
  document.addEventListener('keydown',keydown,true);render();search.focus();
  return ()=>{document.removeEventListener('keydown',keydown,true);modal.classList.remove('operation-picker');for(const attr of ['role','aria-modal','aria-labelledby'])modal.removeAttribute(attr);if(opener?.isConnected)opener.focus();};
}
