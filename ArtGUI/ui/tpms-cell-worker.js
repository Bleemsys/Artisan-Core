import {sampleTpmsGrid} from './tpms-cell-model.js';
self.onmessage=event=>{
 const {id,definition,resolution}=event.data;
 try{const grid=sampleTpmsGrid(definition,resolution);self.postMessage({id,grid},[grid.values.buffer,grid.cells.buffer]);}
 catch(error){self.postMessage({id,error:error.message||String(error)});}
};
