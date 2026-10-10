'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const {windowsHdf5Environment, runTauri} = require('../scripts/run-tauri.cjs');

function files(root, nested = true) {
  const library = nested ? path.join(root, 'Library') : root;
  return new Set(['include/hdf5.h','include/H5pubconf.h','lib/hdf5.lib','bin/hdf5.dll']
    .map(file => path.join(library, file)).concat(path.join(root, 'python.exe')));
}
test('active Conda HDF5 is detected and PATH casing is normalized', () => {
  const root = path.resolve('C:/Conda environment');
  const present = files(root);
  const original = {CONDA_PREFIX: root, Path: 'original search path'};
  const plan = windowsHdf5Environment(original, file => present.has(file));
  assert.equal(plan.env.HDF5_DIR, root);
  assert.equal(plan.env.PATH, path.join(root, 'Library/bin') + path.delimiter + original.Path);
  assert.equal(plan.python, path.join(root, 'python.exe'));
  assert.equal(plan.env.Path, undefined);
  assert.equal(original.HDF5_DIR, undefined);
});
test('explicit HDF5 installation overrides Conda and invalid overrides fail', () => {
  const root = path.resolve('C:/Custom HDF5');
  const present = files(root, false);
  const plan = windowsHdf5Environment({HDF5_DIR:root, CONDA_PREFIX:'C:/Conda', ARTGUI_BUILD_PYTHON:'C:/Build Python/python.exe'}, file => present.has(file));
  assert.equal(plan.library, root);
  assert.equal(plan.python, 'C:/Build Python/python.exe');
  assert.throws(() => windowsHdf5Environment({HDF5_DIR:'C:/Missing'}, () => false), /HDF5_DIR does not contain complete/);
});
test('npm launcher falls back to ProgramData and passes the prepared environment to Tauri', () => {
  const root = path.resolve('C:/ProgramData/Anaconda3');
  const present = files(root), calls=[];
  const app = path.resolve('C:/App with spaces');
  const cli = path.join(app,'node_modules/@tauri-apps/cli/tauri.js');
  present.add(cli);
  const status=runTauri(['build','--no-bundle','--config','C:/Config with spaces/build.json'], {
    syncVersion: root => assert.equal(root, app), app, platform:'win32', env:{CONDA_PREFIX:'C:/Incomplete Conda', ProgramData:'C:/ProgramData', PATH:'system'},
    exists:file=>present.has(file), spawn:(exe,args,options)=>{calls.push({exe,args,options});return {status:0};},
  });
  assert.equal(status,0);
  assert.equal(calls.length,2);
  assert.equal(calls[0].exe,path.join(root,'python.exe'));
  assert.equal(calls[1].options.env.HDF5_DIR,root);
  assert.equal(calls[1].options.env.PATH,calls[0].options.env.PATH);
  assert.deepEqual(calls[1].args,[cli,'build','--no-bundle','--config','C:/Config with spaces/build.json']);
});
test('preparation failures stop the build and non-Windows calls go straight to Tauri', () => {
  const root = path.resolve('C:/Anaconda3');
  const present=files(root);let calls=0;
  assert.equal(runTauri(['build'],{syncVersion:()=>{}, platform:'win32', env:{HDF5_DIR:root}, exists:file=>present.has(file), spawn:()=>{calls++;return {status:7};}}),7);
  assert.equal(calls,1);
  const env={PATH:'system'};
  assert.equal(runTauri(['dev'],{syncVersion:()=>{}, platform:'linux',env,exists:()=>true,spawn:(_,args,options)=>{assert.equal(args.at(-1),'dev');assert.deepEqual(options.env,env);return {status:0};}}),0);
});
