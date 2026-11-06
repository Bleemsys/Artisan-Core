import * as THREE from './vendor/three.module.js';
import {nearestGridValue} from './tpms-cell-model.js';

export const DEFAULT_VOLUME_SETTINGS=Object.freeze({opacity:6,region:'near-zero',band:.02,smooth:true,clipEnabled:false,clipAxis:'z',clipPosition:.7,clipSide:'lower'});

// Store a scaled scalar field rather than colours. Scaling avoids overflow
// during interpolation and leaves transfer functions adjustable on the GPU.
export function normalizedVolumeData(grid){
 const range=Math.max(Math.abs(grid.min),Math.abs(grid.max))||1;
 return {range,data:Float32Array.from(grid.values,v=>v/range)};
}
export function volumeBounds(extent,settings){
 const min=[0,0,0],max=[extent,extent,extent];
 if(settings.clipEnabled){const axis=['x','y','z'].indexOf(settings.clipAxis),cut=Math.max(0,Math.min(1,settings.clipPosition))*extent;if(settings.clipSide==='upper')min[axis]=cut;else max[axis]=cut;}
 return {min,max};
}
export function volumeRayInterval(origin,direction,bounds){
 let near=0,far=Infinity;
 for(let a=0;a<3;a++){
  if(bounds.max[a]<=bounds.min[a])return null;
  if(Math.abs(direction[a])<1e-12){if(origin[a]<bounds.min[a]||origin[a]>bounds.max[a])return null;continue;}
  const t0=(bounds.min[a]-origin[a])/direction[a],t1=(bounds.max[a]-origin[a])/direction[a];near=Math.max(near,Math.min(t0,t1));far=Math.min(far,Math.max(t0,t1));
 }
 return far>near&&Number.isFinite(far)?[near,far]:null;
}
export function volumeRegionContains(value,settings){
 return settings.region==='near-zero'?Math.abs(value)<=settings.band:settings.region==='negative'?value<0:settings.region==='positive'?value>0:true;
}
function localPosition(position,extent){return position.map(v=>extent>1?Math.max(0,v-Math.floor(v)):Math.max(0,Math.min(1,v)));}

// Probe a stored sample at the first contributing location along the ray.
// It deliberately does not assign one scalar value to a composited pixel.
export function probeVolume(grid,origin,direction,settings,extent=1){
 const interval=volumeRayInterval(origin,direction,volumeBounds(extent,settings));if(!interval)return null;
 const [near,far]=interval,count=Math.min(384,Math.max(1,Math.ceil((far-near)*grid.resolution*2))),range=Math.max(Math.abs(grid.min),Math.abs(grid.max))||1;
 for(let i=0;i<count;i++){
  const distance=near+(i+.5)*(far-near)/count,world=origin.map((v,a)=>v+direction[a]*distance),sample=nearestGridValue(grid,localPosition(world,extent));
  if(volumeRegionContains(sample.value/range,settings))return{kind:'volume',...sample};
 }
 return null;
}

const vertexShader=`
varying vec3 vBack;
varying vec3 vDirection;
void main(){
 vBack=position;
 // The editor uses an orthographic camera: all viewing rays are parallel.
 vDirection=(inverse(modelViewMatrix)*vec4(0.0,0.0,-1.0,0.0)).xyz;
 gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
}`;
const fragmentShader=`
precision highp sampler3D;
uniform sampler3D uField;
uniform float uResolution;
uniform float uExtent;
uniform vec3 uMin;
uniform vec3 uMax;
uniform float uOpacity;
uniform int uRegion;
uniform float uBand;
uniform bool uSmooth;
uniform vec3 uNegative;
uniform vec3 uZero;
uniform vec3 uPositive;
varying vec3 vBack;
varying vec3 vDirection;
out vec4 outColor;
#define gl_FragColor outColor

float fieldAt(vec3 position){
 vec3 p=clamp(uExtent>1.5?fract(position):position,0.0,1.0)*uResolution;
 ivec3 a=ivec3(floor(p));
 float sampled=texelFetch(uField,ivec3(floor(p+0.5)),0).r;
 if(uSmooth){
 // Manual trilinear sampling also works without float-linear extensions.
 ivec3 b=min(a+ivec3(1),ivec3(int(uResolution)));
 vec3 w=fract(p);
 float c00=mix(texelFetch(uField,ivec3(a.x,a.y,a.z),0).r,texelFetch(uField,ivec3(b.x,a.y,a.z),0).r,w.x);
 float c10=mix(texelFetch(uField,ivec3(a.x,b.y,a.z),0).r,texelFetch(uField,ivec3(b.x,b.y,a.z),0).r,w.x);
 float c01=mix(texelFetch(uField,ivec3(a.x,a.y,b.z),0).r,texelFetch(uField,ivec3(b.x,a.y,b.z),0).r,w.x);
 float c11=mix(texelFetch(uField,ivec3(a.x,b.y,b.z),0).r,texelFetch(uField,ivec3(b.x,b.y,b.z),0).r,w.x);
 sampled=mix(mix(c00,c10,w.y),mix(c01,c11,w.y),w.z);
 }
 return sampled;
}
void main(){
 if(any(lessThanEqual(uMax,uMin)))discard;
 vec3 direction=normalize(vDirection);
 vec3 origin=vBack-direction*(2.0*uExtent+1.0);
 vec3 safeDirection=mix(vec3(-1.0),vec3(1.0),greaterThanEqual(direction,vec3(0.0)))*max(abs(direction),vec3(1e-7));
 vec3 t0=(uMin-origin)/safeDirection,t1=(uMax-origin)/safeDirection;
 vec3 enter=min(t0,t1),leave=max(t0,t1);
 float near=max(max(enter.x,enter.y),enter.z),far=min(min(leave.x,leave.y),leave.z);
 if(far<=near)discard;
 int count=min(384,max(1,int(ceil((far-near)*uResolution*2.0))));
 float stepSize=(far-near)/float(count);
 vec4 accumulated=vec4(0.0);
 for(int i=0;i<384;i++){
  if(i>=count||accumulated.a>.985)break;
  vec3 p=origin+direction*(near+(float(i)+.5)*stepSize);
  float value=fieldAt(p);
  if((uRegion==1&&abs(value)>uBand)||(uRegion==2&&value>=0.0)||(uRegion==3&&value<=0.0))continue;
  vec3 colour=mix(uZero,value<0.0?uNegative:uPositive,clamp(abs(value),0.0,1.0));
  float density=uRegion==1?4.0:(.15+.85*abs(value));
  float alpha=1.0-exp(-uOpacity*density*stepSize);
  accumulated.rgb+=(1.0-accumulated.a)*alpha*colour;
  accumulated.a+=(1.0-accumulated.a)*alpha;
 }
 if(accumulated.a<.001)discard;
 outColor=vec4(accumulated.rgb/accumulated.a,accumulated.a);
 #include <colorspace_fragment>
}`;

export function createTpmsVolume(grid,extent=1){
 const {data}=normalizedVolumeData(grid),m=grid.resolution+1;
 const texture=new THREE.Data3DTexture(data,m,m,m);texture.format=THREE.RedFormat;texture.type=THREE.FloatType;texture.minFilter=THREE.NearestFilter;texture.magFilter=THREE.NearestFilter;texture.unpackAlignment=1;texture.generateMipmaps=false;texture.needsUpdate=true;
 const uniforms={uField:{value:texture},uResolution:{value:grid.resolution},uExtent:{value:extent},uMin:{value:new THREE.Vector3()},uMax:{value:new THREE.Vector3(extent,extent,extent)},uOpacity:{value:DEFAULT_VOLUME_SETTINGS.opacity},uRegion:{value:['all','near-zero','negative','positive'].indexOf(DEFAULT_VOLUME_SETTINGS.region)},uBand:{value:DEFAULT_VOLUME_SETTINGS.band},uSmooth:{value:true},uNegative:{value:new THREE.Color(0x3e8ce1)},uZero:{value:new THREE.Color(0xdce5ef)},uPositive:{value:new THREE.Color(0xf09946)}};
 const material=new THREE.ShaderMaterial({glslVersion:THREE.GLSL3,uniforms,vertexShader,fragmentShader,side:THREE.BackSide,transparent:true,depthWrite:false,depthTest:false,toneMapped:false});
 const geometry=new THREE.BoxGeometry(extent,extent,extent).translate(extent/2,extent/2,extent/2),mesh=new THREE.Mesh(geometry,material);mesh.renderOrder=1;
 return{mesh,update(settings){const bounds=volumeBounds(extent,settings);uniforms.uMin.value.fromArray(bounds.min);uniforms.uMax.value.fromArray(bounds.max);uniforms.uOpacity.value=settings.opacity;uniforms.uRegion.value=['all','near-zero','negative','positive'].indexOf(settings.region);uniforms.uBand.value=settings.band;uniforms.uSmooth.value=settings.smooth;},dispose(){texture.dispose();material.dispose();geometry.dispose();}};
}
