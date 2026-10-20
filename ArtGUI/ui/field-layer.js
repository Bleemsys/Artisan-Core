import * as THREE from './vendor/three.module.js';
import {sliceGeometry,normalizedValues,colourBytes,modelPoint} from './field-data.js';

export class FieldLayer {
  constructor(viewer,id) {
    this.viewer=viewer;this.id=id;this.group=new THREE.Group();viewer.scene.add(this.group);
    this.tip=document.createElement('div');this.tip.className='field-probe-tip';this.tip.hidden=true;viewer.canvas.parentElement.append(this.tip);
    this.box=new THREE.Box3();viewer.fieldLayers.set(id,this);
  }
  clearObjects(){for(const object of [...this.group.children]){object.geometry?.dispose();object.material?.dispose();this.group.remove(object);}this.texture?.dispose();this.marker=null;this.tip.hidden=true;}
  setSlice(slice,block,style) {
    this.clearObjects();this.slice=slice;this.style=style;const data=sliceGeometry(slice);
    if(!this.viewer.hasOrigin){this.viewer.origin.fromArray(data.center);this.viewer.hasOrigin=true;}
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(data.positions,3));geometry.setAttribute('scalar',new THREE.BufferAttribute(normalizedValues(slice.values,...style.range),1));geometry.setIndex(new THREE.BufferAttribute(data.indices,1));geometry.computeBoundingSphere();
    this.texture=new THREE.DataTexture(colourBytes(style.map),256,1,THREE.RGBAFormat);this.texture.minFilter=this.texture.magFilter=THREE.LinearFilter;this.texture.needsUpdate=true;
    const material=new THREE.ShaderMaterial({side:THREE.DoubleSide,transparent:true,depthWrite:false,uniforms:{lut:{value:this.texture},opacity:{value:style.opacity}},
      vertexShader:'attribute float scalar;varying float vScalar;void main(){vScalar=scalar;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:'uniform sampler2D lut;uniform float opacity;varying float vScalar;void main(){gl_FragColor=vec4(texture2D(lut,vec2(clamp(vScalar,0.,1.),.5)).rgb,opacity);}'});
    this.mesh=new THREE.Mesh(geometry,material);this.mesh.position.fromArray(data.center).sub(this.viewer.origin);this.mesh.renderOrder=10;this.group.add(this.mesh);
    this.inverse=new THREE.Matrix4().fromArray(slice.transform).transpose().invert();
    this.box.makeEmpty();
    if(block.bounds)for(const x of block.bounds[0])for(const y of block.bounds[1])for(const z of block.bounds[2])this.box.expandByPoint(new THREE.Vector3(...modelPoint([x,y,z],slice.transform)).sub(this.viewer.origin));
    else this.box.set(new THREE.Vector3(...data.min).sub(this.viewer.origin),new THREE.Vector3(...data.max).sub(this.viewer.origin));
    const outline=new THREE.Box3Helper(this.box,0x688299);outline.material.opacity=style.opacity;outline.material.transparent=style.opacity<1;outline.material.depthWrite=style.opacity>=1;
    this.group.add(outline);this.group.visible=style.visible;
    this.viewer.refreshHelpers();this.viewer.render();
  }
  setStyle(style) {
    if(!this.mesh)return;
    this.style=style;this.group.visible=style.visible;this.mesh.material.uniforms.opacity.value=style.opacity;
    this.group.traverse(child=>{if(child.material&&!child.material.uniforms){child.material.opacity=style.opacity;child.material.transparent=style.opacity<1;child.material.depthWrite=style.opacity>=1;}});
    this.mesh.geometry.getAttribute('scalar').array.set(normalizedValues(this.slice.values,...style.range));this.mesh.geometry.getAttribute('scalar').needsUpdate=true;
    this.texture.image.data.set(colourBytes(style.map));this.texture.needsUpdate=true;this.viewer.refreshHelpers();this.viewer.render();
  }
  pick(event) {
    if(!this.group.visible||!this.mesh||this.style.opacity===0)return null;
    const rect=this.viewer.canvas.getBoundingClientRect(),ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1),this.viewer.camera);
    const hit=ray.intersectObject(this.mesh)[0];if(!hit)return null;
    const local=hit.point.clone().add(this.viewer.origin).applyMatrix4(this.inverse).toArray();local[this.slice.axis]=this.slice.position;
    return local;
  }
  showProbe(probe,label) {
    if(this.marker){this.group.remove(this.marker);this.marker.geometry.dispose();this.marker.material.dispose();}
    const point=new THREE.Vector3(...probe.modelCoordinates).sub(this.viewer.origin),geometry=new THREE.BufferGeometry().setFromPoints([point]);
    this.marker=new THREE.Points(geometry,new THREE.PointsMaterial({color:0xffffff,size:10,sizeAttenuation:false,depthTest:false,opacity:this.style.opacity,transparent:this.style.opacity<1}));this.marker.renderOrder=100;this.group.add(this.marker);this.tip.textContent=`${label}: ${probe.value??probe.kind} · Stored grid value`;this.probePosition=point;this.viewer.render();
  }
  positionLabel(){if(!this.marker||!this.group.visible||this.style.opacity===0){this.tip.hidden=true;return;}const p=this.probePosition.clone().project(this.viewer.camera),rect=this.viewer.canvas.getBoundingClientRect();this.tip.hidden=p.z< -1||p.z>1||Math.abs(p.x)>1||Math.abs(p.y)>1;this.tip.style.left=`${Math.max(8,Math.min(rect.width-this.tip.offsetWidth-8,(p.x+1)*rect.width/2+14))}px`;this.tip.style.top=`${Math.max(8,(1-p.y)*rect.height/2-30)}px`;}
  dispose(){this.clearObjects();this.viewer.scene.remove(this.group);this.tip.remove();this.viewer.fieldLayers.delete(this.id);this.viewer.refreshHelpers();this.viewer.render();}
}
