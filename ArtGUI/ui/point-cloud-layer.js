import * as THREE from './vendor/three.module.js';
import {normalizedValues,colourBytes} from './field-data.js';
export class PointCloudLayer {
  constructor(viewer,id,data,style){
    this.viewer=viewer;this.maxPointSize=viewer.renderer.getContext().getParameter(viewer.renderer.getContext().ALIASED_POINT_SIZE_RANGE)[1];this.id=id;this.data=data;this.group=new THREE.Group();this.box=new THREE.Box3();
    if(!viewer.hasOrigin){viewer.origin.fromArray(data.center);viewer.hasOrigin=true;}
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(data.positions,3));geometry.setAttribute('scalar',new THREE.BufferAttribute(new Float32Array(data.shown),1));geometry.computeBoundingSphere();
    this.texture=new THREE.DataTexture(colourBytes(style.map),256,1,THREE.RGBAFormat);this.texture.minFilter=this.texture.magFilter=THREE.LinearFilter;this.texture.needsUpdate=true;
    const material=new THREE.ShaderMaterial({uniforms:{lut:{value:this.texture},pointSize:{value:style.size},sectionOn:{value:viewer.section.enabled},sectionPlane:{value:viewer.plane},solid:{value:false},opacity:{value:style.opacity??1}},
      vertexShader:'attribute float scalar;uniform float pointSize;varying float vScalar;varying vec3 vWorld;void main(){vScalar=scalar;vWorld=(modelMatrix*vec4(position,1.)).xyz;gl_PointSize=pointSize;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:'uniform sampler2D lut;uniform float opacity;uniform bool solid;uniform bool sectionOn;uniform vec4 sectionPlane;varying float vScalar;varying vec3 vWorld;void main(){if(length(gl_PointCoord-vec2(.5))>.5)discard;if(sectionOn&&dot(vec4(vWorld,1.),sectionPlane)<0.)discard;vec3 c=solid?vec3(.27,.58,.9):vScalar<0.?vec3(.6):texture2D(lut,vec2(clamp(vScalar,0.,1.),.5)).rgb;gl_FragColor=vec4(c,opacity);}'});
    this.points=new THREE.Points(geometry,material);this.points.position.fromArray(data.center).sub(viewer.origin);this.group.add(this.points);
    this.box.set(new THREE.Vector3(...data.bounds[0]).sub(viewer.origin),new THREE.Vector3(...data.bounds[1]).sub(viewer.origin));
    this.tip=document.createElement('div');this.tip.className='point-cloud-tip';this.tip.hidden=true;viewer.canvas.parentElement.append(this.tip);
    this.setStyle(style,false);
    try{viewer.validateUpload(this.group);}catch(error){this.dispose();throw error;}
    viewer.fieldLayers.set(id,this);viewer.scene.add(this.group);viewer.refreshHelpers();viewer.render();
  }
  setStyle(style,render=true){
    this.style=style;this.group.visible=style.visible;
    const material=this.points.material,opacity=style.opacity??1;
    material.uniforms.opacity.value=opacity;material.transparent=opacity<1;material.depthWrite=opacity>=1;material.needsUpdate=true;
    if(this.marker){this.marker.material.opacity=opacity;this.marker.material.transparent=opacity<1;}

    if(this.rangeMinimum!==style.range[0]||this.rangeMaximum!==style.range[1]){
      const values=normalizedValues(this.data.values,...style.range);for(let i=0;i<values.length;i++)if(!Number.isFinite(this.data.values[i]))values[i]=-1;
      this.points.geometry.attributes.scalar.array.set(values);this.points.geometry.attributes.scalar.needsUpdate=true;this.rangeMinimum=style.range[0];this.rangeMaximum=style.range[1];
    }
    if(this.lastMap!==style.map){this.texture.image.data.set(colourBytes(style.map));this.texture.needsUpdate=true;this.lastMap=style.map;}this.points.material.uniforms.solid.value=style.solid;
    this.prepare();if(render){this.viewer.refreshHelpers();this.viewer.render();}
  }
  prepare(){this.points.material.uniforms.sectionOn.value=this.viewer.section.enabled;this.points.material.uniforms.pointSize.value=Math.min(this.style.size*(this.viewer.renderer.getPixelRatio?.()||1),this.maxPointSize);}
  pick(event){
    if(!this.group.visible||(this.style.opacity??1)===0)return null;
    const v=this.viewer,rect=v.canvas.getBoundingClientRect(),ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1),v.camera);
    ray.params.Points.threshold=v.radius()*.012;
    const hits=ray.intersectObject(this.points),plane=v.plane;
    const hit=hits.find(h=>{const point=new THREE.Vector3(...this.data.coordinates.subarray(h.index*3,h.index*3+3)).sub(v.origin);if(v.section.enabled&&plane.x*point.x+plane.y*point.y+plane.z*point.z+plane.w<0)return false;const screen=point.project(v.camera);return Math.hypot((screen.x+1)*rect.width/2-(event.clientX-rect.left),(1-screen.y)*rect.height/2-(event.clientY-rect.top))<=Math.max(6,this.style.size);});if(!hit)return null;
    const i=hit.index;return {index:i,row:this.data.rows[i],coordinates:Array.from(this.data.coordinates.subarray(i*3,i*3+3)),value:this.data.values[i]};
  }
  showProbe(probe,label){
    this.probe=probe;
    if(this.marker){this.group.remove(this.marker);this.marker.geometry.dispose();this.marker.material.dispose();}
    const position=new THREE.Vector3(...probe.coordinates).sub(this.viewer.origin),geometry=new THREE.BufferGeometry().setFromPoints([position]);
    this.marker=new THREE.Points(geometry,new THREE.PointsMaterial({color:0xffffff,size:9,sizeAttenuation:false,depthTest:false,opacity:this.style.opacity??1,transparent:(this.style.opacity??1)<1}));this.marker.renderOrder=100;this.group.add(this.marker);this.tip.replaceChildren();const row=document.createElement('strong');row.textContent=`Data row ${probe.row.toLocaleString()}`;this.tip.append(row);
    const val=document.createElement('span');val.textContent=`${label}: ${Number.isFinite(probe.value)?Number(probe.value.toPrecision(8)):'Missing value'}`;if(label)this.tip.append(val);
    const coords=document.createElement('small');coords.textContent=probe.coordinates.map((n,i)=>`${'XYZ'[i]} ${Number(n.toPrecision(7))}`).join(' · ');this.tip.append(coords);this.viewer.render();
  }
  positionLabel(){
    if(!this.probe||!this.group.visible||(this.style.opacity??1)===0){this.tip.hidden=true;return;}
    const world=new THREE.Vector3(...this.probe.coordinates).sub(this.viewer.origin),plane=this.viewer.plane;
    const p=world.clone().project(this.viewer.camera),rect=this.viewer.canvas.getBoundingClientRect();this.tip.hidden=p.z< -1||p.z>1||Math.abs(p.x)>1||Math.abs(p.y)>1||(this.viewer.section.enabled&&plane.x*world.x+plane.y*world.y+plane.z*world.z+plane.w<0);
    this.tip.style.left=`${Math.max(8,Math.min(rect.width-this.tip.offsetWidth-8,(p.x+1)*rect.width/2+14))}px`;this.tip.style.top=`${Math.max(8,Math.min(rect.height-this.tip.offsetHeight-8,(1-p.y)*rect.height/2-42))}px`;
  }
  dispose(){this.group?.traverse(obj=>{obj.geometry?.dispose();obj.material?.dispose();});this.texture?.dispose();this.tip?.remove();this.viewer.scene.remove(this.group);if(this.viewer.fieldLayers.get(this.id)===this)this.viewer.fieldLayers.delete(this.id);this.data=null;this.viewer.refreshHelpers();this.viewer.render();}
}
