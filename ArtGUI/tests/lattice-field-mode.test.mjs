import test from 'node:test';
import assert from 'node:assert/strict';
import {definitionTemplate,definitionError} from '../ui/lattice-schema.js';
import {parseNumericJson,stringifyNumericJson} from '../ui/numeric-json.js';
import {latticePreviewKey,latticePreviewWorkflow} from '../ui/lattice-model.js';
import {translate} from '../ui/i18n.js';

test('mesh and conformal templates keep field_mode optional',()=>{
  for(const type of ['MeshLattice','ConformalLattice']){
    const value=definitionTemplate(type);value.definition.meshfile='Mesh';
    assert.equal(definitionError(value),'');
    assert.equal(Object.hasOwn(value.definition,'field_mode'),false);
  }
});

test('band and full are validated and round-trip inside the nested lattice definition',()=>{
  for(const type of ['MeshLattice','ConformalLattice'])for(const mode of ['band','full']){
    const value=definitionTemplate(type);Object.assign(value.definition,{meshfile:'Mesh',field_mode:mode,extra:{keep:7}});
    assert.equal(definitionError(value),'');
    const reloaded=parseNumericJson(stringifyNumericJson(value));
    assert.equal(reloaded.definition.field_mode,mode);
    assert.equal(reloaded.field_mode,undefined);
    assert.deepEqual(reloaded.definition.extra,{keep:7});
  }
});

test('invalid field modes are rejected for both mesh and conformal definitions',()=>{
  for(const type of ['MeshLattice','ConformalLattice'])for(const mode of [null,true,false,0,1,'','FULL','auto',[],{}]){
    const value=definitionTemplate(type);Object.assign(value.definition,{meshfile:'Mesh',field_mode:mode});
    assert.equal(definitionError(value),'Field mode must be band or full.');
  }
});

test('preview workflows retain full mode and mode changes invalidate the preview',()=>{
  const definition=definitionTemplate('ConformalLattice');Object.assign(definition.definition,{meshfile:'Mesh',field_mode:'full'});
  const doc={Setup:{Type:'Sample'},WorkFlow:{'1':{Define_Lattice:{la_name:'Infill',definition}},
    '2':{Add_Lattice:{la_name:'Infill',size:[1,1,1],thk:.1,Rot:[0,0,0],Trans:[0,0,0],
      Fill:false,Inv:false,Cube_Request:{}}},'3':{Export:{outfile:'original.stl'}}},PostProcess:{}};
  const before=stringifyNumericJson(doc),key=latticePreviewKey(doc,'2');
  const preview=latticePreviewWorkflow(doc,'2','preview.stl');
  assert.equal(preview.WorkFlow['1'].Define_Lattice.definition.definition.field_mode,'full');
  assert.equal(stringifyNumericJson(doc),before);
  definition.definition.field_mode='band';assert.notEqual(latticePreviewKey(doc,'2'),key);
});

test('field-mode labels and validation have English and Chinese display text',()=>{
  for(const text of ['Strut field mode','Band (default)','Full field','Choose a field mode',
    'Field mode must be band or full.','Field mode, joint smoothing and definition JSON',
    'Band uses local regions. Full completes distant values for later offsets. Applies to struts.']){
    assert.equal(translate(text,'en'),text);
    assert.notEqual(translate(text,'zh-CN'),text);
  }
});
