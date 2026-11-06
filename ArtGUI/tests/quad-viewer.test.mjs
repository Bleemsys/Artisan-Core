import {test} from 'node:test';
import assert from 'node:assert/strict';
import {GeometryViewer} from '../ui/viewer.js';
test('FE boundary edges contrast with solid faces while beams keep their assigned colour',()=>{
 const viewer=Object.create(GeometryViewer.prototype),base={uniforms:{displayMode:{value:2}}};
 const edge=viewer.lineMaterial(base,1,true),beam=viewer.lineMaterial(base);
 assert.match(edge.fragmentShader,/displayMode==2\?vec3\(\.07,\.1,\.13\):tint/);
 assert.doesNotMatch(beam.fragmentShader,/displayMode==2\?/);
 assert.equal(edge.uniforms,base.uniforms);edge.dispose();beam.dispose();
});
