import {get,set,del,keys} from 'idb-keyval';
import {Workspace,emptyWorkspace,cleanWorkspace,workspaceNeedsMigration} from './domain';
const STATE='beyond-workspace-v1';
export type Source={bytes:ArrayBuffer;mime:string;name:string;expiresAt:number;preview?:string};
const stagedSources=new Map<string,Source>();
export const stageSource=(id:string,source:Source)=>{stagedSources.set(id,source);};
export const clearStagedSources=()=>stagedSources.clear();
export async function loadWorkspace():Promise<Workspace>{
 const saved=await get<Workspace>(STATE);
 const workspace=cleanWorkspace(saved?{...emptyWorkspace,...saved,preferences:{...emptyWorkspace.preferences,...saved.preferences}}:structuredClone(emptyWorkspace));
 if(saved&&(workspaceNeedsMigration(saved)||saved.invoices.length!==workspace.invoices.length))await set(STATE,workspace);
 return workspace;
}
export const saveWorkspace=(state:Workspace)=>set(STATE,cleanWorkspace(state));
export async function persistImportedSources(ids:string[],retentionHours:number){
 for(const id of ids){const source=stagedSources.get(id);if(source){await set('source:'+id,{...source,expiresAt:Date.now()+retentionHours*3600000});stagedSources.delete(id);}}
}
export async function discardOldUploads(importedIds:string[]){
 const keep=new Set(importedIds);
 await del('beyond-pending');await del('beyond-queue');
 for(const key of await keys())if(String(key).startsWith('source:')&&!keep.has(String(key).slice(7)))await del(key);
}
export async function loadSource(id:string){
 const staged=stagedSources.get(id);if(staged)return staged;
 const value=await get<Source>('source:'+id);
 if(value&&value.expiresAt<=Date.now()){await del('source:'+id);return null;}
 return value||null;
}
export async function purgeExpired(){
 for(const key of await keys())if(String(key).startsWith('source:')){
  const value=await get<Source>(key);if(value&&value.expiresAt<=Date.now())await del(key);
 }
}
export async function forgetSource(id:string){stagedSources.delete(id);await del('source:'+id);}
