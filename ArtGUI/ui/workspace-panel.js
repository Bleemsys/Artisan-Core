import {localize} from './i18n.js';

export function createWorkspacePanel(workspace){
 const strip=workspace.querySelector('.workspace-tabstrip'),panes=workspace.querySelector('.workspace-panes');
 const timeline=workspace.querySelector('.timeline');
 timeline?.addEventListener('wheel',event=>{
  if(event.ctrlKey||Math.abs(event.deltaX)>=Math.abs(event.deltaY)||timeline.scrollWidth<=timeline.clientWidth)return;
  const delta=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?timeline.clientWidth:1);
  const next=Math.max(0,Math.min(timeline.scrollWidth-timeline.clientWidth,timeline.scrollLeft+delta));
  if(next===timeline.scrollLeft)return;
  timeline.scrollLeft=next;event.preventDefault();
 },{passive:false});
 const button=document.createElement('button');
 button.type='button';button.id='toggle-workspace-panel';button.className='text-button workspace-pane-toggle';
 panes.id ||= 'workspace-panes';button.setAttribute('aria-controls',panes.id);strip.append(button);
 // This state belongs to the workspace, independently of the selected property panel.
 let expanded=true;
 function render(){
  const open=expanded;
  workspace.classList.toggle('workspace-pane-collapsed',!open);
  panes.hidden=!open;panes.inert=!open;
  button.setAttribute('aria-expanded',String(open));
  button.textContent=open?'Collapse':'Expand';
  button.title=open?'Collapse workflow and resources':'Expand workflow and resources';
  localize(button);
 }
 function setExpanded(open){expanded=!!open;render();}
 button.onclick=()=>setExpanded(!expanded);
 for(const tab of strip.querySelectorAll('[role="tab"]')){
  tab.addEventListener('click',()=>setExpanded(true));
  tab.addEventListener('keydown',event=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key))setExpanded(true);});
 }
 render();
 return {setExpanded};
}
