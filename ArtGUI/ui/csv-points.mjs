export class CsvRecords {
  constructor(delimiter=',',onRow=()=>{}){if(![',',';','\t'].includes(delimiter))throw Error('Unsupported delimiter.');this.delimiter=delimiter;this.onRow=onRow;this.field='';this.row=[];this.quoted=false;this.closed=false;this.skipLF=false;this.count=0;this.chars=0;}
  push(text,final=false){
    for(const c of text){
      if(this.skipLF){this.skipLF=false;if(c==='\n')continue;}
      if(++this.chars>4*1024**2||this.field.length>1024**2)throw Error('CSV record is too long.');
      if(this.quoted){if(c==='"'){this.quoted=false;this.closed=true;}else this.field+=c;continue;}
      if(this.closed&&c==='"'){this.field+='"';this.quoted=true;this.closed=false;continue;}
      if(c===this.delimiter){this.endField();continue;}
      if(c==='\r'||c==='\n'){this.endField();if(this.row.length>1||this.row.some(v=>v.trim()!=='')){this.onRow(this.row,++this.count);}this.row=[];this.chars=0;this.skipLF=c==='\r';continue;}
      if(this.closed){if(c===' '||c==='\t')continue;throw Error('Unexpected characters after a quoted CSV field.');}
      if(c==='"'){if(this.field.trim())throw Error('Unexpected quote in CSV field.');this.field='';this.quoted=true;}else this.field+=c;
    }
    if(final){if(this.quoted)throw Error('Unclosed quoted CSV field.');if(this.field.length||this.row.length){this.endField();if(this.row.length>1||this.row.some(v=>v.trim()!==''))this.onRow(this.row,++this.count);this.row=[];}}
  }
  endField(){if(this.row.length>=1024)throw Error('CSV has more than 1024 columns.');this.row.push(this.field);this.field='';this.closed=false;}
}
export function csvNumber(value){const s=String(value??'').trim();return s!==''?Number(s):NaN;}
export function inspectCsv(text,{delimiter=null,header=null}={}){
  text=text.replace(/^\uFEFF/,'');
  if(!delimiter){const line=text.split(/\r?\n/).find(s=>s.trim())||'';const counts=[',',';','\t'].map(d=>{let quoted=false,n=0;for(const c of line){if(c==='"')quoted=!quoted;if(c===d&&!quoted)n++;}return n;});delimiter=[',',';','\t'][counts.indexOf(Math.max(...counts))];}
  const rows=[];new CsvRecords(delimiter,row=>{if(rows.length<32)rows.push(row);}).push(text,false);
  if(!rows.length){new CsvRecords(delimiter,row=>rows.push(row)).push(text,true);}
  if(!rows.length||rows[0].length<3)throw Error('CSV needs at least three coordinate columns.');
  header=header??!rows[0].every(s=>Number.isFinite(csvNumber(s)));
  const names=(header?rows[0]:rows[0].map((_,i)=>`Column ${i+1}`)).map((s,i)=>s.trim()||`Column ${i+1}`);
  const used=new Set(),axes=['x','y','z'].map((axis,i)=>{
    let found=names.findIndex((s,j)=>!used.has(j)&&new RegExp(`^${axis}(?:$|[ _.(\\[])`,'i').test(s));
    if(found<0)found=names.findIndex((_,j)=>!used.has(j));used.add(found);return found;
  });
  const candidates=names.map((name,index)=>({name,index,numeric:rows.slice(header?1:0).some(row=>Number.isFinite(csvNumber(row[index])))}));
  const scalar=candidates.find(c=>!axes.includes(c.index)&&c.numeric)?.index??-1;
  return {delimiter,header,names,axes,scalar,candidates};
}
export function validatePointMapping(config,columns){
  if(!config||!Array.isArray(config.axes)||config.axes.length!==3||new Set(config.axes).size!==3||config.axes.some(i=>!Number.isInteger(i)||i<0||i>=columns))throw Error('Choose three different coordinate columns.');
  if(!Number.isInteger(config.scalar)||config.scalar< -1||config.scalar>=columns)throw Error('Choose a valid color column.');
  if(!Number.isInteger(config.limit)||config.limit<1000||config.limit>1000000)throw Error('Display limit must be 1,000 to 1,000,000 points.');
  if(![',',';','\t'].includes(config.delimiter)||typeof config.header!=='boolean')throw Error('Invalid CSV format settings.');
}
export class PointReservoir {
  constructor(config,columns){validatePointMapping(config,columns);this.config=config;this.columns=columns;this.valid=0;this.invalid=0;this.count=0;this.seed=0x12345678;this.minimum=Infinity;this.maximum=-Infinity;this.missing=0;
    this.coordinates=new Float64Array(config.limit*3);this.values=new Float64Array(config.limit);this.rows=new Float64Array(config.limit);this.lo=[Infinity,Infinity,Infinity];this.hi=[-Infinity,-Infinity,-Infinity];}
  accept(row,record){
    if(this.config.header&&record===1)return;
    const point=this.config.axes.map(i=>csvNumber(row[i]));
    if(row.length!==this.columns||!point.every(Number.isFinite)){this.invalid++;return;}
    for(let i=0;i<3;i++){this.lo[i]=Math.min(this.lo[i],point[i]);this.hi[i]=Math.max(this.hi[i],point[i]);}
    const value=this.config.scalar<0?NaN:csvNumber(row[this.config.scalar]);
    if(Number.isFinite(value)){this.minimum=Math.min(this.minimum,value);this.maximum=Math.max(this.maximum,value);}else if(this.config.scalar>=0)this.missing++;
    this.valid++;
    let slot=this.valid-1;
    if(slot>=this.config.limit){let s=this.seed;s^=s<<13;s^=s>>>17;s^=s<<5;this.seed=s>>>0;slot=Math.floor(this.seed/4294967296*this.valid);}
    if(slot<this.config.limit){this.coordinates.set(point,slot*3);this.values[slot]=value;this.rows[slot]=record-(this.config.header?1:0);this.count=Math.min(this.valid,this.config.limit);}
  }
  finish(){
    if(!this.valid)throw Error('No valid points. Check coordinate mapping and delimiter.');
    const center=this.lo.map((v,i)=>v/2+this.hi[i]/2),coordinates=this.coordinates.slice(0,this.count*3),positions=new Float32Array(coordinates.length);
    for(let i=0;i<positions.length;i++){positions[i]=coordinates[i]-center[i%3];if(!Number.isFinite(positions[i]))throw Error('Coordinate extent exceeds the renderer range.');}
    return {positions,coordinates,values:this.values.slice(0,this.count),rows:this.rows.slice(0,this.count),center,bounds:[this.lo,this.hi],total:this.valid,invalid:this.invalid,missing:this.missing,shown:this.count,range:this.minimum===Infinity?[0,1]:[this.minimum,this.maximum]};
  }
}
