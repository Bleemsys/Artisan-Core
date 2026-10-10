import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseInp} from '../ui/inp-parser.mjs';

test('full INP loading accepts counts beyond the former node, element and face caps', () => {
  const count=500001;
  const records=['*NODE','1,0,0,0','2,1,0,0','3,0,1,0','4,0,0,1'];
  for(let id=5;id<=count;id++)records.push(`${id},${id},0,0`);
  records.push('*ELEMENT,TYPE=C3D4');
  // Repeated connectivity keeps the surface map small while processing more
  // than two million faces and retaining every distinct element ID.
  for(let id=1;id<=count;id++)records.push(`${id},1,2,3,4`);
  const mesh=parseInp(records.join('\n'));
  assert.equal(mesh.metadata.nodeCount,count);
  assert.equal(mesh.metadata.elementCount,count);
  assert.equal(mesh.topology.nodeIds.length,count);
  assert.equal(mesh.topology.elements.at(-1).id,count);
});
