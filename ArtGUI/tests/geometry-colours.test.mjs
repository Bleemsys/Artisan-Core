import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../ui/vendor/three.module.js';
import {GeometryViewer} from '../ui/viewer.js';
import {geometryColour,saveGeometryColour,applyGeometryColours,validateGeometryColours} from '../ui/geometry-colours.js';
import {parseNumericJson,stringifyNumericJson} from '../ui/numeric-json.js';
import {translate} from '../ui/i18n.js';

function viewer(onLayerColorChanged=()=>{}) {
  const v=Object.create(GeometryViewer.prototype);
  Object.assign(v,{settings:{sourceColor:'#ededed',resultColor:'#ebbb68'},layerColors:new Map(),layers:new Map(),scene:new THREE.Scene(),origin:new THREE.Vector3(),hasOrigin:false,measurements:[],pending:[],onLayerColorChanged});
  for(const method of ['setOpacity','setDisplay','setActiveLayer','refreshLayers','refreshHelpers','updateSection','redrawMeasurements','fit','validateUpload','render'])v[method]=()=>{};
  v.$=()=>null;
  return v;
}
const triangle=()=>new Float32Array([0,0,0,1,0,0,0,1,0]);

test('source, reference and result colours survive project save without altering workflow values',()=>{
  const doc=parseNumericJson('{"Setup":{"Geomfile":"part.stl","res":[0.8,0.8,0.8]},"WorkFlow":{"1":{"Clear_LatticeField":{}}},"PostProcess":{},"ArtGUI":{"version":1,"geometry":[{"id":"geometry-a","path":"a.stl"},{"id":"geometry-b","path":"b.stl"},{"id":"result","path":"result.stl"}],"supportingFiles":[]}}');
  const workflow=stringifyNumericJson(doc.WorkFlow),setup=stringifyNumericJson(doc.Setup);
  assert.equal(saveGeometryColour(doc,'source','#AABBCC'),true);
  saveGeometryColour(doc,'geometry-a','#ff0000');saveGeometryColour(doc,'geometry-b','#00ff00');saveGeometryColour(doc,'result','#0000ff');
  const saved=JSON.parse(stringifyNumericJson(doc));validateGeometryColours(saved.ArtGUI);
  assert.equal(geometryColour(saved,'source'),'#aabbcc');
  assert.equal(geometryColour(saved,'geometry-a'),'#ff0000');assert.equal(geometryColour(saved,'geometry-b'),'#00ff00');
  assert.equal(geometryColour(saved,'result'),'#0000ff');
  assert.equal(stringifyNumericJson(doc.Setup),setup);assert.equal(stringifyNumericJson(doc.WorkFlow),workflow);
  assert.equal(saveGeometryColour(doc,'source','#aabbcc'),false);
  assert.equal(saveGeometryColour(doc,'support-data','#ff0000'),false);
});

test('saved colours apply before preview loads and do not leak into another project',()=>{
  const doc={};saveGeometryColour(doc,'source','#123456');
  let notifications=0;const v=viewer(()=>notifications++);
  applyGeometryColours(v,doc);
  assert.equal(v.layerColor('source'),'#123456');assert.equal(notifications,0);
  v.setLayer('source',triangle(),{center:[0,0,0]});
  assert.equal(v.layers.get('source').material.uniforms.tint.value.getHexString(),'123456');
  v.layers.clear();applyGeometryColours(v,{ArtGUI:{version:1,geometry:[],supportingFiles:[]}});
  v.setLayer('source',triangle(),{center:[0,0,0]});
  assert.equal(v.layerColor('source'),'#ededed');
  assert.equal(v.layers.get('source').material.uniforms.tint.value.getHexString(),'ededed');
});

test('colour edits update one geometry, shared line uniforms and Visibility controls; reload retains the choice',async()=>{
  const doc={ArtGUI:{version:1,geometry:[{id:'geometry-a',path:'a.stl'},{id:'geometry-b',path:'b.stl'}],supportingFiles:[]}};
  let notices=0;const v=viewer((id,colour)=>{saveGeometryColour(doc,id,colour);notices++;});
  const inputs=[{dataset:{layerColor:'geometry-a'},value:'#ededed'},{dataset:{layerColor:'geometry-b'},value:'#ededed'}];
  v.$=()=>({querySelectorAll:()=>inputs});
  v.setLayer('geometry-a',triangle(),{center:[0,0,0],lines:new Float32Array([0,0,0,1,0,0])});
  v.setLayer('geometry-b',triangle(),{center:[0,0,0]});
  const a=v.layers.get('geometry-a');v.setLayerColor('geometry-a','#8040FF');
  assert.equal(a.material.uniforms.tint.value.getHexString(),'8040ff');
  assert.equal(a.mesh.children[0].material.uniforms.tint.value.getHexString(),'8040ff');
  assert.equal(v.layers.get('geometry-b').material.uniforms.tint.value.getHexString(),'ededed');
  assert.equal(inputs[0].value,'#8040ff');assert.equal(inputs[1].value,'#ededed');
  assert.equal(doc.ArtGUI.geometry[0].color,'#8040ff');assert.equal(notices,1);
  v.setLayer('geometry-a',triangle(),{center:[0,0,0],mode:'quick'});
  assert.equal(v.layers.get('geometry-a').material.uniforms.tint.value.getHexString(),'8040ff');
  const stage=v.beginFullDetail('geometry-a','a.stl');
  stage.append({positions:triangle(),indices:new Uint16Array([0,1,2]),center:[0,0,0]});
  v.setLayerColor('geometry-a','#00aacc');
  await stage.commit({center:[0,0,0],bounds:[[0,0,0],[1,1,0]],totalTriangles:1});
  const layer=v.layers.get('geometry-a');
  assert.equal(layer.material.uniforms.tint.value.getHexString(),'00aacc');
  assert.equal(layer.mesh.children[0].children[0].children[0].material.uniforms,layer.material.uniforms);
});

test('older projects keep defaults and invalid saved colours are rejected',()=>{
  validateGeometryColours({geometry:[]});assert.equal(geometryColour({},'source','#123456'),'#123456');
  for(const colour of ['red','#fff','123456','#12345678','" oninput="bad',null,42]){
    assert.throws(()=>validateGeometryColours({sourceColor:colour}),/Invalid geometry display colour/);
    assert.throws(()=>validateGeometryColours({geometry:[{color:colour}]}),/Invalid geometry display colour/);
  }
  assert.equal(translate('Display colour','zh-CN'),'显示颜色');
  assert.equal(translate('Saved with this project.','zh-CN'),'随此项目保存。');
});
