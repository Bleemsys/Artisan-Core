import {regionColours} from './region-model.js';
import {cloneNumericJson,setNumber} from './numeric-json.js';
import {axisQuaternion} from './spatial-model.js';
import * as THREE from './vendor/three.module.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function parallelSlices(template,count,spacing,used=[],withIds=true){
 if(!Number.isInteger(count)||count<1||count>200)throw Error('Slice count must be an integer from 1 to 200.');
 if(!Number.isFinite(spacing)||spacing<=0)throw Error('Center spacing must be positive.');
 const n=new THREE.Vector3(...template.normal).normalize();
 if(!n.lengthSq()||!n.toArray().every(Number.isFinite))throw Error('Slice normal must be nonzero.');
 const ids=new Set(used);let next=1;
 return Array.from({length:count},(_,i)=>{const b=cloneNumericJson(template);delete b.FieldID;
  if(withIds){while(ids.has('Slice'+next))next++;b.FieldID='Slice'+next++;ids.add(b.FieldID);}
  b.ori=template.ori.map((v,j)=>v+n.getComponent(j)*(i-(count-1)/2)*spacing);if(!b.ori.every(Number.isFinite))throw Error('Position must be a finite number.');b.ori.forEach((v,j)=>setNumber(b.ori,j,v,'float'));return b;
 });
}
export function slicePanel({params,targets,target,state,input,messages}){
 const g=target?.geometry,n=g?new THREE.Vector3(0,0,1).applyQuaternion(axisQuaternion(g)):null;
 const preset=n?Math.abs(n.z-1)<1e-7?'XY':Math.abs(n.x-1)<1e-7?'YZ':Math.abs(n.y-1)<1e-7?'ZX':'Custom':'Custom';
 const options=(list,value)=>list.map(([v,l])=>`<option value="${v}" ${v===value?'selected':''}>${l}</option>`).join('');
 return `<h3>Slice boxes</h3><p class="field-help">Edit slice volumes here. Generate the workflow to compute the result.</p>
 <div class="slice-io"><div class="field"><label for="slice-source">Source</label><select id="slice-source" data-slice-source>${options([['Geometry','Geometry'],['Field','Field']],params.Source||'Geometry')}</select></div><div class="field"><label for="slice-output">Output</label><select id="slice-output" data-slice-output ${params.outfile!==undefined?'disabled':''}>${options(params.outfile!==undefined?[['File','Mesh files']]:[['FieldContainer','Field container'],['Lattice','Lattice']],params.outfile!==undefined?'File':params.Target||'Lattice')}</select></div></div>
 ${params.outfile!==undefined?`<div class="field"><label for="slice-outfile">Output file</label><input type="text" id="slice-outfile" data-slice-outfile value="${esc(params.outfile)}"></div>`:''}
 <section class="region-section slice-list-section"><div class="region-heading"><h3>Slices <span translate="no">${(params.Boxes||[]).length}</span></h3><button type="button" class="button" data-slice-add-menu aria-expanded="${!!state.addMenu}">Add slice</button></div>
 ${state.addMenu?`<div class="region-tools slice-add-choices"><button class="button" type="button" data-spatial-add>Single slice</button><button class="button" type="button" data-slice-parallel>Parallel set…</button></div>`:''}
 <div class="region-list" role="group" aria-label="Slices">${(params.Boxes||[]).map((b,i)=>`<div class="region-row ${state.selected==='slice:'+i?'active':''}"><button type="button" data-slice-select="slice:${i}" class="region-select" aria-pressed="${state.selected==='slice:'+i}"><span class="region-swatch" style="background:${regionColours[i%regionColours.length]}"></span><span><strong translate="no">${esc(b.FieldID||'Slice '+(i+1))}</strong><small><span>Box</span> · <span>Thickness</span> <span translate="no" data-slice-thickness="${i}">${Number.isFinite(b.length?.[2])?esc(Number((2*b.length[2]).toPrecision(6))):'—'}</span></small></span></button><input type="checkbox" data-slice-visible="${i}" aria-label="Show slice outline" title="Show slice outline" ${state.hidden.has('slice:'+i)?'':'checked'}></div>`).join('')}</div></section>
 ${state.parallel?`<div class="slice-parallel"><h4>Parallel set</h4><p class="field-help">Uses the selected slice size, orientation and center. Creates separate editable slices.</p><div class="field"><label for="slice-count">Number of slices</label><input id="slice-count" type="number" min="1" max="200" step="1" value="5"></div><div class="field"><label for="slice-spacing">Center spacing</label><input id="slice-spacing" type="number" min="0" step="any" value="${g?g.size[2]*2:10}"></div><p class="field-help">Spacing is measured center to center along the slice normal.</p><div class="region-tools"><button type="button" class="button primary" data-slice-create>Create slices</button><button type="button" class="button" data-slice-cancel>Cancel</button></div></div>`:''}
 ${messages.map(e=>`<p class="field-help" role="status">${esc(e.message)}</p>`).join('')}
 ${target?`<div class="slice-selected"><div class="region-tools"><button type="button" class="button" data-spatial-duplicate>Duplicate slice</button><button type="button" class="button" data-spatial-remove ${params.Boxes.length>1?'':'disabled'}>Remove slice</button></div>
 ${params.outfile===undefined?`<div class="field"><label for="slice-name">Field ID</label><input type="text" id="slice-name" translate="no" data-slice-name value="${esc(params.Boxes[target.slice].FieldID||'')}"></div>`:''}
 <p class="field-help">Full dimensions use the current model units.</p>
 <div class="field"><label for="slice-thickness">Thickness</label><input id="slice-thickness" aria-label="Thickness" type="number" min="0" step="any" data-spatial-number="size.2" value="${g.size[2]}"></div>
 <div class="field"><label>Orientation</label><div class="region-tools">${['XY','YZ','ZX','Custom'].map(p=>`<button type="button" class="button ${preset===p?'selected':''}" data-slice-plane="${p}" aria-pressed="${preset===p}">${p}</button>`).join('')}</div></div>
 ${state.custom||preset==='Custom'?input('rotation_axis','Rotation axis',g.rotation_axis||[0,0,1])+input('rotation_degrees','Angle (degrees)',g.rotation_degrees||0):''}
 <div class="field"><label for="slice-offset">Position along normal</label><input id="slice-offset" data-slice-offset type="number" step="any" value="${n.dot(new THREE.Vector3(...g.center))}"><p class="field-help">Measured from the world origin along the slice normal.</p></div>
 <details data-slice-size ${state.sizeOpen?'open':''}><summary>Size and center</summary><div class="slice-io"><div class="field"><label>Width</label><input aria-label="Width" type="number" min="0" step="any" data-spatial-number="size.0" value="${g.size[0]}"></div><div class="field"><label>Height</label><input aria-label="Height" type="number" min="0" step="any" data-spatial-number="size.1" value="${g.size[1]}"></div></div>${input('center','Center',g.center)}</details>
 <div class="region-tools">${target.modes.map(m=>`<button type="button" class="button ${state.mode===m?'selected':''}" data-spatial-tool="${m}" aria-pressed="${state.mode===m}">${{move:'Move',resize:'Resize',rotate:'Rotate'}[m]}</button>`).join('')}<button type="button" class="button" data-spatial-fit>Fit guides</button><button type="button" class="button" data-spatial-pick>Pick center</button></div>
 <div class="region-snap"><label for="spatial-snap">Drag snap</label><input id="spatial-snap" data-spatial-snap type="number" min="0" step="any" value="${state.snap}"><span>0 = off · Shift rotates by 15°</span></div><label class="project-visible"><input type="checkbox" data-spatial-visible ${state.visible?'checked':''}> Show slice volumes</label>
 <p class="field-help">Use Resize to drag box faces; numeric dimensions update together.</p></div>`:''}
 <div class="region-tools slice-footer"><button type="button" class="button" data-spatial-undo ${state.undo.length?'':'disabled'}>Undo</button><button type="button" class="button" data-spatial-revert>Revert edits</button></div>`;
}

