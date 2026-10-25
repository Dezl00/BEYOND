import {get,set,del,keys} from 'idb-keyval';
import {Workspace,emptyWorkspace,cleanWorkspace,workspaceNeedsMigration} from './domain';
const STATE='beyond-workspace-v1';
export type Source={bytes:ArrayBuffer;mime:string;name:string;expiresAt:number;preview?:string};
export async function loadWorkspace():Promise<Workspace> {
 const saved=await get<Workspace>(STATE);
 const workspace=cleanWorkspace(saved?{...emptyWorkspace,...saved,preferences:{...emptyWorkspace.preferences,...saved.preferences}}:structuredClone(emptyWorkspace));
 if(saved&&(workspaceNeedsMigration(saved)||saved.invoices.length!==workspace.invoices.length))await set(STATE,workspace);
 return workspace;
}
export const saveWorkspace=(state:Workspace)=>set(STATE,cleanWorkspace(state));
export const saveSource=(id:string,source:Source)=>set('source:'+id,source);
export async function loadSource(id:string) {
 const value=await get<Source>('source:'+id);
 if(value&&value.expiresAt<=Date.now()){await del('source:'+id);return null;}
 return value||null;
}
export async function purgeExpired() {
 for(const key of await keys()) if(String(key).startsWith('source:')){
  const value=await get<Source>(key);if(value&&value.expiresAt<=Date.now()) await del(key);
 }
}
export async function forgetSource(id:string) {await del('source:'+id);}
