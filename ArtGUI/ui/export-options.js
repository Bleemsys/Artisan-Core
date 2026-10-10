// Export's JSON contract is shared with Artisan's EXPORT_SCHEMA.
export const meshExtensions = ['stl', 'obj', 'ply', 'off', 'vtk', 'vtu', 'inp', 'msh', 'mesh', 'med'];
const hdfExtensions = ['h5', 'hdf5'];

function extension(path) {
  if (typeof path !== 'string') return '';
  const name = path.split(/[\\/]/).pop(), dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
}
export function isFieldFile(path) { return hdfExtensions.includes(extension(path)); }
export function exportMode(params) {
  if (Object.hasOwn(params, 'fieldfile')) return 'both';
  return isFieldFile(params.outfile) ? 'field' : 'mesh';
}
function replaceExtension(path, ext) {
  if (typeof path !== 'string' || !path.trim()) return `Artisan_output.${ext}`;
  const slash = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
  const dot = path.lastIndexOf('.');
  return (dot > slash + 1 ? path.slice(0, dot) : path) + '.' + ext;
}
export function setExportMode(params, mode) {
  if (!['mesh', 'field', 'both'].includes(mode)) throw Error('Choose a supported output mode.');
  if (mode === 'field') {
    if (isFieldFile(params.fieldfile)) params.outfile = params.fieldfile;
    else if (!isFieldFile(params.outfile)) params.outfile = replaceExtension(params.outfile, 'h5');
    delete params.fieldfile;
  } else {
    if (isFieldFile(params.outfile)) params.outfile = replaceExtension(params.outfile, 'stl');
    if (mode === 'both') {
      if (!Object.hasOwn(params, 'fieldfile')) params.fieldfile = replaceExtension(params.outfile, 'h5');
    } else {
      delete params.fieldfile;
      delete params.GridFieldIDs;
    }
  }
}
function gridIdsError(ids) {
  if (!Array.isArray(ids) || ids.some(id => typeof id !== 'string' || !id.trim() || id.includes('\0'))) return 'GridFieldIDs must be a JSON array of nonempty field names.';
  if (new Set(ids).size !== ids.length) return 'GridFieldIDs contains duplicate names.';
  if (ids.includes('lattice')) return 'lattice is included automatically when present; remove it from GridFieldIDs.';
  return '';
}
export function parseGridFieldIds(text) {
  let ids;
  try { ids = JSON.parse(text); } catch { throw Error('Enter GridFieldIDs as a JSON array, for example ["SizeField"].'); }
  const error = gridIdsError(ids);
  if (error) throw Error(error);
  return ids;
}
export function exportError(params) {
  if (!params || typeof params !== 'object' || Array.isArray(params)) return 'Export parameters must be an object.';
  const unknown = Object.keys(params).filter(key => !['outfile', 'fieldfile', 'GridFieldIDs'].includes(key));
  if (unknown.length) return `Unknown Export parameter(s): ${unknown.join(', ')}.`;
  if (typeof params.outfile !== 'string' || !params.outfile.trim() || params.outfile.includes('\0')) return 'Enter an output filename in outfile.';
  const field = isFieldFile(params.outfile);
  if (!field && !meshExtensions.includes(extension(params.outfile))) return 'outfile must use a supported mesh extension or .h5 / .hdf5.';
  if (Object.hasOwn(params, 'fieldfile')) {
    if (field) return 'Use a mesh outfile with fieldfile, or choose HDF5 field only.';
    if (typeof params.fieldfile !== 'string' || !params.fieldfile.trim() || params.fieldfile.includes('\0') || !isFieldFile(params.fieldfile)) return 'fieldfile must be a filename ending in .h5 or .hdf5.';
  }
  const ids = Object.hasOwn(params, 'GridFieldIDs') ? params.GridFieldIDs : [];
  const error = gridIdsError(ids);
  if (error) return error;
  if (ids.length && !field && !Object.hasOwn(params, 'fieldfile')) return 'Choose an HDF5 output to export GridFieldIDs.';
  return '';
}
export function exportWorkflowError(workflow, drafts = new WeakMap()) {
  for (const [step, commands] of Object.entries(workflow || {})) {
    if (!Object.hasOwn(commands, 'Export')) continue;
    const params = commands.Export;
    const error = drafts.get(params)?.error || exportError(params);
    if (error) return `Step ${step} (Export): ${error}`;
  }
  return '';
}
