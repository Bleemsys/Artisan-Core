import {cloneNumericJson,stringifyNumericJson} from './numeric-json.js';

export const slotKeyword='Gen_SlotCutters';
const sorted=workflow=>Object.entries(workflow||{}).sort(([a],[b])=>Number(a)-Number(b));
const vector=v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite);
const length=v=>vector(v)?Math.hypot(...v):0;
const normal=v=>{const n=length(v);return n?v.map(x=>x/n):null;};
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const tolerance=1e-6;
export const slotId=value=>typeof value==='string'&&value.trim()&&value!=='lattice'&&!/[\/\\\0]/.test(value);

export function slotInputs(workflow,key){
  const plates=new Map(),names=new Set();
  let activePlate=null,empty=false;
  for(const [step,commands] of sorted(workflow)){
    if(Number(step)>=Number(key))break;
    for(const [op,p] of Object.entries(commands||{})){
      if(op==='Proc_BoxSlices'&&!p?.outfile&&Array.isArray(p?.Boxes)){
        for(const box of p.Boxes){
          if(!slotId(box?.FieldID))continue;
          plates.set(box.FieldID,box);names.add(box.FieldID);
        }
        if((p.Target??'Lattice')==='Lattice'){
          activePlate=p.Boxes.length===1?p.Boxes[0]:null;empty=false;
        }
      }else if(op==='Clear_LatticeField'){activePlate=null;empty=true;}
      else if(op==='Load_LatticeField'){activePlate=p?.Source?.Type==='Field'?plates.get(p.Source.ID):null;empty=false;}
      else if(op==='Store_LatticeField'&&slotId(p?.FieldID)){
        names.add(p.FieldID);
        if(activePlate)plates.set(p.FieldID,activePlate);
      }else if(op==='Add_Geometry'&&!p?.push2GeomField){
        activePlate=empty&&p?.Source?.Type==='Field'?plates.get(p.Source.ID):null;empty=false;
      }else if(op===slotKeyword){
        for(const id of [p?.Cutters?.A,p?.Cutters?.B])if(slotId(id))names.add(id);
      }else if(op==='Gen_Lattice'||op==='Add_Lattice'){activePlate=null;empty=false;}
      const field={ReadGridField:'Gridfield_ID',OP_GeomSDF_GridField:'out_gridfieldFile',
        Define_ScalarField_CombineGeometry:'field_id',Proc_Field_Morph:'output_field',
        OP_ExprOperation_GridField:'out_gridFieldFile',OP_Fit_GridField:'out_gridFieldFile'}[op];
      if(field&&slotId(p?.[field]))names.add(p[field]);
    }
  }
  return {plates,names};
}

export function pairDirection(a,b){
  const x=normal(a?.normal??[0,0,1]),y=normal(b?.normal??[0,0,1]);
  if(!a||!b||!x||!y||Math.abs(dot(x,y))>tolerance)return null;
  const cross=normal([x[1]*y[2]-x[2]*y[1],x[2]*y[0]-x[0]*y[2],x[0]*y[1]-x[1]*y[0]]);
  if(!cross)return null;
  const axis=cross.reduce((best,value,i)=>Math.abs(value)>Math.abs(cross[best])?i:best,0);
  const sign=cross[axis]<0?-1:1;
  return cross.map(v=>v===0?0:v*sign);
}

export function directionMatches(direction,joint){
  const d=normal(direction);
  return !!d&&(!joint||Math.hypot(d[1]*joint[2]-d[2]*joint[1],d[2]*joint[0]-d[0]*joint[2],d[0]*joint[1]-d[1]*joint[0])<=tolerance);
}

export function suggestedCutters(a,b,names=new Set()){
  const taken=new Set(names);
  const pair=[a,b].map(id=>String(id||'Plate').trim().replace(/[^-\p{L}\p{N}_]+/gu,'_')).join('_');
  return Object.fromEntries(['A','B'].map(side=>{
    const base=pair+'_cut_'+side;
    let id=base,index=2;
    while(taken.has(id))id=base+'_'+index++;
    taken.add(id);
    return [side,id];
  }));
}

export function slotError(p,{plates=new Map(),names=new Set()}={}){
  if(!slotId(p?.A)||!slotId(p?.B)||p.A===p.B)return 'Choose two different plate fields.';
  const a=plates.get(p.A),b=plates.get(p.B),joint=pairDirection(a,b);
  if(a&&b&&!joint)return 'Choose plates on perpendicular planes.';
  if(!directionMatches(p.direction,joint))return joint?'Direction must follow the plate intersection.':'Enter a finite, nonzero direction.';
  if(!['Negative','Positive'].includes(p.open_A)||!['Negative','Positive'].includes(p.open_B)||p.open_A===p.open_B)
    return 'Open the two slots in opposite directions.';
  const split=p.split_ratio??.5,clearance=p.clearance??0;
  if(!Number.isFinite(split)||split<=0||split>=1)return 'Split must be greater than 0% and less than 100%.';
  if(!Number.isFinite(clearance)||clearance<0)return 'Clearance must be zero or greater.';
  const ca=p.Cutters?.A,cb=p.Cutters?.B;
  if(!slotId(ca)||!slotId(cb)||ca===cb)return 'Enter two distinct cutter field names.';
  if(ca===p.A||ca===p.B||cb===p.A||cb===p.B||names.has(ca)||names.has(cb))return 'Cutter names must differ from existing fields.';
  return '';
}

export function slotWorkflowError(workflow){
  for(const [key,step] of sorted(workflow)){
    if(!Object.hasOwn(step||{},slotKeyword))continue;
    const issue=slotError(step[slotKeyword],slotInputs(workflow,key));
    if(issue)return 'Step '+key+': '+issue;
  }
  return '';
}

export function renameSlotFields(workflow,key,previous,next){
  const ids=new Map(['A','B'].filter(side=>slotId(previous[side])&&previous[side]!==next[side])
    .map(side=>[previous[side],next[side]]));
  if(!ids.size)return;
  for(const [step,commands] of sorted(workflow)){
    if(Number(step)<=Number(key))continue;
    for(const [op,p] of Object.entries(commands||{})){
      const source=p?.Source;
      if(source?.Type==='Field'&&ids.has(source.ID))source.ID=ids.get(source.ID);
      if(op==='Export'&&Array.isArray(p.GridFieldIDs))p.GridFieldIDs=p.GridFieldIDs.map(id=>ids.get(id)??id);
    }
  }
}

export function slotFingerprint(doc,key){
  return stringifyNumericJson([doc.Setup,sorted(doc.WorkFlow).filter(([step])=>Number(step)<=Number(key))]);
}

export function slotPreviewWorkflow(doc,key,path){
  const copy=cloneNumericJson(doc),prefix=sorted(copy.WorkFlow).filter(([step])=>Number(step)<=Number(key));
  const params=copy.WorkFlow[key]?.[slotKeyword];
  if(!params)throw Error('This slot cutter step is no longer in the workflow.');
  const meshReads=new Set(prefix.flatMap(([,step])=>Object.values(step).flatMap(p=>
    [p?.meshfile,p?.mesh_file,p?.Name,p?.Source?.Type==='Mesh'?p.Source.ID:null].filter(Boolean))));
  const fieldReads=new Set(prefix.map(([,step])=>step.ReadGridField?.inp_GridFieldFile).filter(Boolean));
  const steps=[];
  for(const [,commands] of prefix){
    const kept={};
    for(const [name,p] of Object.entries(commands)){
      if(name==='ExportMeshID'&&!meshReads.has(p?.out_meshfile))continue;
      if(name==='Export'){
        const fieldPath=p?.fieldfile||p?.outfile;
        if(!meshReads.has(p?.outfile)&&!fieldReads.has(fieldPath))continue;
        if(!meshReads.has(p?.outfile)&&p.fieldfile){
          kept.Export={outfile:p.fieldfile,GridFieldIDs:p.GridFieldIDs||[]};
          continue;
        }
      }
      kept[name]=p;
    }
    if(Object.keys(kept).length)steps.push(kept);
  }
  const ids=new Set(steps.flatMap(step=>Object.values(step).map(p=>p?.MeshID).filter(Boolean)));
  const outputs={A:path,B:path.replace(/_plate_a\.stl$/i,'_plate_b.stl')};
  if(outputs.A===outputs.B)throw Error('Invalid joint preview path.');
  for(const side of ['A','B']){
    const base='ArtGUISlotPreview'+side;
    let id=base,index=2;
    while(ids.has(id))id=base+index++;
    ids.add(id);
    steps.push(
      {Load_LatticeField:{Source:{Type:'Field',ID:params[side]}}},
      {Subtract_Geometry:{Source:{Type:'Field',ID:params.Cutters[side]},k_factor:0,push2GeomField:false}},
      {Store_LatticeMesh:{MeshID:id}},
      {ExportMeshID:{MeshID:id,elem_type:'Triangle',out_meshfile:outputs[side]}}
    );
  }
  copy.WorkFlow=Object.fromEntries(steps.map((step,i)=>[String(i+1),step]));
  copy.PostProcess={...copy.PostProcess,CombineMeshes:false,RemovePartitionMeshFile:true,RemoveIsolatedParts:false};
  delete copy.ArtGUI;
  return {workflow:copy,outputs};
}
