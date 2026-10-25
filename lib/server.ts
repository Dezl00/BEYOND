import { neon } from '@neondatabase/serverless';
import type { Workspace } from './domain';
import { cleanWorkspace, workspaceNeedsMigration } from './domain';
const COOKIE='beyond_config';
type Credentials={key:string;databaseUrl:string;model:string;owner:string;expires:number};
export class ApiError extends Error { constructor(message:string,public status=400){super(message);} }
export async function ownerId(request:Request){const cookie=request.headers.get('cookie')?.split(';').map(v=>v.trim()).find(v=>v.startsWith('beyond_session='))?.slice(15);if(await authenticatedToken(cookie))return 'beyond-owner';throw new ApiError('سجل الدخول للوصول إلى بياناتك.',401);}
export function protectOrigin(request:Request) {
 const origin=request.headers.get('origin');
 if(request.headers.get('sec-fetch-site')==='cross-site') throw new ApiError('طلب غير مسموح.',403);
 if(origin&&new URL(origin).host!==new URL(request.url).host) throw new ApiError('طلب غير مسموح.',403);
}
const to64=(data:Uint8Array)=>btoa(Array.from(data,v=>String.fromCharCode(v)).join(''));
const from64=(text:string)=>Uint8Array.from(atob(text),c=>c.charCodeAt(0));
async function encryptionKey() {
 const secret=process.env.APP_ENCRYPTION_KEY;
 if(!secret||secret.length<32) throw new ApiError('يلزم إعداد مفتاح حماية إعدادات الخادم أولًا.',503);
 const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(secret));
 return crypto.subtle.importKey('raw',hash,'AES-GCM',false,['encrypt','decrypt']);
}
export async function credentials(request:Request,owner:string):Promise<Credentials> {
 let saved:Partial<Credentials>={};
 const cookie=request.headers.get('cookie')?.split(';').map(v=>v.trim()).find(v=>v.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);
 if(cookie) try {
  const raw=from64(decodeURIComponent(cookie));
  const plaintext=await crypto.subtle.decrypt({name:'AES-GCM',iv:raw.subarray(0,12)},await encryptionKey(),raw.subarray(12));
  const parsed=JSON.parse(new TextDecoder().decode(plaintext));
  if(parsed.owner===owner&&parsed.expires>Date.now()) saved=parsed;
 }catch{/* Expired or invalid cookies are never used. */}
 return {
  key:saved.key||process.env.GEMINI_API_KEY||'',
  databaseUrl:saved.databaseUrl||process.env.DATABASE_URL||'',
  model:saved.model||process.env.GEMINI_MODEL||'gemini-2.5-flash',owner,expires:Date.now()+7*86400000
 };
}
export async function encryptedCookie(config:Credentials,secure:boolean) {
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const payload=new TextEncoder().encode(JSON.stringify(config));
 const encrypted=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},await encryptionKey(),payload));
 const joined=new Uint8Array(iv.length+encrypted.length);joined.set(iv);joined.set(encrypted,iv.length);
 return COOKIE+'='+encodeURIComponent(to64(joined))+'; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800'+(secure?'; Secure':'');
}
export function validateDatabaseUrl(value:string) {
 try {const url=new URL(value);if(!['postgresql:','postgres:'].includes(url.protocol)||!url.hostname.endsWith('.neon.tech')||!url.username||!url.password) throw new Error();}
 catch {throw new ApiError('استخدم رابط اتصال PostgreSQL الصحيح من مشروع Neon.');}
}
export function errorResponse(error:unknown) {
 if(error instanceof ApiError) return Response.json({error:error.message},{status:error.status});
 // Do not expose raw database/provider errors or request credentials.
 console.error('[Beyond]', error instanceof Error?error.name:'OperationError');
 return Response.json({error:'تعذر إتمام العملية. تحقق من الاتصال والإعدادات ثم أعد المحاولة.'},{status:500});
}
let initialized=new Set<string>();
export async function workspaceDb(url:string) {
 const sql=neon(url);
 if(!initialized.has(url)){
  await sql.query('CREATE TABLE IF NOT EXISTS beyond_workspaces (owner_id TEXT PRIMARY KEY, revision INTEGER NOT NULL DEFAULT 0, data JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now())');
  initialized.add(url);
 }
 return sql;
}
export async function readWorkspace(url:string,owner:string):Promise<Workspace|null>{
 const sql=await workspaceDb(url);
 for(let attempt=0;attempt<3;attempt++){
  const rows=await sql.query('SELECT data, revision FROM beyond_workspaces WHERE owner_id = $1',[owner]);
  if(!rows.length)return null;
  const result=cleanWorkspace({...rows[0].data,revision:rows[0].revision});
  if(!workspaceNeedsMigration(rows[0].data))return result;
  const migrated=await sql.query('UPDATE beyond_workspaces SET data=$1::jsonb,revision=revision+1,updated_at=now() WHERE owner_id=$2 AND revision=$3 RETURNING revision',[JSON.stringify(result),owner,rows[0].revision]);
  if(migrated.length)return {...result,revision:migrated[0].revision};
 }
 throw new ApiError('تغيرت البيانات أثناء تحديث صيغة الفواتير. أعد المحاولة.',409);
}
export async function writeWorkspace(url:string,owner:string,state:Workspace){
 const sql=await workspaceDb(url);
 const data=JSON.stringify(cleanWorkspace(state));
 const rows=await sql.query(
  'INSERT INTO beyond_workspaces(owner_id,revision,data) VALUES($1,1,$2::jsonb) ON CONFLICT(owner_id) DO UPDATE SET revision=beyond_workspaces.revision+1,data=EXCLUDED.data,updated_at=now() WHERE beyond_workspaces.revision=$3 RETURNING revision',
  [owner,data,state.revision]
 );
 if(!rows.length) throw new ApiError('البيانات اتعدلت من نافذة أخرى. حدّث الصفحة قبل الحفظ لتفادي استبدال التعديلات.',409);
 return rows[0].revision as number;
}

async function passwordVersion(){return to64(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(process.env.APP_PASSWORD||''))));}
export async function passwordMatches(password:string){
 const expected=process.env.APP_PASSWORD;if(!expected||expected.length<12)return false;
 const [a,b]=await Promise.all([crypto.subtle.digest('SHA-256',new TextEncoder().encode(password)),crypto.subtle.digest('SHA-256',new TextEncoder().encode(expected))]);
 const left=new Uint8Array(a),right=new Uint8Array(b);let diff=0;for(let i=0;i<left.length;i++)diff|=left[i]^right[i];return diff===0;
}
export async function authenticatedToken(token:string|undefined){
 if(!process.env.APP_PASSWORD)return process.env.NODE_ENV==='development'&&!!process.env.APP_ENCRYPTION_KEY;
 if(!token)return false;
 try{const raw=from64(decodeURIComponent(token));const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:raw.subarray(0,12)},await encryptionKey(),raw.subarray(12));const data=JSON.parse(new TextDecoder().decode(plain));return data.owner==='beyond-owner'&&data.expires>Date.now()&&data.version===await passwordVersion();}catch{return false;}
}
export async function createSessionCookie(secure:boolean){
 const iv=crypto.getRandomValues(new Uint8Array(12));const payload=new TextEncoder().encode(JSON.stringify({owner:'beyond-owner',expires:Date.now()+7*86400000,version:await passwordVersion()}));
 const encrypted=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},await encryptionKey(),payload));const joined=new Uint8Array(12+encrypted.length);joined.set(iv);joined.set(encrypted,12);
 return 'beyond_session='+encodeURIComponent(to64(joined))+'; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800'+(secure?'; Secure':'');
}
