import {readFile,writeFile,mkdir,rename,copyFile} from 'node:fs/promises';
import {dirname} from 'node:path';
export function createStore(path){
 let queue=Promise.resolve();let lastSavedAt=0;let error=null;
 async function load(){
  try {const data=JSON.parse(await readFile(path,'utf8'));if(!Array.isArray(data.players))throw Error('Invalid campaign');return data;}
  catch(e){if(e.code==='ENOENT')return null;throw Error('Cannot load saved campaign; existing file was preserved',{cause:e});}
 }
 function save(data){
  const payload=JSON.stringify({...data,version:4,savedAt:Date.now()});
  const task=queue.catch(()=>{}).then(async()=>{
   await mkdir(dirname(path),{recursive:true});const temp=path+'.tmp';
   await writeFile(temp,payload,'utf8');
   try{await copyFile(path,path+'.bak');}catch(e){if(e.code!=='ENOENT')throw e;}
   await rename(temp,path);lastSavedAt=Date.now();error=null;
  });queue=task;task.catch(e=>{error=e.message;});return task;
 }
 return {load,save,status:()=>({lastSavedAt,ok:!error}),flush:()=>queue};
}
