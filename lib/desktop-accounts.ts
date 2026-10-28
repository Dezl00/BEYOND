import {neon} from '@neondatabase/serverless';
import {z} from 'zod';
import {categorySchema} from './schemas';
import type {Category} from './domain';
import {ApiError} from './server';

export const accountChangeSchema=z.discriminatedUnion('action',[
 z.object({action:z.literal('add'),categories:categorySchema.strict().array().min(1).max(100)}).strict(),
 z.object({action:z.literal('rename'),code:z.string().trim().min(1).max(80),name:z.string().trim().min(1).max(180),previousName:z.string().trim().min(1).max(180)}).strict()
]);
type Change=z.infer<typeof accountChangeSchema>;
export interface AccountRepository {
 read:()=>Promise<{categories:Category[];revision:number}|null>;
 commit:(revision:number,categories:Category[])=>Promise<boolean>;
}
export function mergeAccounts(current:Category[],change:Change):Category[]{
 const categories=current.map(c=>({...c}));
 if(change.action==='rename'){
  const account=categories.find(c=>c.code===change.code);
  if(!account)throw new ApiError('الحساب لم يعد موجودًا. حدّث القائمة.',409);
  if(account.name===change.name)return categories;
  if(account.name!==change.previousName)throw new ApiError('تغير اسم الحساب من نافذة أخرى. حدّث القائمة قبل تعديله.',409);
  account.name=change.name;
 }else{
  if(new Set(change.categories.map(c=>c.code)).size!==change.categories.length)throw new ApiError('توجد أكواد مكررة في القائمة.');
  for(const value of change.categories){
   const existing=categories.find(c=>c.code===value.code);
   if(existing&&existing.name!==value.name)throw new ApiError('كود الحساب '+value.code+' مستخدم بالفعل.',409);
   if(!existing)categories.push({...value});
  }
 }
 if(categories.length>1000)throw new ApiError('الحد الأقصى 1000 حساب.');
 return categories;
}
export async function changeDesktopAccounts(repository:AccountRepository,change:Change){
 for(let attempt=0;attempt<4;attempt++){
  const snapshot=await repository.read();
  if(!snapshot)throw new ApiError('قائمة الحسابات غير مهيأة. افتح نسخة الويب أولًا.',409);
  const categories=mergeAccounts(snapshot.categories,change);
  if(JSON.stringify(categories)===JSON.stringify(snapshot.categories))return categories;
  if(await repository.commit(snapshot.revision,categories))return categories;
 }
 throw new ApiError('تغيرت الحسابات أثناء الحفظ. أعد المحاولة.',409);
}
export function desktopAccountRepository(owner:string):AccountRepository{
 const url=process.env.DATABASE_URL;if(!url)throw new ApiError('اتصال الحسابات غير متاح.',503);
 const sql=neon(url);
 return {
  async read(){
   const rows=await sql.query("SELECT data->'categories' AS categories, revision FROM beyond_workspaces WHERE owner_id=$1",[owner]);
   if(!rows.length)return null;
   const parsed=categorySchema.array().max(1000).safeParse(rows[0].categories);
   if(!parsed.success)throw new ApiError('قائمة الحسابات غير صالحة.',503);
   return {categories:parsed.data,revision:rows[0].revision as number};
  },
  async commit(revision,categories){
   // Patch only the catalog; invoices, preferences and all other JSON fields remain intact.
   const rows=await sql.query("UPDATE beyond_workspaces SET data=jsonb_set(data,'{categories}',$1::jsonb), revision=revision+1, updated_at=now() WHERE owner_id=$2 AND revision=$3 RETURNING revision",[JSON.stringify(categories),owner,revision]);
   return rows.length>0;
  }
 };
}
