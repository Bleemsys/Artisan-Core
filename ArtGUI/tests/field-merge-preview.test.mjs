import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {fieldMergeFingerprint,fieldMergePreviewWorkflow} from '../ui/field-merge-model.js';
const source=readFileSync(new URL('../ui/app.js',import.meta.url),'utf8'),start=source.indexOf('  async function generateFieldMerge('),handler=source.slice(start,source.indexOf('  const geometryFieldContext=',start)),runner=source.slice(source.indexOf('  async function runPanelWorkflow('),source.indexOf('  async function previewGeometry('));
function fixture(prepare=async()=> 'ViewScratch/run/project_01_field_merge.h5',execute=async()=>({success:true})){
 const p={la_name:'BCCubic',size:[4,4,4],thk:.4,Rot:[0,0,0],Trans:[0,0,0],Fill:true,Cube_Request:{},OP_para:{InterpType:'Attractor',pt_att:[4,4,4],pt_r:3,Transition:{}}},calls=[],doc={Setup:{},WorkFlow:{'1':{OP_FieldMerge:p},'2':{Export:{outfile:'unrelated.stl'}}},PostProcess:{CombineMeshes:true}},c={doc,key:'1'};
 const sandbox={doc,runProgress:{busy:false,run:async(args)=>{calls.push(['run',JSON.parse(args.contents)]);return execute(doc);}},preparingGeneration:false,invoke:()=>{},scratchPreviewPath:async(...args)=>{calls.push(['scratch',...args]);return prepare(doc);},isDiscardedPreview:()=>false,cleaningScratch:false,backendPath:'ArtisanMain.exe',pythonPath:'',currentPath:'project.json',fieldMergeFingerprint,fieldMergePreviewWorkflow,fieldMergeContext:params=>params===p?c:null,sampleDomainError:()=>'',saveProject:async(_,prefix)=>{calls.push(['save',prefix]);return true;},workflowJson:JSON.stringify,
 fieldInspector:{releaseForGeneration:()=>calls.push(['release']),resumeAfterGeneration:()=>calls.push(['resume']),load:async(...args)=>{calls.push(['load',...args]);return {};},setVisible:()=>{}},refreshAll:()=>calls.push(['refresh']),selected:null};
 vm.createContext(sandbox);vm.runInContext(handler+runner,sandbox);return {sandbox,p,c,calls};
}
test('production preview sends the selected prefix to Artisan and opens its real lattice field',async()=>{
 const f=fixture();const result=await f.sandbox.generateFieldMerge(f.p,f.c);assert.equal(result.success,true);assert.equal(result.field,'lattice');const workflow=f.calls.find(c=>c[0]==='run')[1];assert.equal(workflow.WorkFlow['2'].Export.outfile,'ViewScratch/run/project_01_field_merge.h5');assert.deepEqual(f.calls[0],['scratch','1','field_merge.h5']);assert.equal(JSON.stringify(workflow).includes('unrelated.stl'),false);assert.deepEqual(f.calls.filter(c=>['release','resume','load'].includes(c[0])).map(c=>c[0]),['release','resume','load']);assert.equal(f.sandbox.doc.WorkFlow['2'].Export.outfile,'unrelated.stl');
});
test('preview does not run when prerequisites change while allocating scratch storage',async()=>{
 const f=fixture(async doc=>{doc.Setup.res=[2,2,2];return 'preview.h5';});await f.sandbox.generateFieldMerge(f.p,f.c);assert.deepEqual(f.calls,[['scratch','1','field_merge.h5']]);
});
test('a changed workflow during generation cannot publish a stale field as the current preview',async()=>{
 const f=fixture(undefined,async doc=>{doc.Setup.res=[2,2,2];return {success:true};});const result=await f.sandbox.generateFieldMerge(f.p,f.c);assert.equal(result,undefined);assert.equal(f.calls.some(c=>c[0]==='load'),false);assert.equal(f.sandbox.preparingGeneration,false);
});
