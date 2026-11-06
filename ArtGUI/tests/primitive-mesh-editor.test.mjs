import test from 'node:test';
import assert from 'node:assert/strict';
import {createPrimitiveMeshEditor} from '../ui/primitive-mesh-editor.js';
import {parseNumericJson,stringifyNumericJson} from '../ui/numeric-json.js';
let JSDOM;try{({JSDOM}=await import(process.env.ARTGUI_TEST_DOM||'jsdom'));}catch{}
const skip=!JSDOM?'Set ARTGUI_TEST_DOM to run DOM integration checks':false;
function fixture(){
  const dom=new JSDOM('<div id="host"></div><div id="viewport-empty"></div>'),previous={document:globalThis.document};globalThis.document=dom.window.document;
  const p=parseNumericJson('{"num_elem":[12,8,6],"x_range":[0.0,60.0],"y_range":[0.0,40.0],"z_range":[0.0,30.0],"ori":[0.0,0.0,0.0],"Normal":[0.0,0.0,1.0],"z_angle":0.0,"Mesh_file":"Box","custom":{"keep":3.0}}');
  let keyword='Gen_BoxMesh';const doc={},errors=[],updates=[],host=document.getElementById('host'),editor=createPrimitiveMeshEditor({getContext:params=>params===p?{keyword,doc,key:'1'}:null,onKeywordChange:(old,next)=>keyword=next,onChange(){},toast:e=>errors.push(e),onBrowse:async()=>null,onGenerate:async()=>({success:true,meshPath:'out.inp'})});
  editor.attachOverlay({update:(...args)=>updates.push(args),hide(){},frame(){},select(){},cancel(){}});editor.show(host,keyword,p);
  const q=s=>host.querySelector(s),change=(path,value)=>{const el=q(`[data-pm-number="${path}"]`);el.value=value;el.dispatchEvent(new dom.window.Event('input'));el.dispatchEvent(new dom.window.Event('change'));};
  return {p,editor,q,change,host,dom,errors,updates,get keyword(){return keyword;},close(){editor.hide();dom.window.close();Object.assign(globalThis,previous);}};
}
test('numeric entry and a viewport drag share state, preserve extras, and group a drag into one undo',{skip},()=>{
  const f=fixture();try{
    f.change('x_range.1','72');assert.equal(f.p.x_range[1],72);f.editor.begin();f.editor.drag('x_range.1',80);f.editor.drag('x_range.1',85);f.editor.commit();assert.equal(f.q('[data-pm-number="x_range.1"]').value,'85');
    f.q('[data-pm-undo]').click();assert.equal(f.p.x_range[1],72);f.q('[data-pm-redo]').click();assert.equal(f.p.x_range[1],85);assert.deepEqual(f.p.custom,{keep:3});
  }finally{f.close();}
});
test('cancelled drag restores parameters and does not enter history',{skip},()=>{
  const f=fixture();try{const before=stringifyNumericJson(f.p);f.editor.begin();f.editor.drag('ori',[5,6,7]);f.editor.cancel();assert.equal(stringifyNumericJson(f.p),before);assert.equal(f.q('[data-pm-undo]').disabled,true);}finally{f.close();}
});
test('invalid inputs never reach the workflow, block save/generate, and can be reset',{skip},()=>{
  const f=fixture();try{f.change('num_elem.0','1.5');assert.equal(f.p.num_elem[0],12);assert.equal(f.editor.applyAll(),false);assert.equal(f.q('[data-pm-generate]').disabled,true);f.q('[data-pm-reset="divisions"]').click();assert.equal(f.editor.applyAll(),true);assert.equal(f.q('[data-pm-number="num_elem.0"]').value,'12');
    f.change('x_range.0','90');f.change('x_range.1','100');assert.deepEqual(f.p.x_range,[90,100]);assert.equal(f.editor.applyAll(),true);
  }finally{f.close();}
});
test('shape selector converts commands, remembers geometry, and supports undo across commands',{skip},()=>{
  const f=fixture();try{
    f.q('[data-pm-shape="Gen_CylindricalMesh"]').click();assert.equal(f.keyword,'Gen_CylindricalMesh');f.change('phi_range.1','180');assert.equal(f.p.phi_range[1],.5);
    f.q('[data-pm-shape="Gen_SphericalMesh"]').click();assert.equal(f.p.Height,undefined);f.change('theta_range.0','45');assert.equal(f.p.theta_range[0],.25);
    f.q('[data-pm-undo]').click();f.q('[data-pm-undo]').click();assert.equal(f.keyword,'Gen_CylindricalMesh');assert.equal(f.p.phi_range[1],.5);assert.equal(f.p.theta_range,undefined);
  }finally{f.close();}
});
test('placement reset preserves geometry and keyboard controls do not change element count types',{skip},()=>{
  const f=fixture();try{f.change('x_range.1','75');f.change('ori.0','10');f.q('[data-pm-reset="placement"]').click();assert.equal(f.p.ori[0],0);assert.equal(f.p.x_range[1],75);assert.match(stringifyNumericJson(f.p),/"num_elem": \[\s*12,/);}finally{f.close();}
});
test('generation distinguishes the local guide from the exported result and marks later edits stale',{skip},async()=>{
  const f=fixture();try{f.q('[data-pm-generate]').click();await new Promise(r=>setTimeout(r,0));assert.match(f.q('[data-pm-status]').textContent,/Mesh generated/);assert.equal(f.q('[data-pm-visible]').checked,true);const count=f.updates.length;f.change('x_range.1','75');assert.match(f.q('[data-pm-status]').textContent,/Settings changed/);assert.ok(f.updates.length>count,'edits after generation must still refresh the guide');}finally{f.close();}
});
test('placement actions are visible and focusing placement fields activates linked handles without changing data',{skip},()=>{
  const f=fixture();try{
    const before=stringifyNumericJson(f.p),move=f.q('[data-pm-tool="move"]'),rotate=f.q('[data-pm-tool="axis"]');
    assert.equal(move.closest('details'),null);assert.equal(rotate.closest('details'),null);
    move.click();assert.equal(f.updates.at(-1)[2].mode,'move');assert.equal(move.getAttribute('aria-pressed'),'true');
    f.q('[data-pm-number="Normal.1"]').focus();assert.equal(f.updates.at(-1)[2].mode,'axis');assert.equal(rotate.getAttribute('aria-pressed'),'true');
    f.q('[data-pm-number="ori.0"]').focus();assert.equal(f.updates.at(-1)[2].mode,'move');
    f.q('[data-pm-tool="shape"]').click();assert.equal(f.updates.at(-1)[2].mode,'shape');assert.equal(f.q('[data-pm-placement-mode]').hidden,true);
    assert.equal(stringifyNumericJson(f.p),before);
  }finally{f.close();}
});

test('Cone shares the selector, preserves shape-specific booleans and ratios, and groups slider changes into one undo',{skip},()=>{
 const f=fixture();try{
  assert.equal(f.host.querySelectorAll('[data-pm-shape]').length,4);f.q('[data-pm-shape="Gen_CappedConeMesh"]').click();assert.equal(f.keyword,'Gen_CappedConeMesh');
  f.change('r_range.0','16');f.change('r_bottom','12');const slider=f.q('[data-pm-taper]');slider.value='35';slider.dispatchEvent(new f.dom.window.Event('input'));slider.value='45';slider.dispatchEvent(new f.dom.window.Event('input'));slider.dispatchEvent(new f.dom.window.Event('change'));assert.equal(f.p.UB_heightRatio,.45);assert.equal(f.q('[data-pm-number="UB_heightRatio"]').value,'45');
  f.q('[data-pm-undo]').click();assert.equal(f.p.UB_heightRatio,.3);f.q('[data-pm-redo]').click();assert.equal(f.p.UB_heightRatio,.45);
  const check=f.q('[data-pm-preserve]');check.checked=true;check.dispatchEvent(new f.dom.window.Event('change'));assert.equal(f.p.Preserve_thickness,true);
  f.q('[data-pm-shape="Gen_CylindricalMesh"]').click();assert.equal(f.p.Preserve_thickness,undefined);assert.equal(f.p.UB_heightRatio,undefined);f.q('[data-pm-shape="Gen_CappedConeMesh"]').click();assert.equal(f.p.Preserve_thickness,true);assert.equal(f.p.UB_heightRatio,.45);assert.equal(f.p.r_bottom,12);
  f.change('UB_heightRatio','100');assert.equal(f.p.UB_heightRatio,.45);assert.equal(f.editor.applyAll(),false);assert.match(f.q('[data-pm-error]').textContent,/Cylinder/);f.q('[data-pm-reset="geometry"]').click();assert.equal(f.editor.applyAll(),true);
 }finally{f.close();}
});
