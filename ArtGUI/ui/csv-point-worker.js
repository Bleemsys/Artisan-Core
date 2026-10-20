import {CsvRecords,inspectCsv,PointReservoir} from './csv-points.mjs';
import {stlByteRanges} from './stl-source.mjs';
let acknowledge=null;
self.onmessage=async({data})=>{
  if(data.type==='accepted'){acknowledge?.();acknowledge=null;return;}
  try{
    async function* chunks(){
      if(data.file){for(let i=0;i<data.file.size;i+=1024**2)yield new Uint8Array(await data.file.slice(i,i+1024**2).arrayBuffer());}
      else yield*stlByteRanges(data.url,data.size);
    }
    const decoder=new TextDecoder();let loaded=0,first=true;
    if(data.type==='inspect'){
      let text='';for await(const bytes of chunks()){text+=decoder.decode(bytes,{stream:true});if(text.length>=65536)break;}
      self.postMessage({type:'metadata',...inspectCsv(text.slice(0,65536),data.format||{})});return;
    }
    const reservoir=new PointReservoir(data.config,data.columns),parser=new CsvRecords(data.config.delimiter,(row,index)=>reservoir.accept(row,index));
    for await(const bytes of chunks()){
      let text=decoder.decode(bytes,{stream:true});if(first){text=text.replace(/^\uFEFF/,'');first=false;}parser.push(text);loaded+=bytes.length;
      await new Promise(resolve=>{acknowledge=resolve;self.postMessage({type:'progress',loaded,total:data.size||data.file?.size,valid:reservoir.valid});});
    }
    parser.push(decoder.decode(),true);const result=reservoir.finish();self.postMessage({type:'done',...result},[result.positions.buffer,result.coordinates.buffer,result.values.buffer,result.rows.buffer]);
  }catch(error){self.postMessage({type:'error',message:String(error?.message||error).replaceAll('STL','CSV')});}
};
