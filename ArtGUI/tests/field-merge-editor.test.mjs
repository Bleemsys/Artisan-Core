import test from 'node:test';
import assert from 'node:assert/strict';
import {createFieldMergeEditor} from '../ui/field-merge-editor.js';
import {parseNumericJson,stringifyNumericJson} from '../ui/numeric-json.js';
let JSDOM;try{({JSDOM}=await import(process.env.ARTGUI_TEST_DOM||'jsdom'));}catch{}
const skip=!JSDOM;
export function fixture(){
  const dom=new JSDOM('<div id="host"></div><div id="viewport-empty"></div>'),previous=globalThis.document;globalThis.document=dom.window.document;
  const p=parseNumericJson('{"la_name":"BCCubic","size":[4.0,4.0,4.0],"thk":0.4,"Rot":[0.0,0.0,0.0],"Trans":[0.0,0.0,0.0],"Fill":true,"Cube_Request":{},"OP_para":{"InterpType":"Attractor","pt_att":[4.0,4.0,4.0],"pt_r":3.0,"Transition":{}},"custom":7.0}');
  const doc={Setup:{Sample:{Domain:[[0,8],[0,8],[0,8]]}},WorkFlow:{'1':{OP_ExprOperation_GridField:{out_gridFieldFile:'BlendField'}},'2':{OP_FieldMerge:p}}},updates=[],messages=[];
  const editor=createFieldMergeEditor({getContext:params=>params===p?{doc,key:'2'}:null,onChange(){},onRender(){},toast:m=>messages.push(m),latticePicker:(path,v)=>`<input data-fm-text="${path}" value="${v}" aria-label="${path}">`,inspector:{renderCompact(){}},onGenerate:async()=>({success:true,fieldPath:'real-preview.h5'})});
  editor.attachOverlay({update:(...args)=>updates.push(args),hide(){},frame(){}});editor.show(document.getElementById('host'),p);
  const q=s=>document.querySelector(s),change=(path,value)=>{const el=q(`[data-fm-number="${path}"]`);el.value=value;el.dispatchEvent(new dom.window.Event('input'));el.dispatchEvent(new dom.window.Event('change'));};
  return {dom,p,doc,editor,q,change,updates,messages,close(){editor.hide();dom.window.close();globalThis.document=previous;}};
}
test('field sources preserve independent values and serialize only native command keys',{skip},()=>{const f=fixture();try{
  f.q('[data-fm-mode="Field"]').click();assert.equal(f.editor.applyAll(),false);const select=f.q('[data-fm-field]');select.value='BlendField';select.dispatchEvent(new f.dom.window.Event('change'));assert.equal(f.editor.applyAll(),true);f.change('OP_para.min_cap','.2');
  f.q('[data-fm-source="file"]').click();const input=f.q('[data-fm-text="OP_para.FieldFile"]');input.value='values.csv';input.dispatchEvent(new f.dom.window.Event('input'));input.dispatchEvent(new f.dom.window.Event('change'));f.change('OP_para.max_cap','50');
  f.q('[data-fm-source="field"]').click();assert.equal(f.p.OP_para.FieldFile,'BlendField');assert.equal(f.p.OP_para.min_cap,.2);assert.equal(f.p.OP_para.max_cap,1);f.q('[data-fm-source="file"]').click();assert.equal(f.p.OP_para.FieldFile,'values.csv');assert.equal(f.p.OP_para.max_cap,50);assert.doesNotMatch(document.getElementById('host').textContent,/container/i);assert.equal(Object.hasOwn(f.p,'source'),false);
 }finally{f.close();}});
test('invalid numeric drafts cannot be saved or run; reset and undo restore native data',{skip},()=>{const f=fixture();try{
  f.change('OP_para.pt_r','-3');assert.equal(f.p.OP_para.pt_r,3);assert.equal(f.q('[data-fm-run]').disabled,true);assert.equal(f.editor.applyAll(),false);f.q('[data-fm-reset]').click();assert.equal(f.editor.applyAll(),true);f.change('OP_para.pt_r','5');f.q('[data-fm-undo]').click();assert.equal(f.p.OP_para.pt_r,3);assert.equal(f.p.custom,7);assert.match(stringifyNumericJson(f.p),/"custom": 7\.0/);
 }finally{f.close();}});
test('bridge toggling preserves extended bridge values and rotation uses native radians',{skip},()=>{const f=fixture();try{
  f.q('[data-fm-bridge]').click();f.p.OP_para.Transition.extra={keep:3};f.q('[data-fm-bridge]').click();assert.deepEqual(f.p.OP_para.Transition,{});f.q('[data-fm-bridge]').click();assert.equal(f.p.OP_para.Transition.extra.keep,3);f.change('Rot.0','90');assert.ok(Math.abs(f.p.Rot[0]-Math.PI/2)<1e-12);
 }finally{f.close();}});
test('saved preview tracks upstream changes and the editor keeps its shared header outside the body',{skip},async()=>{const f=fixture();try{
  f.q('[data-fm-run]').click();await new Promise(r=>setTimeout(r,0));assert.match(f.q('[data-fm-status]').textContent,/up to date/);f.doc.Setup.res=[2,2,2];f.editor.show(document.getElementById('host'),f.p);assert.match(f.q('[data-fm-status]').textContent,/Settings changed/);assert.equal(f.q('.property-header'),null);assert.equal(f.q('[data-fm-inspect-section]').open,true);
 }finally{f.close();}});
test('mode caching and undo retain loaded mode-specific parameters without destructive open-time normalization',{skip},()=>{const f=fixture();try{
  f.p.OP_para.extra={keep:2};const before=stringifyNumericJson(f.p);f.editor.show(document.getElementById('host'),f.p);assert.equal(stringifyNumericJson(f.p),before);f.q('[data-fm-mode="Linear"]').click();f.change('OP_para.pt_01.0','1.5');f.q('[data-fm-mode="Attractor"]').click();assert.equal(f.p.OP_para.pt_r,3);assert.equal(f.p.OP_para.extra.keep,2);f.q('[data-fm-undo]').click();assert.equal(f.p.OP_para.InterpType,'Linear');assert.equal(f.p.OP_para.pt_01[0],1.5);
 }finally{f.close();}});
