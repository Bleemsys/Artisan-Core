export const isOpacity=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=1;

export function validateObjectOpacities(state){
  if(state.sourceOpacity!==undefined&&!isOpacity(state.sourceOpacity))throw Error('Invalid object opacity.');
  for(const file of [...(state.geometry||[]),...(state.supportingFiles||[])]){
    if(file.opacity!==undefined&&!isOpacity(file.opacity))throw Error('Invalid object opacity.');
  }
  for(const field of state.fields||[]){
    if(field.opacityByField!==undefined){
      const values=field.opacityByField;
      if(!values||typeof values!=='object'||Array.isArray(values)||!Object.values(values).every(isOpacity))throw Error('Invalid object opacity.');
    }
  }
}

export function geometryOpacity(doc,id,fallback=1){
  const value=id==='source'?doc.ArtGUI?.sourceOpacity:[...(doc.ArtGUI?.geometry||[]),...(doc.ArtGUI?.supportingFiles||[])].find(file=>file.id===id)?.opacity;
  return isOpacity(value)?value:fallback;
}

export function saveGeometryOpacity(doc,id,opacity){
  if(!isOpacity(opacity))throw Error('Invalid object opacity.');
  if(id==='source'){
    if(doc.ArtGUI?.sourceOpacity===opacity)return false;
    doc.ArtGUI ||= {version:1,geometry:[],supportingFiles:[]};
    doc.ArtGUI.sourceOpacity=opacity;return true;
  }
  const file=[...(doc.ArtGUI?.geometry||[]),...(doc.ArtGUI?.supportingFiles||[])].find(file=>file.id===id);
  if(!file||file.opacity===opacity)return false;
  file.opacity=opacity;return true;
}

export function applyGeometryOpacities(viewer,doc){
  if(!viewer)return;
  viewer.layerOpacities?.clear();
  if(isOpacity(doc.ArtGUI?.sourceOpacity))viewer.setOpacity('source',doc.ArtGUI.sourceOpacity,{notify:false});
  for(const file of [...(doc.ArtGUI?.geometry||[]),...(doc.ArtGUI?.supportingFiles||[])]){
    if(isOpacity(file.opacity))viewer.setOpacity(file.id,file.opacity,{notify:false});
  }
}
