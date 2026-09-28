import {copyFile, mkdir, readFile, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const three=path.join(root,'node_modules','three');
const vendor=path.join(root,'ui','vendor');
try {
  await mkdir(path.join(vendor,'addons','controls'),{recursive:true});
  for(const name of ['three.module.js','three.core.js'])await copyFile(path.join(three,'build',name),path.join(vendor,name));
  await copyFile(path.join(three,'LICENSE'),path.join(vendor,'THREE-LICENSE.txt'));
  const controls=await readFile(path.join(three,'examples','jsm','controls','OrbitControls.js'),'utf8');
  if(!controls.includes("from 'three'"))throw new Error('Unexpected OrbitControls import; review the Three.js dependency update.');
  await writeFile(path.join(vendor,'addons','controls','OrbitControls.js'),controls.replace("from 'three'","from '../../three.module.js'"));
  console.log('Prepared local Three.js viewer assets and license.');
} catch(error) {
  console.error(`Could not prepare viewer assets. Run npm ci first. ${error.message}`);
  process.exitCode=1;
}
