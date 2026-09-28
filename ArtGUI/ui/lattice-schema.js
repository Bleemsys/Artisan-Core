import {parseNumericJson} from './numeric-json.js';

// Names and reference domains from Artisan/LatticeObj.py and Customization.rst.
export const integratedGroups={
  'Hex · strut':['Cubic','BCCubic','BC','FCCubic','EdgeOcta','VertexOcta','StarTet','Dodecahedron','Auxetic'],
  'Hex · TPMS':['SchwarzDiamond','SchwarzPrimitive','FischerKoch','Neovius','Lidinoid','Gyroid'],
  'Tet · strut':['Rhombic','Star','Icosahedral','Voronoi','Kagome','Tetrahedron']
};
export const integratedNames=Object.values(integratedGroups).flat();
export const definitionTypes={MeshLattice:'Mesh lattice',ConformalLattice:'Conformal lattice',strut:'Strut unit cell',TPMS:'TPMS unit cell','TPMS-Field':'Field-driven TPMS',Geom:'Geometry unit cell','Geom-Plate':'Surface / plate unit cell'};
export const isMeshType=type=>['MeshLattice','ConformalLattice'].includes(type);
const templates={
  MeshLattice:'{"type":"MeshLattice","definition":{"meshfile":"","k":0.0}}',
  ConformalLattice:'{"type":"ConformalLattice","definition":{"meshfile":"","la_name":"BCCubic","k":0.0}}',
  strut:'{"type":"strut","definition":{"pts":[[1.0,1.0,0.0],[1.0,1.0,1.0],[0.0,1.0,1.0],[0.0,1.0,0.0],[0.0,0.0,0.0],[0.0,0.0,1.0],[1.0,0.0,1.0],[1.0,0.0,0.0]],"cnnt":[[0,1],[0,3],[3,2],[2,1],[1,6],[0,7],[3,4],[2,5],[7,4],[7,6],[6,5],[4,5],[0,5],[1,4],[2,7],[3,6]],"ladomain":"Hex"}}',
  TPMS:'{"type":"TPMS","definition":{"unit_x_len":"2*pi","unit_y_len":"2*pi","unit_z_len":"2*pi","expr":"cos(x)+cos(y)+cos(z)","ladomain":"Hex"}}',
  'TPMS-Field':'{"type":"TPMS-Field","definition":{"unit_x_len":"2*pi","unit_y_len":"2*pi","unit_z_len":"2*pi","expr":"cos(FrequencyField*x)+cos(FrequencyField*y)+cos(FrequencyField*z)","ladomain":"Hex"}}',
  Geom:'{"type":"Geom","definition":{"file":"","ladomain":"Hex"}}',
  'Geom-Plate':'{"type":"Geom-Plate","definition":{"file":"","ladomain":"Hex"}}'
};
export function definitionTemplate(type){if(!templates[type])throw Error('Unsupported definition type.');return parseNumericJson(templates[type]);}
export function definitionError(value){
  if(!value||!definitionTypes[value.type]||!value.definition||typeof value.definition!=='object'||Array.isArray(value.definition))return 'Choose a supported lattice type with a definition object.';
  const d=value.definition,required=key=>typeof d[key]==='string'&&d[key].trim();
  if(isMeshType(value.type)){
    if(!required('meshfile'))return 'Select a mesh file or enter an existing mesh variable name.';
    if(d.k!==undefined&&(!Number.isFinite(d.k)||d.k<0))return 'Smoothing factor k must be a finite, non-negative number.';
    if(value.type==='ConformalLattice'&&!required('la_name'))return 'Choose an integrated lattice or enter a custom unit-cell name / .txt file.';
  }else{
    if(!['Hex','Tet','Quad','Triangle'].includes(d.ladomain))return 'Choose Hex, Tet, Quad, or Triangle as the reference domain.';
    if(value.type==='strut'){
      if(!Array.isArray(d.pts)||d.pts.length<2||d.pts.some(p=>!Array.isArray(p)||p.length!==3||!p.every(Number.isFinite)))return 'Nodes must be an array of [X, Y, Z] coordinates.';
      if(!Array.isArray(d.cnnt)||!d.cnnt.length||d.cnnt.some(e=>!Array.isArray(e)||e.length!==2||e.some(i=>!Number.isInteger(i)||i<0||i>=d.pts.length)||e[0]===e[1]))return 'Connections must contain pairs of distinct zero-based node indices.';
      if(d.pts.some(p=>p.some(v=>v<0||v>1)||(d.ladomain==='Tet'&&p.reduce((a,b)=>a+b,0)>1+1e-9)))return d.ladomain==='Tet'?'Tet nodes must lie inside x ≥ 0, y ≥ 0, z ≥ 0, x + y + z ≤ 1.':'Unit-cell coordinates must lie between 0 and 1.';
    }else if(value.type.startsWith('TPMS')){
      if(['unit_x_len','unit_y_len','unit_z_len','expr'].some(k=>!required(k)))return 'Provide all three unit periods and the implicit expression.';
    }else if(!required('file'))return 'Select the geometry file for this unit cell.';
  }
  return '';
}
export function latticeReferences(doc){
  const refs=[];
  function visit(obj,step,definitionHeader=false){if(!obj||typeof obj!=='object')return;for(const [key,value] of Object.entries(obj)){
    if(key==='la_name'&&typeof value==='string'&&!definitionHeader)refs.push({step,value,object:obj,key});
    else if(value&&typeof value==='object')visit(value,step,key==='Define_Lattice');
  }}
  for(const [step,value] of Object.entries(doc.WorkFlow||{}))visit(value,step);
  return refs;
}
