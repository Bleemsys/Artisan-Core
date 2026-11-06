// Use the timeline's displayed position, rather than a possibly sparse JSON key.
export function workflowPanelSubtitle(workflow,key){
  const keys=Object.keys(workflow||{}).sort((a,b)=>Number(a)-Number(b));
  const position=keys.indexOf(String(key));
  if(position<0)return '';
  const keywords=Object.keys(workflow[key]||{});
  if(!keywords.length)return '';
  return `Workflow step ${String(position+1).padStart(2,'0')} - ${keywords.join(' / ')}`;
}
