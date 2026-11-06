import test from 'node:test';
import assert from 'node:assert/strict';
import {openTpmsCellEditor} from '../ui/tpms-cell-editor.js';
import {newTpmsDefinition,sampleTpmsGrid} from '../ui/tpms-cell-model.js';
import {stringifyNumericJson,parseNumericJson} from '../ui/numeric-json.js';
let JSDOM;try{({JSDOM}=await import(process.env.ARTGUI_TEST_DOM||'jsdom'));}catch{}
const skip=!JSDOM?'Set ARTGUI_TEST_DOM for DOM checks':false;
async function fixture(options={}){
 const dom=new JSDOM('<button id="origin">Edit TPMS</button>'),old={document:globalThis.document,window:globalThis.window};Object.assign(globalThis,{document:dom.window.document,window:dom.window});dom.window.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};dom.window.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};document.querySelector('#origin').focus();
 const applied=[],views=[],jobs={disposed:false,cancelled:0};const editor=openTpmsCellEditor({name:'CustomTPMS',definition:newTpmsDefinition(),onApply:d=>applied.push(d),debounceMs:0,viewportFactory:()=>({update:s=>views.push(s),fit(){},dispose(){}}),jobFactory:c=>({run(d,n){try{c.onResult(sampleTpmsGrid(d,n));}catch(e){c.onError(e.message);}},cancel(){jobs.cancelled++;},dispose(){jobs.disposed=true;}}),...options});await new Promise(r=>setTimeout(r,0));const q=s=>editor.dialog.querySelector(s),click=id=>q(`[data-tc="${id}"]`).click(),edit=(selector,value)=>{const el=q(selector);el.dispatchEvent(new dom.window.FocusEvent('focus'));el.value=value;el.dispatchEvent(new dom.window.Event('input',{bubbles:true}));el.dispatchEvent(new dom.window.Event('change',{bubbles:true}));el.dispatchEvent(new dom.window.FocusEvent('blur'));};return{dom,editor,q,click,edit,applied,views,jobs,async flush(){await new Promise(r=>setTimeout(r,5));},close(){editor.close();dom.window.close();Object.assign(globalThis,old);}};
}
test('initial local preview is ready and Apply sends only the original definition fields',{skip},async()=>{
 const f=await fixture();try{assert.equal(f.editor.getPhase(),'ready');assert.ok(f.editor.getGrid().cells.length);assert.equal(f.q('[data-tc="apply"]').disabled,false);f.click('apply');assert.equal(f.applied.length,1);assert.deepEqual(f.applied[0].definition,newTpmsDefinition());assert.equal(f.editor.dialog.isConnected,false);assert.equal(f.jobs.disposed,true);}finally{f.close();}
});
test('editing an equation invalidates the old preview, resamples and supports undo/redo',{skip},async()=>{
 const f=await fixture();try{const old=f.editor.getGrid();f.edit('[data-expression]','cos(x)+0.5*cos(y)+cos(z)');assert.equal(f.editor.getPhase(),'outdated');assert.equal(f.q('[data-tc="apply"]').disabled,true);assert.match(f.q('[data-preview-badge]').textContent,/Previous grid/);await f.flush();assert.notEqual(f.editor.getGrid(),old);assert.equal(f.editor.getPhase(),'ready');f.click('undo');await f.flush();assert.equal(f.editor.getDraft().definition.definition.expr,newTpmsDefinition().definition.expr);f.click('redo');await f.flush();assert.match(f.editor.getDraft().definition.definition.expr,/0.5/);}finally{f.close();}
});
test('failed expressions retain the last grid clearly marked as stale and never apply',{skip},async()=>{
 const f=await fixture();try{const old=f.editor.getGrid();f.edit('[data-expression]','1/x');await f.flush();assert.equal(f.editor.getGrid(),old);assert.equal(f.editor.getPhase(),'error');assert.equal(f.q('[data-tc="apply"]').disabled,true);assert.match(f.q('[data-error]').textContent,/grid point/);assert.deepEqual(f.applied,[]);}finally{f.close();}
});
test('slice and display controls change inspection without modifying the definition',{skip},async()=>{
 const f=await fixture();try{const before=f.editor.getDraft();f.q('[data-display="slice"]').click();assert.equal(f.views.at(-1).mode,'slice');f.q('[data-slice-axis]').value='x';f.q('[data-slice-axis]').dispatchEvent(new f.dom.window.Event('change'));f.q('[data-slice-position]').value='.75';f.q('[data-slice-position]').dispatchEvent(new f.dom.window.Event('input'));assert.equal(f.views.at(-1).sliceAxis,'x');assert.equal(f.views.at(-1).sliceIndex,18);assert.equal(f.q('[data-tc="neighbours"]').disabled,true);assert.deepEqual(f.editor.getDraft(),before);}finally{f.close();}
});

test('volume is the default and appearance controls update without resampling or changing the saved definition',{skip},async()=>{
 const f=await fixture();try{
  const before=f.editor.getDraft(),grid=f.editor.getGrid(),cancelled=f.jobs.cancelled;
  assert.equal(f.views.at(-1).mode,'volume');assert.equal(f.q('[data-display="volume"]').getAttribute('aria-pressed'),'true');
  assert.equal(f.views.at(-1).volume.opacity,6);assert.equal(f.views.at(-1).volume.region,'near-zero');assert.equal(f.views.at(-1).volume.band,Number(f.q('[data-volume-band]').min));assert.equal(f.q('[data-volume-band-label]').hidden,false);
  assert.equal(f.q('[data-volume-controls]').hidden,false);assert.equal(f.q('[data-volume-cut-controls]').hidden,true);
  const change=(selector,value,event='change')=>{f.q(selector).value=value;f.q(selector).dispatchEvent(new f.dom.window.Event(event));};
  change('[data-volume-opacity]','4','input');change('[data-volume-region]','near-zero');change('[data-volume-band]','.15','input');change('[data-volume-interpolation]','nearest');
  f.q('[data-volume-clip]').checked=true;f.q('[data-volume-clip]').dispatchEvent(new f.dom.window.Event('change'));
  change('[data-volume-cut-axis]','x');change('[data-volume-cut-side]','upper');change('[data-volume-cut-position]','.3','input');
  assert.deepEqual(f.views.at(-1).volume,{opacity:4,region:'near-zero',band:.15,smooth:false,clipEnabled:true,clipAxis:'x',clipPosition:.3,clipSide:'upper'});
  assert.equal(f.q('[data-volume-band-label]').hidden,false);assert.equal(f.q('[data-volume-cut-controls]').hidden,false);
  assert.equal(f.editor.getGrid(),grid);assert.equal(f.jobs.cancelled,cancelled);assert.deepEqual(f.editor.getDraft(),before);
  f.q('[data-display="cells"]').click();assert.equal(f.q('[data-volume-controls]').hidden,true);
  f.q('[data-display="volume"]').click();assert.equal(f.views.at(-1).volume.opacity,4);
  f.click('apply');assert.deepEqual(f.applied[0],before);
 }finally{f.close();}
});
test('cancel discards draft changes, import round trips extra fields and malformed imports are atomic',{skip},async()=>{
 const raw='{"type":"TPMS","extra":1.00,"definition":{"expr":"cos(x)+cos(y)+cos(z)","unit_x_len":"2*pi","unit_y_len":"2*pi","unit_z_len":"2*pi","ladomain":"Hex","other":3.00}}';const f=await fixture();try{f.click('json');f.q('[data-json-text]').value=raw;f.click('import-json');assert.equal(stringifyNumericJson(f.editor.getDraft().definition),stringifyNumericJson(parseNumericJson(raw)));const before=f.editor.getDraft();f.click('json');f.q('[data-json-text]').value='{"type":"TPMS-Field"}';f.click('import-json');assert.deepEqual(f.editor.getDraft(),before);assert.equal(f.q('[data-json]').hidden,false);f.click('cancel');assert.equal(f.q('[data-discard]').hidden,false);f.click('discard');assert.equal(f.editor.dialog.isConnected,false);assert.equal(f.applied.length,0);}finally{f.close();}
});
test('name conflicts are recoverable and project-save shortcut cannot discard an unapplied draft',{skip},async()=>{
 const f=await fixture({validateName:n=>n==='Taken'?'Name already used.':''});try{f.edit('[data-name]','Taken');f.click('apply');assert.equal(f.applied.length,0);assert.match(f.q('[data-error]').textContent,/already used/);f.edit('[data-name]','Available');assert.equal(f.q('[data-tc="apply"]').disabled,false);let saved=false;document.addEventListener('keydown',()=>saved=true);f.q('[data-name]').dispatchEvent(new f.dom.window.KeyboardEvent('keydown',{key:'s',ctrlKey:true,bubbles:true,cancelable:true}));assert.equal(saved,false);f.click('apply');assert.equal(f.applied[0].name,'Available');}finally{f.close();}
});

test('a volume-renderer failure remains visible and other inspection modes can recover without changing the draft',{skip},async()=>{
 const f=await fixture({viewportFactory:()=>({update:s=>{if(s.mode==='volume')throw Error('Volume unavailable; choose Slice.');},fit(){},dispose(){}})});
 try{const before=f.editor.getDraft();assert.match(f.q('[data-status]').textContent,/Volume unavailable/);f.q('[data-display="slice"]').click();assert.equal(f.q('[data-status]').textContent,'Local preview updated.');assert.equal(f.editor.getPhase(),'ready');assert.deepEqual(f.editor.getDraft(),before);}finally{f.close();}
});
