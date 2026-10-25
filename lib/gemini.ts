import {createHash} from 'node:crypto';

export function parseGeminiKeys(value:string|string[]|undefined):string[]{
 return [...new Set((Array.isArray(value)?value:[value||'']).flatMap(v=>v.split(/[\s,;،]+/)).map(v=>v.trim()).filter(Boolean))];
}
type SavedKeys={keys?:string[];key?:string};
export function resolveGeminiKeys(env:Record<string,string|undefined>,saved:SavedKeys={}):string[]{
 if(saved.keys?.length)return parseGeminiKeys(saved.keys);
 const pool=parseGeminiKeys(env.GEMINI_API_KEYS);
 if(pool.length)return pool; // The new pool takes precedence over old single-key cookies.
 const backups=Object.keys(env).filter(name=>/^GEMINI_API_KEY_BACKUP_\d+$/.test(name)).sort((a,b)=>Number(a.split('_').at(-1))-Number(b.split('_').at(-1)));
 const legacy=parseGeminiKeys([env.GEMINI_API_KEY||'',...backups.map(name=>env[name]||'')]);
 return legacy.length?legacy:parseGeminiKeys(saved.key);
}
const fingerprint=(value:string)=>createHash('sha256').update(value).digest('hex');
async function retryDelay(response:Response,now:number):Promise<number>{
 const retry=response.headers.get('retry-after');
 let milliseconds=retry?(Number.isFinite(Number(retry))?Number(retry)*1000:Date.parse(retry)-now):0;
 try{
  const body=await response.clone().json();
  for(const detail of body.error?.details||[]){
   if(typeof detail.retryDelay==='string'&&/^\d+(\.\d+)?s$/.test(detail.retryDelay))milliseconds=Math.max(milliseconds,parseFloat(detail.retryDelay)*1000);
  }
 }catch{/* Provider error text is never logged or returned to the browser. */}
 return Math.max(1000,Number.isFinite(milliseconds)&&milliseconds>0?milliseconds:60000);
}
type Options={fetcher?:typeof fetch;now?:()=>number};
export function createGeminiClient(options:Options={}){
 const fetcher=options.fetcher||((input,init)=>fetch(input,init)),now=options.now||Date.now;
 // Warm instances remember cooldowns; every request can still try each available key once.
 const cooldowns=new Map<string,number>(),active=new Map<string,number>();
 return async function request(keys:string[],model:string,init:RequestInit={},operation:'generateContent'|'model'='generateContent'):Promise<Response>{
  const unique=parseGeminiKeys(keys);
  if(!unique.length)throw new Error('Gemini is not configured');
  const pool=fingerprint(model+'\0'+unique.join('\0')),start=(active.get(pool)||0)%unique.length;
  for(const [id,until] of cooldowns)if(until<=now())cooldowns.delete(id);
  if(active.size>500)active.clear();
  for(let offset=0;offset<unique.length;offset++){
   init.signal?.throwIfAborted();
   const index=(start+offset)%unique.length,key=unique[index],id=fingerprint(model+'\0'+key);
   if((cooldowns.get(id)||0)>now())continue;
   const headers=new Headers(init.headers);headers.set('x-goog-api-key',key);
   const response=await fetcher('https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(model)+(operation==='model'?'':':generateContent'),{...init,headers});
   if(response.status!==429){if(response.ok&&!cooldowns.has(id))active.set(pool,index);return response;}
   cooldowns.set(id,Math.max(cooldowns.get(id)||0,now()+await retryDelay(response,now())));
   active.set(pool,(index+1)%unique.length);
  }
  const next=Math.min(...unique.map(key=>cooldowns.get(fingerprint(model+'\0'+key))||now()+60000));
  const seconds=Math.max(1,Math.ceil((next-now())/1000));
  return Response.json({error:{status:'RESOURCE_EXHAUSTED'}},{status:429,headers:{'Retry-After':String(seconds),'Cache-Control':'no-store'}});
 };
}
export const geminiRequest=createGeminiClient();
