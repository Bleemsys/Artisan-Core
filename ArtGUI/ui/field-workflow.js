import {parseNumericJson, assignNumericJson} from './numeric-json.js';

export const scalarFieldKeyword = 'Define_ScalarField_CombineGeometry';
export const tetFieldKeyword = 'Gen_TetMesh_SizeField';

// Mirror optional backend defaults without changing required inputs or saved values.
export function prepareFieldOperation(keyword, params) {
  if (!params || typeof params !== 'object' || Array.isArray(params)) return params;
  const defaults = keyword === scalarFieldKeyword ? '{"overlap":"Minimum"}' :
    keyword === tetFieldKeyword ? '{"hausd":0.01,"surface_tolerance":null,"hgrad":1.3,"preserve_features":true,"feature_angle":45.0,"size_iterations":3,"max_points":250000,"quality_report":""}' : '{}';
  const saved = assignNumericJson({}, params);
  assignNumericJson(params, parseNumericJson(defaults), saved);
  if (keyword === scalarFieldKeyword && Array.isArray(params.regions)) {
    for (const region of params.regions) {
      if (region && typeof region === 'object' && !Array.isArray(region) && !Object.hasOwn(region, 'transition_width')) {
        assignNumericJson(region, parseNumericJson('{"transition_width":0.0}'));
      }
    }
  }
  return params;
}

export function newScalarRegion() {
  return parseNumericJson('{"name":"Region","geometry":"","value":1.0,"transition_width":0.0}');
}

const scalar = {
  field_id: {label:'Field name', help:'Use this name in later steps, for example CellSize.'},
  default_value: {label:'Default value', help:'Value away from all regions. Tet sizing requires positive values.'},
  regions: {label:'Regions', help:'Each region uses a closed triangle surface. No regions gives a constant field.'},
  overlap: {label:'Overlap rule', choices:['Minimum','Maximum'], help:'Minimum includes the default and can only reduce it; Maximum can only increase it.'},
  name: {label:'Region name'},
  geometry: {label:'Region geometry', help:'Enter a mesh file or an existing mesh ID.'},
  value: {label:'Region value'},
  transition_width: {label:'Transition width', help:'Outward blend distance in model units. Zero gives a sharp change at grid points.'},
};
const tet = {
  mesh_file: {label:'Solid surface', help:'One closed, connected triangle surface: a mesh file or an existing mesh ID.'},
  export_mesh: {label:'Tet mesh output', output:true, help:'Use a mesh ID such as TetDomains for conformal infill, or a volume-mesh filename.'},
  size_field: {label:'Size field', help:'Existing field name. Positive values are target tet edge lengths in model units.'},
  sampling_size: {label:'Initial seed size', help:'Controls the initial mesh. The size field controls final cell-size targets.'},
  hausd: {label:'Boundary tolerance', help:'Positive boundary approximation tolerance for each adaptation pass.'},
  surface_tolerance: {label:'Final surface tolerance', nullable:true, help:'Leave empty for twice the boundary tolerance. Checks sampled distance from the original surface.'},
  hgrad: {label:'Size gradation', help:'Must be greater than 1. The default is 1.3.'},
  preserve_features: {label:'Preserve sharp features'},
  feature_angle: {label:'Feature angle', help:'Sharp-feature detection angle, from 0 to 180 degrees.'},
  size_iterations: {label:'Adaptation passes', help:'An integer from 2 to 20; the default is 3.'},
  max_points: {label:'Vertex limit', help:'Checked around native meshing calls; it is not a peak-memory limit.'},
  quality_report: {label:'Quality report', help:'Optional JSON output path. The parent folder must exist.'},
};

export function fieldParameterInfo(path) {
  const [keyword, ...parts] = path.split('.');
  if (keyword === scalarFieldKeyword) return scalar[parts.at(-1)] || {};
  if (keyword === tetFieldKeyword) return tet[parts.at(-1)] || {};
  if (path === 'PostProcess.CleanExportedMesh') return {
    label:'Clean exported mesh',
    help:'Merge identical vertices and remove degenerate triangles and unused vertices. Does not fill holes or repair non-manifold edges. Off by default.',
  };
  return {};
}

export function fieldOperationHelp(keyword) {
  if (keyword === scalarFieldKeyword) return 'Uses the project sampling grid and resolution. Save this field with Export in HDF5 field mode.';
  if (keyword === tetFieldKeyword) return 'Create or load the size field first. It must cover the whole solid in one partition. Tet domains control cell layout; strut thickness is set in Add lattice.';
  return '';
}
