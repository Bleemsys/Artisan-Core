import {test} from 'node:test';
import assert from 'node:assert/strict';
import {csvReferences,csvPathKey} from '../ui/csv-references.mjs';

test('discovers nested CSV and TSV references without changing the workflow',()=>{
 const doc={Setup:{data:'./data/source.csv'},WorkFlow:{1:{Read:{files:['data/field.TSV',{file:'data/samples.csv'}]}},2:{Export:{outfile:'results/new.csv'}}},PostProcess:{},ArtGUI:{supportingFiles:[{path:'support.csv'}],pointClouds:[{path:'saved.csv'}],other:'ignored.csv'}};
 const before=JSON.stringify(doc);
 assert.deepEqual(csvReferences(doc),['./data/source.csv','data/field.TSV','data/samples.csv','results/new.csv','support.csv']);
 assert.equal(JSON.stringify(doc),before);
});

test('deduplicates Windows path spellings and ignores other JSON values',()=>{
 const doc={WorkFlow:{files:['./data/points.csv','DATA\\points.CSV','data//./points.csv','mesh.stl','points.csv.bak','',null,3,{label:'ordinary text'}]},ArtGUI:{supportingFiles:[{path:'./DATA/points.csv'}]}};
 assert.deepEqual(csvReferences(doc),['./data/points.csv']);
 assert.equal(csvPathKey('.//data/./points.csv'),csvPathKey('DATA\\points.CSV'));
 assert.notEqual(csvPathKey('left/points.csv'),csvPathKey('right/points.csv'));
 assert.deepEqual(csvReferences({}),[]);
});
