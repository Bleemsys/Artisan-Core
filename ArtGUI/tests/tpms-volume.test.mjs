import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_VOLUME_SETTINGS,normalizedVolumeData,volumeBounds,volumeRayInterval,volumeRegionContains,probeVolume,createTpmsVolume} from '../ui/tpms-volume.js';
import {newTpmsDefinition,sampleTpmsGrid} from '../ui/tpms-cell-model.js';

test('volume upload retains the signed scalar field and handles constant and extreme ranges',()=>{
 const values=Float32Array.of(-3.4e38,0,3.4e38),copy=values.slice(),result=normalizedVolumeData({values,min:values[0],max:values[2]});
 assert.deepEqual([...result.data],[-1,0,1]);assert.deepEqual(values,copy);
 assert.deepEqual([...normalizedVolumeData({values:Float32Array.of(0),min:0,max:0}).data],[0]);
});
test('cut planes bound rays consistently for either retained side and parallel views',()=>{
 const settings={...DEFAULT_VOLUME_SETTINGS,clipEnabled:true,clipAxis:'x',clipPosition:.25};
 assert.deepEqual(volumeBounds(2,settings),{min:[0,0,0],max:[.5,2,2]});
 assert.deepEqual(volumeRayInterval([-1,1,1],[1,0,0],volumeBounds(2,settings)),[1,1.5]);
 assert.equal(volumeRayInterval([-1,3,1],[1,0,0],volumeBounds(2,settings)),null);
 settings.clipSide='upper';assert.deepEqual(volumeRayInterval([-1,1,1],[1,0,0],volumeBounds(2,settings)),[1.5,3]);
 settings.clipPosition=1;assert.equal(volumeRayInterval([-1,1,1],[1,0,0],volumeBounds(2,settings)),null);
 assert.equal(volumeRayInterval([3,1,1],[1,0,0],volumeBounds(1,DEFAULT_VOLUME_SETTINGS)),null);
});
test('volume probing honours region filters, clipping and repeated cells without inventing a pixel value',()=>{
 const definition=newTpmsDefinition();definition.definition.expr='x-pi';const grid=sampleTpmsGrid(definition,16),origin=[-1,.5,.5],direction=[1,0,0];
 const negative=probeVolume(grid,origin,direction,{...DEFAULT_VOLUME_SETTINGS,region:'negative'});assert.equal(negative.kind,'volume');assert.equal(negative.indices[0],0);assert.ok(negative.value<0);
 const positive=probeVolume(grid,origin,direction,{...DEFAULT_VOLUME_SETTINGS,region:'positive'});assert.ok(positive.value>0);assert.ok(positive.indices[0]>8);
 const clipped={...DEFAULT_VOLUME_SETTINGS,region:'negative',clipEnabled:true,clipAxis:'x',clipSide:'upper',clipPosition:.6};assert.equal(probeVolume(grid,origin,direction,clipped),null);
 const repeated=probeVolume(grid,[-1,1.5,.5],direction,{...DEFAULT_VOLUME_SETTINGS,region:'all'},2);assert.ok(repeated);assert.deepEqual(repeated.indices,[0,8,8]);
 assert.equal(volumeRegionContains(.3,{region:'near-zero',band:.2}),false);assert.equal(volumeRegionContains(-.1,{region:'near-zero',band:.2}),true);
});
test('volume material updates GPU controls without replacing the sampled texture and disposes its resources',()=>{
 const grid=sampleTpmsGrid(newTpmsDefinition(),16),volume=createTpmsVolume(grid),u=volume.mesh.material.uniforms,texture=u.uField.value;let disposed=0;
 for(const resource of [texture,volume.mesh.geometry,volume.mesh.material])resource.addEventListener('dispose',()=>disposed++);
 volume.update({...DEFAULT_VOLUME_SETTINGS,opacity:4,region:'near-zero',band:.1,smooth:false,clipEnabled:true,clipAxis:'z',clipPosition:.4});
 assert.equal(u.uField.value,texture);assert.equal(texture.image.width,17);assert.equal(u.uOpacity.value,4);assert.equal(u.uRegion.value,1);assert.equal(u.uBand.value,.1);assert.equal(u.uSmooth.value,false);assert.equal(u.uMax.value.z,.4);assert.equal(volume.mesh.material.depthWrite,false);
 volume.dispose();assert.equal(disposed,3);
});
