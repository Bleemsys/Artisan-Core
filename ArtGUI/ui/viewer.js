import * as THREE from './vendor/three.module.js';
import {OrbitControls} from './vendor/addons/controls/OrbitControls.js';

const DIRECTIONS={Front:[0,-1,0],Back:[0,1,0],Left:[-1,0,0],Right:[1,0,0],Top:[0,0,1],Bottom:[0,0,-1],Isometric:[1,-1,1]};
const DEFAULTS={background:'#17232f',sourceColor:'#87a3ba',resultColor:'#ebbb68',right:'pan',sensitivity:1,invertZoom:false,units:'mm'};
function readStored(key,fallback){try{return JSON.parse(localStorage.getItem(key))||fallback;}catch{return fallback;}}
const fmt=n=>Number(n.toPrecision(6)).toString();

export class GeometryViewer{
  constructor(canvas,{toast=()=>{},exportImage=null,onLayerSelected=()=>{},onLayersChanged=()=>{}}={}){
    this.canvas=canvas;this.toast=toast;this.exportImage=exportImage;this.onLayerSelected=onLayerSelected;this.onLayersChanged=onLayersChanged;
    this.settings={...DEFAULTS,...readStored('artisan.viewer.preferences',{})};
    delete this.settings.left; // Left dragging is now set only by the navigation selector.
    this.savedViews=readStored('artisan.viewer.views',[]);if(!Array.isArray(this.savedViews))this.savedViews=[];
    this.layers=new Map();this.activeLayer='source';this.origin=new THREE.Vector3();this.hasOrigin=false;
    this.scene=new THREE.Scene();this.scene.background=new THREE.Color(this.settings.background);
    this.projection='perspective';this.span=10;this.camera=new THREE.PerspectiveCamera(42,1,.001,1e9);
    this.camera.up.set(0,0,1);this.camera.position.set(6,-6,6);
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:false,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));
    this.controls=new OrbitControls(this.camera,canvas);this.controls.enableDamping=false;
    this.controls.addEventListener('change',()=>this.render());
    this.controls.addEventListener('start',()=>{if(this.$('standard-view'))this.$('standard-view').value='';});
    this.display='solid';this.section={enabled:false,normal:[1,0,0],fraction:0,flip:false};this.plane=new THREE.Vector4(1,0,0,0);
    this.guides={grid:false,axes:true,box:false};this.helpers=new THREE.Group();this.scene.add(this.helpers);
    this.measurements=[];this.pending=[];this.measureMode='off';this.measureGroup=new THREE.Group();this.scene.add(this.measureGroup);
    this.labelHost=document.createElement('div');this.labelHost.className='measurement-labels';canvas.parentElement.append(this.labelHost);
    this.installTools();this.createCube();this.applyNavigation();
    // A click picks a measurement point; a drag retains the chosen navigation action.
    canvas.addEventListener('pointerdown',e=>{if(e.button===0&&e.isPrimary)this.pointerStart={id:e.pointerId,x:e.clientX,y:e.clientY,dragged:false};});
    canvas.addEventListener('pointermove',e=>{const p=this.pointerStart;if(p&&p.id===e.pointerId&&Math.hypot(e.clientX-p.x,e.clientY-p.y)>=5)p.dragged=true;});
    canvas.addEventListener('pointerup',e=>{const p=this.pointerStart;this.pointerStart=null;if(e.button===0&&p&&p.id===e.pointerId&&!p.dragged&&Math.hypot(e.clientX-p.x,e.clientY-p.y)<5)this.pick(e);});
    canvas.addEventListener('pointercancel',()=>{this.pointerStart=null;});
    this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(canvas.parentElement);this.resize();
  }
  $(id){return document.getElementById(id);}
  persist(){try{localStorage.setItem('artisan.viewer.preferences',JSON.stringify(this.settings));}catch{this.toast('Viewer preferences could not be saved.');}}
  rebindControls(target=this.controls.target.clone()){
    this.controls.dispose();this.controls=new OrbitControls(this.camera,this.canvas);
    this.controls.target.copy(target);this.controls.enableDamping=false;
    this.controls.addEventListener('change',()=>this.render());
    this.controls.addEventListener('start',()=>{this.$('standard-view').value='';});
    this.applyNavigation();this.controls.update();
  }
  installTools(){
    const host=this.$('viewer-toolbar');
    host.innerHTML=`
      <label>View <select id="standard-view"><option value="">Custom</option>${Object.keys(DIRECTIONS).map(n=>`<option>${n}</option>`).join('')}</select></label>
      <select id="projection-select" aria-label="Projection"><option value="perspective">Perspective</option><option value="orthographic">Orthographic</option></select>
      <select id="display-select" aria-label="Display mode"><option value="solid">Solid</option><option value="wireframe">Wireframe</option><option value="edges">Solid + edges</option></select>
      <select id="navigation-mode" aria-label="Navigation tool"><option value="rotate">Orbit</option><option value="pan">Pan</option><option value="zoom">Zoom</option></select>
      <details><summary>Section</summary><div class="viewer-menu">
        <label><input type="checkbox" id="section-enabled"> Enable section plane</label>
        <label>Direction <select id="section-axis"><option>X</option><option>Y</option><option>Z</option><option>Custom</option></select></label>
        <div id="section-custom" hidden class="viewer-vector">${['X','Y','Z'].map((a,i)=>`<label>${a}<input id="section-normal-${i}" aria-label="Section normal ${a}" type="number" step="any" value="${i===0?1:0}"></label>`).join('')}</div>
        <label>Position <input type="range" id="section-position" min="0" max="100" value="0"></label>
        <output id="section-readout"></output><label><input type="checkbox" id="section-flip"> Reverse visible side</label>
        <small>Display cut only. Cut surfaces are open; geometry is not modified.</small>
      </div></details>
      <details><summary>Visibility</summary><div class="viewer-menu" id="layer-controls"></div></details>
      <details><summary>Measure</summary><div class="viewer-menu">
        <label>Model <select id="measurement-layer"><option value="source">Source</option><option value="result">Result</option></select></label>
        <label>Tool <select id="measurement-mode"><option value="off">Off</option><option value="distance">Distance — 2 points</option><option value="angle">Angle — 3 points</option></select></label>
        <label><input type="checkbox" id="measurement-snap"> Snap to triangle vertices</label>
        <p id="measurement-status" role="status">Load full-detail geometry to measure.</p>
        <button id="clear-measurements" class="button">Clear measurements</button>
        <small>Angle: the second point is the vertex. Measurements use the selected full-detail mesh. Click to select points; drag to navigate. Press Esc to finish.</small>
      </div></details>
      <details><summary>More</summary><div class="viewer-menu viewer-more">
        <fieldset><legend>Reference guides</legend>${['grid','axes','box'].map(n=>`<label><input type="checkbox" id="guide-${n}" ${this.guides[n]?'checked':''}> ${n==='box'?'Bounding box & dimensions':n}</label>`).join('')}</fieldset>
        <label>Background <input type="color" id="viewer-background"></label>
        <label>Unit label <select id="viewer-units"><option>mm</option><option>cm</option><option>m</option><option>in</option><option>units</option></select></label><small>Choose the file’s units. This changes labels, not model scale.</small>
        <fieldset><legend>Mouse controls</legend><label>Right button <select id="mouse-right"><option value="pan">Pan</option><option value="rotate">Orbit</option><option value="zoom">Zoom</option></select></label><label>Sensitivity <input id="mouse-sensitivity" type="range" min="0.2" max="3" step="0.1"></label><label><input id="zoom-invert" type="checkbox"> Reverse scroll zoom</label><small>Left drag uses the selected Orbit, Pan or Zoom tool. Middle button zooms. Touch: one finger orbits; two fingers pan and zoom.</small></fieldset>
        <fieldset><legend>Saved camera views</legend><input id="saved-view-name" aria-label="View name" placeholder="View name" maxlength="60"><button id="save-camera" class="button">Save current view</button><select id="saved-view-list" aria-label="Saved views"></select><div><button id="restore-camera" class="button">Restore</button> <button id="delete-camera" class="button">Delete</button></div></fieldset>
        <fieldset><legend>Save image</legend><label><input id="image-transparent" type="checkbox"> Transparent background</label><label><input id="image-annotations" type="checkbox" checked> Include dimensions & measurements</label><button id="save-view-image" class="button">Save PNG…</button></fieldset>
      </div></details>`;
    host.querySelectorAll('details').forEach(d=>d.addEventListener('toggle',()=>{if(d.open)host.querySelectorAll('details').forEach(other=>{if(other!==d)other.open=false;});}));
    document.addEventListener('pointerdown',e=>{if(!host.contains(e.target))host.querySelectorAll('details').forEach(d=>d.open=false);});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'){host.querySelectorAll('details').forEach(d=>d.open=false);this.pending=[];this.setMeasureMode('off');this.redrawMeasurements();}});
    this.$('standard-view').onchange=e=>{if(e.target.value)this.standardView(e.target.value);};
    this.$('projection-select').onchange=e=>this.setProjection(e.target.value);
    this.$('display-select').onchange=e=>this.setDisplay(e.target.value);
    this.$('navigation-mode').onchange=()=>this.applyNavigation();
    this.$('section-enabled').onchange=e=>{this.section.enabled=e.target.checked;this.updateSection();};
    this.$('section-axis').onchange=e=>{this.$('section-custom').hidden=e.target.value!=='Custom';this.updateSectionNormal();};
    for(let i=0;i<3;i++)this.$(`section-normal-${i}`).onchange=()=>this.updateSectionNormal();
    this.$('section-position').oninput=e=>{this.section.fraction=Number(e.target.value)/100;this.updateSection();};
    this.$('section-flip').onchange=e=>{this.section.flip=e.target.checked;this.updateSection();};
    this.$('measurement-layer').onchange=e=>{this.setActiveLayer(e.target.value);this.pending=[];this.measureStatus();this.redrawMeasurements();};
    this.$('measurement-mode').onchange=e=>this.setMeasureMode(e.target.value);
    this.$('clear-measurements').onclick=()=>{this.measurements=[];this.pending=[];this.redrawMeasurements();this.measureStatus();};
    for(const n of ['grid','axes','box'])this.$(`guide-${n}`).onchange=e=>{this.guides[n]=e.target.checked;this.refreshHelpers();this.render();};
    this.$('viewer-background').value=this.settings.background;
    this.$('viewer-background').oninput=e=>{this.settings.background=e.target.value;this.scene.background.set(e.target.value);this.persist();this.render();};
    this.$('viewer-units').value=this.settings.units;
    this.$('viewer-units').onchange=e=>{this.settings.units=e.target.value;this.persist();this.redrawMeasurements();this.updateSection();this.onLayersChanged();};
    this.$('mouse-right').value=this.settings.right;
    this.$('mouse-right').onchange=e=>{this.settings.right=e.target.value;this.persist();this.applyNavigation();};
    this.$('mouse-sensitivity').value=this.settings.sensitivity;
    this.$('mouse-sensitivity').oninput=e=>{this.settings.sensitivity=Number(e.target.value);this.persist();this.applyNavigation();};
    this.$('zoom-invert').checked=this.settings.invertZoom;
    this.$('zoom-invert').onchange=e=>{this.settings.invertZoom=e.target.checked;this.persist();this.applyNavigation();};
    this.$('save-camera').onclick=()=>this.saveCamera();this.$('restore-camera').onclick=()=>this.restoreCamera();this.$('delete-camera').onclick=()=>this.deleteCamera();
    this.$('save-view-image').onclick=()=>this.saveImage().catch(e=>this.toast(`Image export failed: ${e.message||e}`));
    this.refreshSavedViews();this.refreshLayers();
  }
  material(color){return new THREE.ShaderMaterial({side:THREE.DoubleSide,transparent:false,uniforms:{tint:{value:new THREE.Color(color)},opacity:{value:1},displayMode:{value:0},sectionOn:{value:false},sectionPlane:{value:this.plane}},
    vertexShader:`varying vec3 vView;varying vec3 vWorld;varying vec3 vBary;void main(){int corner=gl_VertexID%3;vBary=corner==0?vec3(1.,0.,0.):corner==1?vec3(0.,1.,0.):vec3(0.,0.,1.);vec4 mv=modelViewMatrix*vec4(position,1.);vView=mv.xyz;vWorld=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*mv;}`,
    fragmentShader:`uniform vec3 tint;uniform float opacity;uniform int displayMode;uniform bool sectionOn;uniform vec4 sectionPlane;varying vec3 vView;varying vec3 vWorld;varying vec3 vBary;void main(){if(sectionOn&&dot(vec4(vWorld,1.),sectionPlane)<0.)discard;vec3 n=normalize(cross(dFdx(vView),dFdy(vView)));float light=.3+.7*abs(dot(n,normalize(vec3(.4,.8,.6))));vec3 c=tint*light;if(displayMode!=0){vec3 e=smoothstep(vec3(0.),fwidth(vBary)*1.2,vBary);float edge=1.-min(min(e.x,e.y),e.z);if(displayMode==1){if(edge<.2)discard;c=tint;}else c=mix(c,vec3(.07,.1,.13),edge*.85);}gl_FragColor=vec4(c,opacity);}`});}
  setLayer(id,positions,{center=null,bounds=null,path='',mode='full',total=positions.length/9,lines=null,edges=null,metadata=null,topology=null}={}){
    if((!positions.length&&!lines?.length)||positions.length%9)throw Error('No complete triangles in this model.');
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.computeBoundingBox();
    if(!positions.length&&lines?.length){geometry.boundingBox=new THREE.Box3().setFromArray(lines);}
    if(![...geometry.boundingBox.min.toArray(),...geometry.boundingBox.max.toArray()].every(Number.isFinite)){geometry.dispose();throw Error('Model contains invalid coordinates.');}
    if(!center){center=geometry.boundingBox.getCenter(new THREE.Vector3()).toArray();geometry.translate(-center[0],-center[1],-center[2]);}
    geometry.computeBoundingSphere();
    if(!this.hasOrigin){this.origin.fromArray(center);this.hasOrigin=true;}
    const previous=this.layers.get(id),visible=previous?.mesh.visible??true,alpha=previous?.material.uniforms.opacity.value??1;
    if(previous){this.scene.remove(previous.mesh);this.disposeLayer(previous);}
    this.settings[id+'Color'] ||= this.settings.sourceColor;
    const material=this.material(this.settings[id+'Color']),mesh=new THREE.Mesh(geometry,material);
    if(metadata){
      // FE edges follow element boundaries rather than triangulation diagonals.
      material.polygonOffset=true;material.polygonOffsetFactor=1;material.polygonOffsetUnits=1;
      material.fragmentShader=material.fragmentShader.replace('if(displayMode!=0){','if(displayMode==1)discard;if(false){');
      for(const [role,values] of [['beams',lines],['edges',edges]]){
        if(!values?.length)continue;
        const lineGeometry=new THREE.BufferGeometry();lineGeometry.setAttribute('position',new THREE.BufferAttribute(values,3));
        const lineMaterial=new THREE.ShaderMaterial({uniforms:material.uniforms,transparent:alpha<1,depthWrite:alpha>=1,
          vertexShader:`varying vec3 vWorld;void main(){vec4 p=modelMatrix*vec4(position,1.);vWorld=p.xyz;gl_Position=projectionMatrix*viewMatrix*p;}`,
          fragmentShader:`uniform vec3 tint;uniform float opacity;uniform bool sectionOn;uniform vec4 sectionPlane;varying vec3 vWorld;void main(){if(sectionOn&&dot(vec4(vWorld,1.),sectionPlane)<0.)discard;gl_FragColor=vec4(tint,opacity);}`});
        const child=new THREE.LineSegments(lineGeometry,lineMaterial);child.userData.role=role;mesh.add(child);
      }
    }
    mesh.position.fromArray(center).sub(this.origin);mesh.visible=visible;
    const box=bounds?new THREE.Box3(new THREE.Vector3(...bounds[0]).sub(this.origin),new THREE.Vector3(...bounds[1]).sub(this.origin)):geometry.boundingBox.clone().translate(mesh.position);
    const layer={mesh,geometry,material,box,path,mode,total,shown:positions.length/9,metadata,topology};this.layers.set(id,layer);this.scene.add(mesh);
    this.measurements=this.measurements.filter(m=>m.layer!==id);this.pending=[];
    this.setOpacity(id,alpha);this.setDisplay(this.display);this.setActiveLayer(id);this.refreshLayers();this.refreshHelpers();this.updateSection();this.redrawMeasurements();this.fit();
  }
  disposeLayer(layer){layer.mesh.traverse(obj=>{obj.geometry?.dispose();obj.material?.dispose();});}
  removeLayer(id){const layer=this.layers.get(id);if(!layer)return;this.scene.remove(layer.mesh);this.disposeLayer(layer);this.layers.delete(id);this.measurements=this.measurements.filter(m=>m.layer!==id);this.pending=[];if(this.activeLayer===id)this.activeLayer=this.layers.keys().next().value||'source';if(!this.layers.size){this.hasOrigin=false;this.origin.set(0,0,0);}this.refreshLayers();this.refreshHelpers();this.updateSection();this.redrawMeasurements();}
  clear(){for(const layer of this.layers.values()){this.scene.remove(layer.mesh);this.disposeLayer(layer);}this.layers.clear();this.hasOrigin=false;this.origin.set(0,0,0);this.measurements=[];this.pending=[];this.activeLayer='source';this.section.enabled=false;this.$('section-enabled').checked=false;this.setMeasureMode('off');this.refreshLayers();this.refreshHelpers();this.updateSection();this.render();}
  bounds(visible=true){const box=new THREE.Box3();for(const l of this.layers.values())if(!visible||l.mesh.visible)box.union(l.box);return box;}
  radius(){const box=this.bounds();return box.isEmpty()?1:Math.max(box.getSize(new THREE.Vector3()).length()/2,1e-6);}
  refreshHelpers(){
    for(const child of [...this.helpers.children]){child.traverse(obj=>{obj.geometry?.dispose();if(Array.isArray(obj.material))obj.material.forEach(m=>m.dispose());else obj.material?.dispose();});this.helpers.remove(child);}
    const box=this.bounds();if(box.isEmpty())return;const size=Math.max(box.getSize(new THREE.Vector3()).length(),1e-6),center=box.getCenter(new THREE.Vector3());
    if(this.guides.grid){const grid=new THREE.GridHelper(size*1.5,10,0x667788,0x394b5d);grid.rotation.x=Math.PI/2;grid.position.set(center.x,center.y,box.min.z);this.helpers.add(grid);}
    if(this.guides.axes){
      // Mesh shafts have real thickness on every WebGL platform.
      const length=size*.25,head=length*.2,shaft=length-head;
      for(const [name,direction,color] of [['X',[1,0,0],0xff5555],['Y',[0,1,0],0x55dd77],['Z',[0,0,1],0x5599ff]]){
        const arrow=new THREE.Group();arrow.name=`${name} axis`;arrow.position.copy(box.min);
        arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(...direction));
        const material=new THREE.MeshBasicMaterial({color,depthTest:false,depthWrite:false});
        const stem=new THREE.Mesh(new THREE.CylinderGeometry(length*.018,length*.018,shaft,12),material);
        stem.position.y=shaft/2;
        const tip=new THREE.Mesh(new THREE.ConeGeometry(length*.065,head,16),material.clone());
        tip.position.y=shaft+head/2;stem.renderOrder=tip.renderOrder=90;arrow.add(stem,tip);this.helpers.add(arrow);
      }
    }
    if(this.guides.box)this.helpers.add(new THREE.Box3Helper(box,0x91a9bc));
  }
  resize(){const b=this.canvas.parentElement.getBoundingClientRect();if(!b.width||!b.height)return;this.aspect=b.width/b.height;this.renderer.setSize(b.width,b.height,false);this.updateCamera();this.render();}
  updateCamera(){if(this.camera.isPerspectiveCamera)this.camera.aspect=this.aspect||1;else{this.camera.left=-this.span*(this.aspect||1)/2;this.camera.right=-this.camera.left;this.camera.top=this.span/2;this.camera.bottom=-this.camera.top;}this.camera.updateProjectionMatrix();}
  render(){if(!this.renderer)return;this.renderer.render(this.scene,this.camera);this.renderCube();this.positionLabels();const box=this.bounds();this.$('viewer-dimensions').textContent=this.guides.box&&!box.isEmpty()?`X ${fmt(box.max.x-box.min.x)} × Y ${fmt(box.max.y-box.min.y)} × Z ${fmt(box.max.z-box.min.z)} ${this.settings.units}`:'';this.$('projection-label').textContent=`${this.projection.toUpperCase()} · ${this.settings.units}`;}
  fit(){const box=this.bounds();if(box.isEmpty())return;const target=box.getCenter(new THREE.Vector3()),radius=this.radius();let dir=this.camera.position.clone().sub(this.controls.target).normalize();if(!dir.lengthSq())dir.set(1,-1,1).normalize();const halfFov=THREE.MathUtils.degToRad(21),angle=Math.min(halfFov,Math.atan(Math.tan(halfFov)*(this.aspect||1))),distance=radius/Math.sin(angle)*1.15;this.span=radius*2.3/Math.min(1,this.aspect||1);this.camera.zoom=1;this.camera.near=Math.max(radius/100000,1e-7);this.camera.far=Math.max(distance*100,radius*100);this.camera.position.copy(target).addScaledVector(dir,distance);this.controls.target.copy(target);this.updateCamera();this.controls.update();this.render();}
  standardView(name){const dir=DIRECTIONS[name];if(dir)this.setDirection(new THREE.Vector3(...dir));this.$('standard-view').value=name;}
  setDirection(dir){dir.normalize();this.camera.up.set(0,0,1);if(Math.abs(dir.z)>.999)this.camera.up.set(0,1,0);const target=this.controls.target.clone(),distance=Math.max(this.camera.position.distanceTo(target),this.radius()*2);this.camera.position.copy(target).addScaledVector(dir,distance);this.rebindControls(target);this.fit();this.render();}
  reset(){this.standardView('Isometric');}
  setProjection(mode){if(mode===this.projection)return;const old=this.camera,direction=old.position.clone().sub(this.controls.target).normalize(),distance=old.position.distanceTo(this.controls.target);if(mode==='orthographic'){this.span=2*distance*Math.tan(THREE.MathUtils.degToRad(21));this.camera=new THREE.OrthographicCamera(-1,1,1,-1,old.near,old.far);this.camera.position.copy(old.position);}else{const d=this.span/old.zoom/(2*Math.tan(THREE.MathUtils.degToRad(21)));this.camera=new THREE.PerspectiveCamera(42,this.aspect,old.near,Math.max(old.far,d*100));this.camera.position.copy(this.controls.target).addScaledVector(direction,d);}this.camera.up.copy(old.up);this.projection=mode;this.$('projection-select').value=mode;this.updateCamera();this.rebindControls();this.render();}
  setDisplay(mode){this.display=mode;for(const l of this.layers.values()){l.material.uniforms.displayMode.value=['solid','wireframe','edges'].indexOf(mode);for(const child of l.mesh.children)if(child.userData.role==='edges')child.visible=mode!=='solid';}this.render();}
  setOpacity(id,alpha){const l=this.layers.get(id);if(!l)return;l.material.uniforms.opacity.value=alpha;l.material.transparent=alpha<1;l.material.depthWrite=alpha>=1;l.material.needsUpdate=true;for(const child of l.mesh.children){child.material.transparent=alpha<1;child.material.depthWrite=alpha>=1;child.material.needsUpdate=true;}this.render();}
  setActiveLayer(id){if(this.activeLayer!==id){this.pending=[];this.redrawMeasurements();}this.activeLayer=id;this.$('measurement-layer').value=id;this.onLayerSelected(id,this.layers.get(id));this.measureStatus();}
  refreshLayers(){const host=this.$('layer-controls');host.replaceChildren();for(const id of new Set(['source','result',...this.layers.keys()])){const l=this.layers.get(id),row=document.createElement('fieldset');this.settings[id+'Color'] ||= this.settings.sourceColor;row.innerHTML=`<legend>${id==='source'?'Source geometry':id==='result'?'Generated result':'Reference geometry'}</legend><label><input type="checkbox" data-layer-visible="${id}" ${l?.mesh.visible?'checked':''} ${!l?'disabled':''}> Visible</label><label>Opacity <input type="range" data-layer-opacity="${id}" min="0" max="1" step="0.05" value="${l?.material.uniforms.opacity.value??1}" ${!l?'disabled':''}></label><label>Colour <input type="color" data-layer-color="${id}" value="${this.settings[id+'Color']}"></label><button class="button" data-layer-active="${id}" ${!l?'disabled':''}>Make active</button>`;const note=document.createElement('small');note.textContent=l?`${l.path.split(/[\\/]/).pop()} · ${l.mode==='quick'?'Quick Preview':'Full detail'} · ${l.metadata?`${l.metadata.nodeCount.toLocaleString()} nodes · ${l.metadata.elementCount.toLocaleString()} elements`:l.shown.toLocaleString()+' triangles'}`:'Not loaded';row.append(note);host.append(row);}
    host.querySelectorAll('[data-layer-visible]').forEach(el=>el.onchange=()=>{this.layers.get(el.dataset.layerVisible).mesh.visible=el.checked;this.pending=[];this.refreshHelpers();this.updateSection();this.redrawMeasurements();this.measureStatus();this.render();this.onLayersChanged();});
    host.querySelectorAll('[data-layer-opacity]').forEach(el=>el.oninput=()=>this.setOpacity(el.dataset.layerOpacity,Number(el.value)));
    host.querySelectorAll('[data-layer-color]').forEach(el=>el.oninput=()=>{const id=el.dataset.layerColor;this.settings[id+'Color']=el.value;this.layers.get(id)?.material.uniforms.tint.value.set(el.value);this.persist();this.render();});
    host.querySelectorAll('[data-layer-active]').forEach(el=>el.onclick=()=>this.setActiveLayer(el.dataset.layerActive));
    const select=this.$('measurement-layer');select.replaceChildren();for(const id of new Set(['source','result',...this.layers.keys()])){const option=document.createElement('option');option.value=id;option.textContent=id==='source'?'Source':id==='result'?'Result':this.layers.get(id).path.split(/[\\/]/).pop();select.append(option);}select.value=this.activeLayer;
    this.measureStatus();this.onLayersChanged();
  }
  applyNavigation(){const actions={rotate:THREE.MOUSE.ROTATE,pan:THREE.MOUSE.PAN,zoom:THREE.MOUSE.DOLLY},mode=this.$('navigation-mode').value;this.controls.mouseButtons.LEFT=actions[mode]??THREE.MOUSE.ROTATE;this.controls.mouseButtons.MIDDLE=THREE.MOUSE.DOLLY;this.controls.mouseButtons.RIGHT=actions[this.settings.right];this.controls.rotateSpeed=this.controls.panSpeed=this.settings.sensitivity;this.controls.zoomSpeed=this.settings.sensitivity*(this.settings.invertZoom?-1:1);}
  updateSectionNormal(){const axis=this.$('section-axis').value,n=axis==='Custom'?[0,1,2].map(i=>Number(this.$(`section-normal-${i}`).value)):axis==='X'?[1,0,0]:axis==='Y'?[0,1,0]:[0,0,1];if(!n.every(Number.isFinite)||!Math.hypot(...n)){this.toast('The section normal must contain a nonzero direction.');return;}this.section.normal=n;this.updateSection();}
  updateSection(){const box=this.bounds(false),n=new THREE.Vector3(...this.section.normal).normalize();let min=Infinity,max=-Infinity;if(!box.isEmpty())for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){const d=n.dot(new THREE.Vector3(x,y,z));min=Math.min(min,d);max=Math.max(max,d);}if(!Number.isFinite(min)){min=-1;max=1;}const offset=min+(max-min)*this.section.fraction,sign=this.section.flip?-1:1;this.plane.set(n.x*sign,n.y*sign,n.z*sign,-offset*sign);for(const l of this.layers.values())l.material.uniforms.sectionOn.value=this.section.enabled;this.$('section-readout').textContent=`Plane offset ${fmt(offset+n.dot(this.origin))} ${this.settings.units}`;this.render();}
  createCube(){
    const canvas=this.$('orientation-cube');this.cubeRenderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true});this.cubeRenderer.setSize(116,116,false);this.cubeScene=new THREE.Scene();this.cubeCamera=new THREE.PerspectiveCamera(32,1,.1,20);
    const names=['Right','Left','Back','Front','Top','Bottom'];this.cube=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),names.map(name=>{const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d');ctx.fillStyle='#e1e9f1';ctx.fillRect(0,0,128,128);ctx.strokeStyle='#61788f';ctx.lineWidth=6;ctx.strokeRect(3,3,122,122);ctx.fillStyle='#20394e';ctx.font='bold 22px Segoe UI';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(name.toUpperCase(),64,64);return new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c)});}));this.cubeScene.add(this.cube);
    canvas.onclick=e=>{const rect=canvas.getBoundingClientRect(),ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),this.cubeCamera);const hit=ray.intersectObject(this.cube)[0];if(hit){const p=hit.point,dir=new THREE.Vector3(...p.toArray().map(v=>Math.abs(v)>.32?Math.sign(v):0));if(dir.lengthSq()){this.$('standard-view').value='';this.setDirection(dir);}}};canvas.title='Click a face, edge, or corner to orient the model';
  }
  renderCube(){if(!this.cubeRenderer)return;this.cubeCamera.up.copy(this.camera.up);this.cubeCamera.position.copy(this.camera.position).sub(this.controls.target).normalize().multiplyScalar(3.5);this.cubeCamera.lookAt(0,0,0);this.cubeRenderer.render(this.cubeScene,this.cubeCamera);}
  setMeasureMode(mode){this.measureMode=mode;this.$('measurement-mode').value=mode;this.pending=[];this.applyNavigation();this.measureStatus();this.redrawMeasurements();}
  measureStatus(){const l=this.layers.get(this.activeLayer),status=this.$('measurement-status');if(!status)return;if(!l)status.textContent='Load the selected model first.';else if(l.mode==='quick')status.textContent='Measurements are unavailable on sampled Quick Preview. Load full detail for this model.';else if(!l.mesh.visible)status.textContent='Show the selected model to measure it.';else status.textContent=this.measureMode==='off'?'Select Distance or Angle to begin.':`Click ${this.measureMode==='angle'?3:2} points on ${this.activeLayer}. ${this.pending.length} selected. Drag to navigate; Esc to finish.`;}
  pick(event){if(this.measureMode==='off')return;const l=this.layers.get(this.activeLayer);if(!l||l.mode==='quick'||!l.mesh.visible||l.material.uniforms.opacity.value===0){this.measureStatus();this.toast('Select visible full-detail geometry for measurement.');return;}
    const rect=this.canvas.getBoundingClientRect(),ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1),this.camera);ray.params.Line.threshold=this.radius()*.008;const hit=ray.intersectObject(l.mesh,true).find(h=>h.object.userData.role!=='edges'&&(!this.section.enabled||this.plane.x*h.point.x+this.plane.y*h.point.y+this.plane.z*h.point.z+this.plane.w>=-1e-7));if(!hit)return;
    let point=hit.point.clone();if(this.$('measurement-snap').checked&&hit.face){const attr=l.geometry.getAttribute('position'),vertices=[hit.face.a,hit.face.b,hit.face.c].map(i=>l.mesh.localToWorld(new THREE.Vector3().fromBufferAttribute(attr,i)));vertices.sort((a,b)=>a.distanceToSquared(point)-b.distanceToSquared(point));point=vertices.find(p=>!this.section.enabled||this.plane.x*p.x+this.plane.y*p.y+this.plane.z*p.z+this.plane.w>=-1e-7)||point;}
    if(this.$('measurement-snap').checked&&hit.object.isLineSegments){const attr=hit.object.geometry.getAttribute('position'),index=hit.index;const points=[index,index+1].map(i=>hit.object.localToWorld(new THREE.Vector3().fromBufferAttribute(attr,i)));points.sort((a,b)=>a.distanceToSquared(point)-b.distanceToSquared(point));point=points.find(p=>!this.section.enabled||this.plane.x*p.x+this.plane.y*p.y+this.plane.z*p.z+this.plane.w>=-1e-7)||point;}
    if(this.pending.length&&point.distanceTo(this.pending.at(-1))<this.radius()*1e-10){this.toast('Choose a different point.');return;}this.pending.push(point);
    if(this.pending.length===(this.measureMode==='angle'?3:2)){const pts=this.pending;const value=this.measureMode==='distance'?pts[0].distanceTo(pts[1]):THREE.MathUtils.radToDeg(pts[0].clone().sub(pts[1]).angleTo(pts[2].clone().sub(pts[1])));this.measurements.push({type:this.measureMode,points:pts.map(p=>p.clone()),value,layer:this.activeLayer});this.pending=[];}this.measureStatus();this.redrawMeasurements();
  }
  measurementText(m){return `${m.type==='angle'?'Angle':'Distance'}: ${fmt(m.value)} ${m.type==='angle'?'°':this.settings.units}`;}
  redrawMeasurements(){for(const obj of [...this.measureGroup.children]){obj.geometry?.dispose();obj.material?.dispose();this.measureGroup.remove(obj);}this.labelHost.replaceChildren();this.labels=[];
    for(const m of [...this.measurements,{points:this.pending,layer:this.activeLayer}]){if(!this.layers.get(m.layer)?.mesh.visible)continue;const points=m.points;if(!points.length)continue;const geometry=new THREE.BufferGeometry().setFromPoints(points),line=new THREE.Line(geometry,new THREE.LineBasicMaterial({color:0xffd35e,depthTest:false}));line.renderOrder=100;this.measureGroup.add(line);const markers=new THREE.Points(geometry.clone(),new THREE.PointsMaterial({color:0xffd35e,size:8,sizeAttenuation:false,depthTest:false}));markers.renderOrder=101;this.measureGroup.add(markers);if(m.type){const label=document.createElement('span');label.textContent=this.measurementText(m);this.labelHost.append(label);const position=m.type==='angle'?points[1]:points[0].clone().lerp(points[1],.5);this.labels.push({label,position});}}
    this.render();
  }
  positionLabels(){const rect=this.canvas.getBoundingClientRect(),placed=[];for(const {label,position} of this.labels||[]){const p=position.clone().project(this.camera);label.hidden=p.z>1||p.z< -1||Math.abs(p.x)>1||Math.abs(p.y)>1;let x=(p.x+1)*rect.width/2,y=(1-p.y)*rect.height/2;const w=label.offsetWidth||150,h=label.offsetHeight||24;x=Math.max(w/2+4,Math.min(rect.width-w/2-4,x));for(let i=0;i<20&&placed.some(q=>Math.abs(q.x-x)<(q.w+w)/2&&Math.abs(q.y-y)<h+5);i++)y-=h+5;y=Math.max(h*1.4,y);placed.push({x,y,w});label.style.left=`${x}px`;label.style.top=`${y}px`;}}
  snapshot(){return {position:this.camera.position.toArray(),target:this.controls.target.toArray(),up:this.camera.up.toArray(),origin:this.origin.toArray(),projection:this.projection,span:this.span,zoom:this.camera.zoom,near:this.camera.near,far:this.camera.far};}
  saveCamera(){const name=this.$('saved-view-name').value.trim();if(!name){this.toast('Enter a name for this view.');return;}const view={name,...this.snapshot()},index=this.savedViews.findIndex(v=>v.name===name);if(index>=0)this.savedViews[index]=view;else this.savedViews.push(view);this.storeViews();this.refreshSavedViews();this.$('saved-view-list').value=name;this.toast('Camera view saved.');}
  storeViews(){try{localStorage.setItem('artisan.viewer.views',JSON.stringify(this.savedViews));}catch{this.toast('Saved views could not be stored.');}}
  refreshSavedViews(){const select=this.$('saved-view-list');select.replaceChildren();for(const v of this.savedViews){const option=document.createElement('option');option.value=option.textContent=v.name;select.append(option);}this.$('restore-camera').disabled=this.$('delete-camera').disabled=!this.savedViews.length;}
  restoreCamera(){const v=this.savedViews.find(v=>v.name===this.$('saved-view-list').value);if(!v)return;this.setProjection(v.projection);const shift=new THREE.Vector3(...v.origin).sub(this.origin);this.camera.position.fromArray(v.position).add(shift);this.camera.up.fromArray(v.up);this.controls.target.fromArray(v.target).add(shift);this.span=v.span;this.camera.zoom=v.zoom;this.camera.near=v.near;this.camera.far=v.far;this.updateCamera();this.rebindControls();this.$('standard-view').value='';this.render();}
  deleteCamera(){this.savedViews=this.savedViews.filter(v=>v.name!==this.$('saved-view-list').value);this.storeViews();this.refreshSavedViews();}
  async saveImage(){const transparent=this.$('image-transparent').checked,annotations=this.$('image-annotations').checked,background=this.scene.background,oldMeasure=this.measureGroup.visible;
    const out=document.createElement('canvas');out.width=this.canvas.width;out.height=this.canvas.height;const ctx=out.getContext('2d');
    try{if(transparent)this.scene.background=null;this.measureGroup.visible=annotations;this.renderer.setClearAlpha(transparent?0:1);this.renderer.render(this.scene,this.camera);ctx.drawImage(this.canvas,0,0);if(annotations){ctx.font=`${Math.max(12,Math.round(out.width/100))}px Segoe UI`;ctx.fillStyle=transparent?'#20394e':'#ffffff';const text=[`${this.projection} · ${this.settings.units}`,this.$('viewer-dimensions').textContent,...this.measurements.filter(m=>this.layers.get(m.layer)?.mesh.visible).map(m=>this.measurementText(m))].filter(Boolean);text.forEach((line,i)=>ctx.fillText(line,18,24+i*22));this.renderCube();ctx.drawImage(this.$('orientation-cube'),out.width-126,10,116,116);}}finally{this.scene.background=background;this.measureGroup.visible=oldMeasure;this.renderer.setClearAlpha(1);this.render();}
    const blob=await new Promise((resolve,reject)=>out.toBlob(b=>b?resolve(b):reject(Error('PNG encoding failed.')),'image/png'));
    if(this.exportImage)await this.exportImage(blob);else{const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='ArtGUI-view.png';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
  }
}

