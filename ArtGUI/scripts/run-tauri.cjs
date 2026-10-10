'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const {syncVersion} = require('./sync-version.cjs');

// Preparation and Tauri must share one process environment. An npm prebuild
// script cannot export HDF5_DIR into the subsequent npm build process.
function windowsHdf5Environment(input, exists = fs.existsSync) {
  const configured = input.HDF5_DIR;
  const candidates = configured ? [configured] : [
    input.CONDA_PREFIX,
    path.join(input.ProgramData || input.PROGRAMDATA || 'C:\\ProgramData', 'Anaconda3'),
    input.USERPROFILE && path.join(input.USERPROFILE, 'anaconda3'),
    input.LOCALAPPDATA && path.join(input.LOCALAPPDATA, 'anaconda3'),
  ].filter(Boolean);
  let root, library;
  for (const candidate of candidates) {
    const absolute = path.resolve(candidate);
    const nested = path.join(absolute, 'Library');
    const location = exists(path.join(nested, 'include', 'hdf5.h')) ? nested : absolute;
    if (['include/hdf5.h', 'include/H5pubconf.h', 'lib/hdf5.lib', 'bin/hdf5.dll']
      .every(file => exists(path.join(location, file)))) {
      root = absolute; library = location; break;
    }
  }
  if (!root) {
    throw Error(configured
      ? `HDF5_DIR does not contain complete x64 HDF5 development files: ${configured}. Expected include/hdf5.h, include/H5pubconf.h, lib/hdf5.lib and bin/hdf5.dll (or an Anaconda Library folder).`
      : 'Could not find HDF5 development files. Set HDF5_DIR to your x64 HDF5 or Anaconda installation root.');
  }
  const env = {...input};
  const pathKey = Object.keys(env).find(key => key.toUpperCase() === 'PATH');
  const oldPath = pathKey ? env[pathKey] : '';
  for (const key of Object.keys(env)) if (key.toUpperCase() === 'PATH') delete env[key];
  env.HDF5_DIR = root;
  env.PATH = path.join(library, 'bin') + path.delimiter + oldPath;
  const python = input.ARTGUI_BUILD_PYTHON || (exists(path.join(root, 'python.exe'))
    ? path.join(root, 'python.exe') : 'python');
  return {env, python, root, library};
}

function runTauri(args, options = {}) {
  const app = options.app || path.resolve(__dirname, '..');
  (options.syncVersion || syncVersion)(app);
  const platform = options.platform || process.platform;
  const spawn = options.spawn || spawnSync;
  let env = {...(options.env || process.env)};
  if (platform === 'win32') {
    const plan = windowsHdf5Environment(env, options.exists);
    env = plan.env;
    const result = spawn(plan.python, [path.join(app, 'scripts', 'prepare_hdf5.py'), '--hdf5-dir', plan.root],
      {cwd: app, env, stdio: ['inherit', 'pipe', 'inherit'], encoding: 'utf8'});
    if (result.error) throw Error(`Could not run HDF5 build helper: ${result.error.message}. Set ARTGUI_BUILD_PYTHON to a Python executable.`);
    if (result.status !== 0) return result.status || 1;
    console.log(`HDF5 prepared from ${plan.library}`);
  }
  const cli = path.join(app, 'node_modules', '@tauri-apps', 'cli', 'tauri.js');
  if (!(options.exists || fs.existsSync)(cli)) throw Error('Tauri CLI is missing. Run npm install in Src/ArtGUI.');
  // Argument arrays keep executable paths and CLI options intact, including spaces.
  const result = spawn(process.execPath, [cli, ...args], {cwd: app, env, stdio: 'inherit'});
  if (result.error) throw result.error;
  return result.status === null ? 1 : result.status;
}

module.exports = {windowsHdf5Environment, runTauri};
if (require.main === module) {
  try { process.exitCode = runTauri(process.argv.slice(2)); }
  catch (error) { console.error(`ArtGUI build: ${error.message}`); process.exitCode = 1; }
}
