import {neon} from '@neondatabase/serverless';
import {z} from 'zod';
import {categorySchema} from './schemas';
import type {Category} from './domain';
import {ApiError} from './server';
import {categoryEtag} from './category-response';

const account=categorySchema.strict();
export const accountChangeSchema=z.discriminatedUnion('action',[
 z.object({action:z.literal('add'),categories:account.array().min(1).max(100)}).strict(),
 z.object({action:z.literal('rename'),code:z.string().trim().min(1).max(80),name:z.string().trim().min(1).max(180),previousName:z.string().trim().min(1).max(180)}).strict(),
 z.object({action:z.literal('update'),previous:account,category:account}).strict(),
 z.object({action:z.literal('delete'),category:account,replacementCode:z.string().trim().min(1).max(80).optional()}).strict(),
 z.object({action:z.literal('replace'),categories:account.array().min(1).max(1000),expectedEtag:z.string().min(1).max(100),replacements:z.record(z.string(),z.string().min(1).max(80)).optional()}).strict()
]);
type Change=z.infer<typeof accountChangeSchema>;
export interface AccountRepository {
 read:()=>Promise<{categories:Category[];revision:number;usage?:Record<string,number>}|null>;
 commit:(revision:number,categories:Category[],remaps?:Record<string,string>)=>Promise<boolean>;
}
function currentAccount(categories:Category[],expected:Category){
 const value=categories.find(c=>c.code===expected.code);
 if(!value||value.name!==expected.name)throw new ApiError('تغير الحساب من نافذة أخرى. حدّث القائمة قبل تعديله.',409);
 return value;
}
export function mergeAccounts(current:Category[],change:Change):Category[]{
 let categories=current.map(c=>({...c}));
 if(change.action==='replace'){
  if(categoryEtag(current)!==change.expectedEtag.trim().replace(/^W\//,''))throw new ApiError('تغيرت قائمة الحسابات. أعد قراءتها قبل الاستبدال.',409);
  categories=change.categories.map(c=>({...c}));
 }else if(change.action==='delete'){
  currentAccount(categories,change.category);
  if(change.replacementCode&&(change.replacementCode===change.category.code||!categories.some(c=>c.code===change.replacementCode)))throw new ApiError('اختر حسابًا بديلًا صالحًا.');
  categories=categories.filter(c=>c.code!==change.category.code);
 }else if(change.action==='update'){
  const value=currentAccount(categories,change.previous);
  if(categories.some(c=>c!==value&&c.code===change.category.code))throw new ApiError('كود الحساب مستخدم بالفعل.',409);
  Object.assign(value,change.category);
 }else if(change.action==='rename'){
  const value=categories.find(c=>c.code===change.code);
  if(!value)throw new ApiError('الحساب لم يعد موجودًا. حدّث القائمة.',409);
  if(value.name!==change.name){currentAccount(categories,{code:change.code,name:change.previousName});value.name=change.name;}
 }else{
  if(new Set(change.categories.map(c=>c.code)).size!==change.categories.length)throw new ApiError('توجد أكواد مكررة في القائمة.');
  for(const value of change.categories){
   const existing=categories.find(c=>c.code===value.code);
   if(existing&&existing.name!==value.name)throw new ApiError('كود الحساب '+value.code+' مستخدم بالفعل.',409);
   if(!existing)categories.push({...value});
  }
 }
 if(categories.length>1000)throw new ApiError('الحد الأقصى 1000 حساب.');
 if(new Set(categories.map(c=>c.code)).size!==categories.length)throw new ApiError('توجد أكواد مكررة في القائمة.');
 return categories;
}
export async function changeDesktopAccounts(repository:AccountRepository,change:Change){
 for(let attempt=0;attempt<4;attempt++){
  const snapshot=await repository.read();
  if(!snapshot)throw new ApiError('قائمة الحسابات غير مهيأة. افتح نسخة الويب أولًا.',409);
  const categories=mergeAccounts(snapshot.categories,change);
  const remaps:Record<string,string>={};
  if(change.action==='update'&&change.previous.code!==change.category.code)remaps[change.previous.code]=change.category.code;
  if(change.action==='delete'&&change.replacementCode)remaps[change.category.code]=change.replacementCode;
  if(change.action==='replace')Object.assign(remaps,change.replacements);
  for(const [from,to] of Object.entries(remaps)){
   if(!snapshot.categories.some(c=>c.code===from)||!categories.some(c=>c.code===to))throw new ApiError('ربط الحساب البديل غير صالح.');
  }
  for(const [code,count] of Object.entries(snapshot.usage||{})){
   if(count>0&&!categories.some(c=>c.code===code)&&!remaps[code])throw new ApiError('الحساب '+code+' مرتبط بفواتير. اختر حسابًا بديلًا قبل الحذف.',409);
  }
  if(JSON.stringify(categories)===JSON.stringify(snapshot.categories)&&!Object.keys(remaps).length)return categories;
  if(await repository.commit(snapshot.revision,categories,remaps))return categories;
 }
 throw new ApiError('تغيرت الحسابات أثناء الحفظ. أعد المحاولة.',409);
}
// Catalog and invoice account references change together under the workspace revision lock.
// Invoice values, metadata, preferences and array order are preserved.
export const ACCOUNT_PATCH_SQL=`UPDATE beyond_workspaces SET data=
 jsonb_set(data,'{categories}',$1::jsonb) ||
 CASE WHEN jsonb_typeof(data->'invoices')='array' AND $4::jsonb <> '{}'::jsonb THEN
 jsonb_build_object('invoices',COALESCE((SELECT jsonb_agg(
 CASE WHEN $4::jsonb ? (entry->>'categoryCode') THEN jsonb_set(entry,'{categoryCode}',$4::jsonb->(entry->>'categoryCode')) ELSE entry END ORDER BY ordinal)
 FROM jsonb_array_elements(data->'invoices') WITH ORDINALITY AS i(entry,ordinal)),'[]'::jsonb)) ELSE '{}'::jsonb END,
 revision=revision+1,updated_at=now() WHERE owner_id=$2 AND revision=$3 RETURNING revision`;
export function desktopAccountRepository(owner:string):AccountRepository{
 const url=process.env.DATABASE_URL;if(!url)throw new ApiError('اتصال الحسابات غير متاح.',503);
 const sql=neon(url);
 return {
  async read(){
   const rows=await sql.query(`SELECT data->'categories' AS categories,revision,
    COALESCE((SELECT jsonb_object_agg(code,n) FROM (SELECT entry->>'categoryCode' AS code,count(*) AS n FROM jsonb_array_elements(CASE WHEN jsonb_typeof(data->'invoices')='array' THEN data->'invoices' ELSE '[]'::jsonb END) entry WHERE COALESCE(entry->>'categoryCode','')<>'' GROUP BY 1) counts),'{}'::jsonb) AS usage
    FROM beyond_workspaces WHERE owner_id=$1`,[owner]);
   if(!rows.length)return null;
   const parsed=categorySchema.array().max(1000).safeParse(rows[0].categories);
   if(!parsed.success)throw new ApiError('قائمة الحسابات غير صالحة.',503);
   return {categories:parsed.data,revision:rows[0].revision as number,usage:rows[0].usage as Record<string,number>};
  },
  async commit(revision,categories,remaps={}){
   const rows=await sql.query(ACCOUNT_PATCH_SQL,[JSON.stringify(categories),owner,revision,JSON.stringify(remaps)]);
   return rows.length>0;
  }
 };
}
