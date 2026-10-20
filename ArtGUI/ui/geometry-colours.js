export const isGeometryColour = value => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);

export function validateGeometryColours(state) {
  if (state.sourceColor !== undefined && !isGeometryColour(state.sourceColor)) {
    throw Error('Invalid geometry display colour.');
  }
  for (const file of state.geometry || []) {
    if (file.color !== undefined && !isGeometryColour(file.color)) throw Error('Invalid geometry display colour.');
  }
}

export function geometryColour(doc, id, fallback = '#ededed') {
  const saved = id === 'source' ? doc.ArtGUI?.sourceColor : doc.ArtGUI?.geometry?.find(file => file.id === id)?.color;
  return isGeometryColour(saved) ? saved.toLowerCase() : fallback;
}

export function saveGeometryColour(doc, id, colour) {
  if (!isGeometryColour(colour)) throw Error('Invalid geometry display colour.');
  colour = colour.toLowerCase();
  if (id === 'source') {
    if (doc.ArtGUI?.sourceColor === colour) return false;
    doc.ArtGUI ||= {version: 1, geometry: [], supportingFiles: []};
    doc.ArtGUI.sourceColor = colour;
    return true;
  }
  const file = doc.ArtGUI?.geometry?.find(file => file.id === id);
  if (!file || file.color === colour) return false;
  file.color = colour;
  return true;
}

export function applyGeometryColours(viewer, doc) {
  if (!viewer) return;
  viewer.layerColors?.clear();
  if (isGeometryColour(doc.ArtGUI?.sourceColor)) viewer.setLayerColor('source', doc.ArtGUI.sourceColor, {notify: false});
  for (const file of doc.ArtGUI?.geometry || []) {
    if (isGeometryColour(file.color)) viewer.setLayerColor(file.id, file.color, {notify: false});
  }
}
