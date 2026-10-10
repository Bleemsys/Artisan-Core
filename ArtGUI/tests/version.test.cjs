'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {syncVersion} = require('../scripts/sync-version.cjs');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'artgui-version-'));
  t.after(() => fs.rmSync(root, {recursive:true, force:true}));
  for (const file of ['package.json','package-lock.json','src-tauri/Cargo.toml','src-tauri/Cargo.lock','src-tauri/tauri.conf.json','ui/version.js']) {
    fs.mkdirSync(path.dirname(path.join(root,file)), {recursive:true});
    fs.copyFileSync(path.join(__dirname,'..',file), path.join(root,file));
  }
  return root;
}
function bump(root, version) {
  const file=path.join(root,'package.json');
  const pkg=JSON.parse(fs.readFileSync(file,'utf8'));
  pkg.version=version; fs.writeFileSync(file, JSON.stringify(pkg));
}
test('one version change reaches UI, Tauri, Cargo and lockfiles; dependencies stay unchanged', t => {
  const root=fixture(t), read=file=>fs.readFileSync(path.join(root,file),'utf8');
  const oldLock=JSON.parse(read('package-lock.json'));
  const oldCargoLock=read('src-tauri/Cargo.lock');
  const oldVersion=JSON.parse(read('package.json')).version;
  bump(root,'1.2.3-rc.4');
  const oldUI=read('ui/version.js');
  assert.throws(()=>syncVersion(root,{check:true}),/stale/);
  assert.equal(read('ui/version.js'),oldUI);
  syncVersion(root);
  assert.match(read('ui/version.js'),/ARTGUI_VERSION = "1.2.3-rc.4"/);
  assert.match(read('src-tauri/Cargo.toml'),/version = "1.2.3-rc.4"/);
  const newLock=JSON.parse(read('package-lock.json'));
  assert.equal(newLock.version,'1.2.3-rc.4');
  assert.equal(newLock.packages[''].version,'1.2.3-rc.4');
  oldLock.version=newLock.version; oldLock.packages[''].version=newLock.version;
  assert.deepEqual(newLock,oldLock);
  assert.equal(read('src-tauri/Cargo.lock'),oldCargoLock.replace(`name = "artisan-workbench"\nversion = "${oldVersion}"`,`name = "artisan-workbench"\nversion = "1.2.3-rc.4"`).replace(`name = "artisan-workbench"\r\nversion = "${oldVersion}"`,`name = "artisan-workbench"\r\nversion = "1.2.3-rc.4"`));
  const config=JSON.parse(read('src-tauri/tauri.conf.json'));
  assert.equal(JSON.parse(read(path.join('src-tauri',config.version))).version,'1.2.3-rc.4');
  const mtime=fs.statSync(path.join(root,'ui/version.js')).mtimeMs;
  syncVersion(root); syncVersion(root,{check:true});
  assert.equal(fs.statSync(path.join(root,'ui/version.js')).mtimeMs,mtime);
});
test('invalid source versions fail without modifying generated files', t => {
  const root=fixture(t), file=path.join(root,'ui/version.js');
  const before=fs.readFileSync(file,'utf8');
  for(const version of ['01.2.3','1.2','1.2.3-01','garbage',null]) {
    bump(root,version); assert.throws(()=>syncVersion(root),/SemVer/);
    assert.equal(fs.readFileSync(file,'utf8'),before);
  }
});
