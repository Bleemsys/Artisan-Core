import test from 'node:test';
import assert from 'node:assert/strict';
import {domainGeometry,setDomainGeometry,selectSetupSource,setSpacing,memoryBytes,samplingGuideSegments,validDomain,paddedDomain} from '../ui/setup-model.js';
import {resizeGeometry} from '../ui/region-model.js';
import {parseNumericJson,stringifyNumericJson} from '../ui/numeric-json.js';

test('domain move and one-sided resize serialize original bounds, keeping unrelated settings',()=>{
 const s=parseNumericJson('{"Type":"Sample","Sample":{"Domain":[[-5.0,5.0],[-6.0,6.0],[-7.0,7.0]],"Shape":"Box","extra":7},"res":[0.2,0.2,0.2],"custom":"keep"}');
 const g=domainGeometry(s.Sample.Domain),resized=resizeGeometry(g,0,1,3,[1,0,0]);setDomainGeometry(s,resized);
 assert.deepEqual(s.Sample.Domain,[[-5,8],[-6,6],[-7,7]]);assert.equal(s.Sample.extra,7);assert.equal(s.custom,'keep');
 resized.center[1]+=10;setDomainGeometry(s,resized);assert.deepEqual(s.Sample.Domain[1],[4,16]);assert.match(stringifyNumericJson(s),/-5\.0/);
});
test('Mesh domain cannot be dragged; source switching retains dormant box bounds and transforms',()=>{
 const s={Type:'Geometry',Geomfile:'part.stl',Sample:{Domain:[[-2,4],[-3,3],[-1,2]],Shape:'Box'},Rot:[1,2,3]};
 assert.throws(()=>setDomainGeometry(s,domainGeometry(s.Sample.Domain)),/Mesh bounds/);
 selectSetupSource(s,'Sample');assert.deepEqual(s.Sample.Domain,[[-2,4],[-3,3],[-1,2]]);selectSetupSource(s,'Geometry');assert.equal(s.Geomfile,'part.stl');assert.deepEqual(s.Rot,[1,2,3]);
 s.Sample.Domain=[[0,0],[0,0],[0,0]];selectSetupSource(s,'Sample',[[1,3],[2,6],[4,8]]);assert.deepEqual(s.Sample.Domain,[[1,3],[2,6],[4,8]]);
});
test('linked and independent spacing reject invalid edits; memory GiB conversion is exact',()=>{
 const s={res:[.2,.3,.4]};setSpacing(s,1,'.5',false);assert.deepEqual(s.res,[.2,.5,.4]);setSpacing(s,2,'0.75',true);assert.deepEqual(s.res,[.75,.75,.75]);
 for(const bad of ['',0,-1,Infinity])assert.throws(()=>setSpacing(s,0,bad,true));assert.equal(memoryBytes('1'),1073741824);assert.equal(memoryBytes('1.5'),1610612736);assert.throws(()=>memoryBytes('-1'));
});
test('sampling guides have bounded work for extreme resolution and include padding',()=>{
 const d=[[-5,5],[-5,5],[-5,5]],res=[.2,.4,.5];assert.deepEqual(paddedDomain(d,res,2),[[-5.4,5.4],[-5.8,5.8],[-6,6]]);
 for(const r of [1,1e-12,Number.MIN_VALUE]){const pts=samplingGuideSegments(d,[r,r,r],1);assert.ok(pts.length<=156);assert.ok(pts.every(p=>p.every(Number.isFinite)));}
 assert.equal(validDomain([[-1e308,1e308],[0,1],[0,1]]),false);assert.equal(domainGeometry([[0,0],[0,1],[0,1]]),null);
});
