// Compare Windows file references while retaining their original path for resolution.
export function csvPathKey(path){
 return String(path).trim().replaceAll('\\','/').replace(/\/+/g,'/').split('/').filter(part=>part!=='.').join('/').toLowerCase();
}

// Discovery reads JSON values only. CSV contents are read when a tree item is opened.
export function csvReferences(doc){
 const paths=[],seen=new Set();
 function visit(value){
  if(typeof value==='string'){
   const path=value.trim();if(!/\.(csv|tsv)$/i.test(path))return;
   const key=csvPathKey(path);if(!seen.has(key)){seen.add(key);paths.push(path);}return;
  }
  if(value&&typeof value==='object')for(const child of Object.values(value))visit(child);
 }
 for(const [key,value] of Object.entries(doc||{}))if(key!=='ArtGUI')visit(value);
 for(const file of doc?.ArtGUI?.supportingFiles||[])visit(file.path);
 return paths;
}
