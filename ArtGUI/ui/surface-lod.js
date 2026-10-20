import * as THREE from './vendor/three.module.js';

// Kept as named exports so the exact production shaders can be checked offscreen.
export const SURFACE_VERTEX_SHADER = `
attribute float radius;
attribute float nodeId;
uniform sampler2D uNodeVisibility;
uniform vec2 uVisibilitySize;
uniform float uViewportHeight;
uniform float uMaxPointSize;
uniform float uNear;
uniform bool uOrthographic;
varying vec3 vCenterView;
varying vec3 vNormalView;
varying float vRadius;
void main(){
  vec2 address=(vec2(mod(nodeId,uVisibilitySize.x),floor(nodeId/uVisibilitySize.x))+.5)/uVisibilitySize;
  if(nodeId<0.||texture2D(uNodeVisibility,address).r<.5){gl_Position=vec4(2.,2.,2.,1.);gl_PointSize=0.;return;}
  vec4 center=modelViewMatrix*vec4(position,1.);
  float projectionScale=.5*uViewportHeight*projectionMatrix[1][1];
  float distanceScale=uOrthographic?1.:max(-center.z,uNear);
  float diameter=2.*radius*projectionScale/distanceScale;
  gl_PointSize=clamp(diameter,1.5,uMaxPointSize);
  vRadius=radius*gl_PointSize/max(diameter,.00001);
  vCenterView=center.xyz;
  vNormalView=normalMatrix*normal;
  gl_Position=projectionMatrix*center;
}`;

export const SURFACE_FRAGMENT_SHADER = `
uniform vec3 tint;
uniform float opacity;
uniform bool sectionOn;
uniform vec4 sectionPlane;
uniform mat4 uCameraWorld;
uniform mat4 projectionMatrix;
uniform sampler2D uExactCells;
uniform bool uHasExactCells;
uniform vec3 uModelMin;
uniform vec3 uModelSize;
varying vec3 vCenterView;
varying vec3 vNormalView;
varying float vRadius;
// A detailed cell owns its viewing rays too: coarse samples behind its holes
// must not paint over the original struts. Traversal is bounded by a 16^3 grid.
bool detailedRay(vec3 originWorld,vec3 surfaceWorld){
  vec3 size=max(uModelSize,vec3(.000001));
  vec3 origin=(originWorld-uModelMin)/size;
  vec3 direction=(surfaceWorld-originWorld)/size;
  vec3 safe=vec3(direction.x<0.?min(direction.x,-.00000001):max(direction.x,.00000001),direction.y<0.?min(direction.y,-.00000001):max(direction.y,.00000001),direction.z<0.?min(direction.z,-.00000001):max(direction.z,.00000001));
  vec3 t0=-origin/safe,t1=(vec3(1.)-origin)/safe;
  vec3 lo=min(t0,t1),hi=max(t0,t1);
  float entry=max(0.,max(lo.x,max(lo.y,lo.z))),end=min(1.,min(hi.x,min(hi.y,hi.z)));
  if(entry>end)return false;
  vec3 step=sign(safe),cell=floor(clamp((origin+safe*entry)*16.+step*.00001,vec3(0.),vec3(15.99999)));
  vec3 boundary=(cell+max(step,vec3(0.)))/16.;
  vec3 next=(boundary-origin)/safe,delta=abs(vec3(1.)/(safe*16.));
  for(int i=0;i<49;i++){
    float id=cell.x*256.+cell.y*16.+cell.z;
    if(texture2D(uExactCells,(vec2(mod(id,64.),floor(id/64.))+.5)/64.).r>.5)return true;
    float at=min(next.x,min(next.y,next.z));
    if(at>end)break;
    vec3 advance=vec3(lessThanEqual(next,vec3(at+.0000001)));
    cell+=advance*step;next+=advance*delta;
    if(any(lessThan(cell,vec3(0.)))||any(greaterThan(cell,vec3(15.))))break;
  }
  return false;
}
void main(){
  vec2 uv=vec2(gl_PointCoord.x*2.-1.,1.-gl_PointCoord.y*2.);
  float d=dot(uv,uv);
  if(d>1.)discard;
  vec3 surfaceView=vCenterView+vec3(uv,sqrt(max(0.,1.-d)))*vRadius;
  vec4 projected=projectionMatrix*vec4(surfaceView,1.);
  float depth=projected.z/projected.w*.5+.5;
  if(depth<0.||depth>1.)discard;
  vec3 surfaceWorld=(uCameraWorld*vec4(surfaceView,1.)).xyz;
  if(sectionOn&&dot(vec4(surfaceWorld,1.),sectionPlane)<0.)discard;
  vec3 rayOrigin=(uCameraWorld*vec4(projectionMatrix[3][3]>.5?surfaceView.xy:vec2(0.),0.,1.)).xyz;
  // Include the sample's full radius, since its front can extend outside its cell.
  if(uHasExactCells&&detailedRay(rayOrigin,surfaceWorld+normalize(surfaceWorld-rayOrigin)*vRadius*2.))discard;
  gl_FragDepth=depth;
  vec3 n=length(vNormalView)>.00001?normalize(vNormalView):vec3(0.,0.,1.);
  float light=.35+.65*abs(dot(n,normalize(vec3(.4,.8,.6))));
  gl_FragColor=vec4(tint*light,opacity);
}`;

export function decodeSurfaceNode(bytes, expectedCount) {
  const view = bytes instanceof ArrayBuffer ? new DataView(bytes)
    : ArrayBuffer.isView(bytes) ? new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength) : null;
  if (!view || expectedCount < 1 || expectedCount > 512 || view.byteLength !== expectedCount * 28) throw Error('Invalid overview block size.');
  const positions=new Float32Array(expectedCount*3),normals=new Float32Array(expectedCount*3),radii=new Float32Array(expectedCount);
  for(let i=0;i<expectedCount;i++){
    for(let a=0;a<3;a++){
      positions[i*3+a]=view.getFloat32(i*28+a*4,true);
      normals[i*3+a]=view.getFloat32(i*28+12+a*4,true);
      if(!Number.isFinite(positions[i*3+a])||!Number.isFinite(normals[i*3+a]))throw Error('Invalid overview coordinates.');
    }
    radii[i]=view.getFloat32(i*28+24,true);
    if(!Number.isFinite(radii[i])||radii[i]<=0)throw Error('Invalid overview sample radius.');
  }
  return {positions,normals,radii};
}

export function createSurfaceMaterial(base,viewer){
  const gl=viewer.renderer?.getContext?.();
  const max=gl?Math.min(256,gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE)[1]):256;
  const material=new THREE.ShaderMaterial({
    uniforms:{...base.uniforms,uViewportHeight:{value:800},uMaxPointSize:{value:max},uNear:{value:.001},uOrthographic:{value:false},uCameraWorld:{value:viewer.camera.matrixWorld},uNodeVisibility:{value:null},uVisibilitySize:{value:new THREE.Vector2(1,1)},uExactCells:{value:null},uHasExactCells:{value:false},uModelMin:{value:new THREE.Vector3()},uModelSize:{value:new THREE.Vector3(1,1,1)}},
    vertexShader:SURFACE_VERTEX_SHADER,fragmentShader:SURFACE_FRAGMENT_SHADER,depthWrite:true,depthTest:true,
    transparent:base.uniforms.opacity.value<1
  });
  syncSurfaceMaterial(material,viewer);return material;
}

export function syncSurfaceMaterial(material,viewer){
  viewer.camera.updateMatrixWorld();
  material.uniforms.uViewportHeight.value=viewer.canvas.height||viewer.canvas.clientHeight||800;
  material.uniforms.uNear.value=viewer.camera.near;
  material.uniforms.uOrthographic.value=Boolean(viewer.camera.isOrthographicCamera);
  material.uniforms.uCameraWorld.value=viewer.camera.matrixWorld;
}

export function createSurfaceNode(data,material){
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(data.positions,3));
  geometry.setAttribute('normal',new THREE.BufferAttribute(data.normals,3));
  geometry.setAttribute('radius',new THREE.BufferAttribute(data.radii,1));
  // Radius-aware native bounds drive culling. Point centers alone omit silhouette splats.
  const points=new THREE.Points(geometry,material);points.frustumCulled=false;
  points.userData.role='preview-surface';return points;
}

// One GPU batch per model keeps a large octree from becoming thousands of draw calls.
// Fixed slots bound memory; node visibility lives in a tiny nearest-filtered texture.
export function createSurfacePool(base,viewer,info,bounds){
  const capacity=Math.min(2048,info.nodes.length),stride=8,perNode=512;
  const packed=new Float32Array(capacity*perNode*stride);
  for(let i=7;i<packed.length;i+=stride)packed[i]=-1;
  const buffer=new THREE.InterleavedBuffer(packed,stride).setUsage(THREE.DynamicDrawUsage);
  const geometry=new THREE.BufferGeometry();
  for(const [name,size,offset] of [['position',3,0],['normal',3,3],['radius',1,6],['nodeId',1,7]])geometry.setAttribute(name,new THREE.InterleavedBufferAttribute(buffer,size,offset));
  geometry.setDrawRange(0,0);
  const material=createSurfaceMaterial(base,viewer);
  const flags=new Uint8Array(64*Math.ceil(info.nodes.length/64)*4),exact=new Uint8Array(64*64*4);
  const visibilityTexture=new THREE.DataTexture(flags,64,Math.ceil(info.nodes.length/64),THREE.RGBAFormat,THREE.UnsignedByteType);
  const exactTexture=new THREE.DataTexture(exact,64,64,THREE.RGBAFormat,THREE.UnsignedByteType);
  for(const texture of [visibilityTexture,exactTexture]){texture.minFilter=THREE.NearestFilter;texture.magFilter=THREE.NearestFilter;texture.generateMipmaps=false;texture.needsUpdate=true;}
  material.uniforms.uNodeVisibility.value=visibilityTexture;material.uniforms.uVisibilitySize.value.set(64,Math.ceil(info.nodes.length/64));material.uniforms.uExactCells.value=exactTexture;
  material.uniforms.uModelMin.value.copy(bounds.min);material.uniforms.uModelSize.value.copy(bounds.max).sub(bounds.min);
  const object=new THREE.Points(geometry,material);object.frustumCulled=false;object.userData.role='preview-surface';
  const slots=new Map(),used=new Set(),free=Array.from({length:capacity},(_,i)=>capacity-1-i);let high=0,visibleKey='';
  function mark(slot){buffer.addUpdateRange(slot*perNode*stride,perNode*stride);buffer.needsUpdate=true;}
  function add(id,data){
    if(slots.has(id))return;
    const slot=free.pop();if(slot===undefined)throw Error('Overview memory budget is full.');
    const at=slot*perNode*stride;
    for(let i=0;i<data.radii.length;i++){
      const p=at+i*stride;
      packed[p]=data.positions[i*3];packed[p+1]=data.positions[i*3+1];packed[p+2]=data.positions[i*3+2];
      packed[p+3]=data.normals[i*3];packed[p+4]=data.normals[i*3+1];packed[p+5]=data.normals[i*3+2];packed[p+6]=data.radii[i];packed[p+7]=id;
    }
    slots.set(id,slot);used.add(slot);high=Math.max(high,slot+1);geometry.setDrawRange(0,high*perNode);mark(slot);
  }
  function remove(id){
    const slot=slots.get(id);if(slot===undefined)return;
    for(let i=0;i<perNode;i++)packed[(slot*perNode+i)*stride+7]=-1;
    slots.delete(id);used.delete(slot);free.push(slot);flags[id*4]=0;visibilityTexture.needsUpdate=true;mark(slot);
    while(high&&!used.has(high-1))high--;
    geometry.setDrawRange(0,high*perNode);
  }
  function show(ids){
    const key=ids.join(',');if(key===visibleKey)return;visibleKey=key;
    flags.fill(0);for(const id of ids)flags[id*4]=255;visibilityTexture.needsUpdate=true;
  }
  function exactCells(ids){exact.fill(0);for(const id of ids)exact[id*4]=255;material.uniforms.uHasExactCells.value=ids.length>0;exactTexture.needsUpdate=true;}
  function dispose(){object.parent?.remove(object);geometry.dispose();material.dispose();visibilityTexture.dispose();exactTexture.dispose();slots.clear();}
  return {object,material,capacity,slots,add,remove,show,exactCells,dispose,bytes:packed.byteLength+flags.byteLength+exact.byteLength};
}
