import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createWorkspacePanel} from '../ui/workspace-panel.js';
import {setLanguage} from '../ui/i18n.js';
let JSDOM;try{({JSDOM}=await import(process.env.ARTGUI_TEST_DOM||'jsdom'));}catch{}
const skip=!JSDOM?'Install jsdom or set ARTGUI_TEST_DOM to run DOM integration checks':false;
function fixture(){
 // Match the stylesheet order in index.html, including the rule that previously
 // exposed the point-only button in regular views.
 const html=readFileSync(new URL('../ui/index.html',import.meta.url),'utf8');
 const css=[...html.matchAll(/<link[^>]+href="\.\/([^"]+\.css)"/g)].map(([,file])=>readFileSync(new URL('../ui/'+file,import.meta.url),'utf8')).join('\n');
 const dom=new JSDOM(`<style>${css}</style><div class="workspace"><section class="center-column"><section class="viewport-panel"></section><section class="workspace-tabs"><div class="workspace-tabstrip"><button id="workflow-tab" role="tab">Workflow</button><button id="resources-tab" role="tab">Resources</button></div><div class="workspace-panes"><div id="workflow-content"><div class="timeline"><button class="step-card">Steps</button></div></div><div id="resources-content">RAM</div></div></section><section class="run-panel">Generate</section></section></div>`);
 const previous={document:globalThis.document,CustomEvent:globalThis.CustomEvent};globalThis.document=dom.window.document;globalThis.CustomEvent=dom.window.CustomEvent;setLanguage('en');
 const workspace=document.querySelector('.workspace'),panel=createWorkspacePanel(workspace),button=document.getElementById('toggle-workspace-panel'),panes=document.querySelector('.workspace-panes');
 return {dom,workspace,panel,button,panes,display:()=>dom.window.getComputedStyle(panes).display,restore(){setLanguage('en');Object.assign(globalThis,previous);dom.window.close();}};
}

test('bottom-panel toggle hides and shows content in regular views with production CSS',{skip},()=>{
 const f=fixture();try{
  assert.equal(f.button.textContent,'Collapse');assert.equal(f.display(),'grid');
  f.button.click();assert.equal(f.display(),'none');assert.equal(f.panes.hidden,true);assert.equal(f.panes.inert,true);assert.equal(f.button.getAttribute('aria-expanded'),'false');assert.equal(f.button.textContent,'Expand');
  f.button.click();assert.equal(f.display(),'grid');assert.equal(f.panes.hidden,false);assert.equal(f.panes.inert,false);assert.equal(f.button.getAttribute('aria-expanded'),'true');
  assert.equal(f.button.getAttribute('aria-controls'),f.panes.id);
 }finally{f.restore();}
});

test('the same expand/collapse choice works across every property-panel selection',{skip},()=>{
 const f=fixture();try{
  for(const selected of ['setup','geometry','file:geometry-123','1','field:field-123','points:points-123',null]){
   // This is the presentation class changed by refreshProperties. It must not
   // control the bottom panel's visibility or reset the user's choice.
   f.workspace.classList.toggle('point-cloud-mode',!!selected?.startsWith('points:'));
   assert.equal(f.display(),'grid',String(selected));
   f.button.click();assert.equal(f.display(),'none',String(selected));
   f.workspace.classList.toggle('point-cloud-mode',!f.workspace.classList.contains('point-cloud-mode'));
   assert.equal(f.display(),'none','Selection changes preserve collapse');
   f.button.click();assert.equal(f.display(),'grid',String(selected));
  }
  // The full-workspace control has a separate purpose; restoring it retains
  // the bottom panel's choice rather than resetting it.
  f.button.click();f.workspace.classList.add('workspace-expanded');
  assert.equal(f.display(),'none');f.workspace.classList.remove('workspace-expanded');assert.equal(f.display(),'none');
  f.button.click();assert.equal(f.display(),'grid');
 }finally{f.restore();}
});

test('both bottom tabs and keyboard navigation reopen the collapsed panel',{skip},()=>{
 const f=fixture();try{
  for(const tab of ['workflow-tab','resources-tab']){
   f.button.click();assert.equal(f.display(),'none');document.getElementById(tab).click();assert.equal(f.display(),'grid');
  }
  for(const key of ['ArrowLeft','ArrowRight','Home','End']){
   f.button.click();document.getElementById('workflow-tab').dispatchEvent(new f.dom.window.KeyboardEvent('keydown',{key}));assert.equal(f.display(),'grid');
  }
 }finally{f.restore();}
});

test('panel actions and language switching retain translated labels and working visibility',{skip},()=>{
 const f=fixture();try{
  setLanguage('zh-CN');assert.equal(f.button.textContent,'收起');assert.equal(f.button.title,'收起工作流与资源');
  f.button.click();assert.equal(f.button.textContent,'展开');assert.equal(f.button.title,'展开工作流与资源');assert.equal(f.display(),'none');
  setLanguage('en');assert.equal(f.button.textContent,'Expand');
  setLanguage('zh-CN');f.button.click();assert.equal(f.button.textContent,'收起');assert.equal(f.display(),'grid');
  setLanguage('en');assert.equal(f.button.textContent,'Collapse');assert.equal(f.button.title,'Collapse workflow and resources');
 }finally{f.restore();}
});

test('every keyword retains the Add_Lattice workspace grid and a scrollable workflow row',{skip},()=>{
 const f=fixture();try{f.workspace.classList.add('geometry-field-mode');const style=f.dom.window.getComputedStyle(f.workspace.querySelector('.center-column')),panes=f.dom.window.getComputedStyle(f.panes),timeline=f.dom.window.getComputedStyle(f.workspace.querySelector('.timeline'));
 assert.match(style.gridTemplateRows,/250px auto$/);
 const reference=f.dom.window.getComputedStyle(f.workspace);
 for(const mode of ['transition-operation-mode','primitive-mesh-mode','geometry-field-mode','geometry-operation-mode','scalar-region-mode','setup-editor-mode','size-mesher-mode','lattice-definition-mode','point-cloud-mode','']){f.workspace.className='workspace '+mode;const c=f.dom.window.getComputedStyle(f.workspace);assert.equal(c.gridTemplateColumns,reference.gridTemplateColumns,mode);assert.equal(c.getPropertyValue('--properties-panel-width'),reference.getPropertyValue('--properties-panel-width'),mode);assert.equal(f.dom.window.getComputedStyle(f.workspace.querySelector('.center-column')).gridTemplateRows,style.gridTemplateRows,mode);}
assert.equal(panes.minHeight,'0px');assert.equal(panes.overflow,'hidden');assert.equal(panes.getPropertyValue('scrollbar-width'),'none');assert.equal(timeline.getPropertyValue('scrollbar-width'),'auto');assert.equal(timeline.overflowX,'auto');
 f.panel.setExpanded(false);assert.equal(f.display(),'none');f.panel.setExpanded(true);assert.equal(f.display(),'grid');
 }finally{f.restore();}
});
test('ordinary mouse-wheel movement navigates long workflows',{skip},()=>{
 const f=fixture();try{const timeline=f.workspace.querySelector('.timeline');Object.defineProperties(timeline,{scrollWidth:{value:1500},clientWidth:{value:500}});
 const wheel=new f.dom.window.WheelEvent('wheel',{deltaY:120,bubbles:true,cancelable:true});timeline.dispatchEvent(wheel);assert.equal(timeline.scrollLeft,120);assert.equal(wheel.defaultPrevented,true);
 const zoom=new f.dom.window.WheelEvent('wheel',{deltaY:120,ctrlKey:true,bubbles:true,cancelable:true});timeline.dispatchEvent(zoom);assert.equal(timeline.scrollLeft,120);assert.equal(zoom.defaultPrevented,false);
 }finally{f.restore();}
});
