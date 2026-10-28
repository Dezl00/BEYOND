import {neon} from '@neondatabase/serverless';
import {categorySchema,invoiceSchema} from './schemas';
import {ApiError} from './server';
import {z} from 'zod';
export async function readDesktopCategories(owner:string){
 const url=process.env.DATABASE_URL;if(!url)throw new ApiError('اتصال التصنيفات غير متاح.',503);
 const sql=neon(url);
 // Catalog reads bypass workspace migration/initialization and never write.
 const rows=await sql.query("SELECT data->'categories' AS categories FROM beyond_workspaces WHERE owner_id=$1",[owner]);
 const result=categorySchema.array().max(1000).safeParse(rows[0]?.categories||[]);
 if(!result.success)throw new ApiError('تعذر قراءة التصنيفات. راجع قائمتها في نسخة الويب.',503);
 return result.data;
}
const payloadSchema=z.object({invoices:invoiceSchema.array().min(1).max(50)}).strict();
export async function desktopExportInput(request:Request,owner:string){
 if(Number(request.headers.get('content-length')||0)>512000)throw new ApiError('دفعة التصدير أكبر من الحد المسموح.',413);
 const bytes=new Uint8Array(await request.arrayBuffer());if(bytes.length>512000)throw new ApiError('دفعة التصدير أكبر من الحد المسموح.',413);
 let input:unknown;try{input=JSON.parse(new TextDecoder().decode(bytes));}catch{throw new ApiError('بيانات التصدير غير صالحة.');}
 const parsed=payloadSchema.safeParse(input);if(!parsed.success)throw new ApiError('بيانات الفواتير غير مكتملة.');
 const categories=await readDesktopCategories(owner);
 for(const invoice of parsed.data.invoices){
  if(!categories.some(c=>c.code===invoice.categoryCode))throw new ApiError('اختر حسابًا من التصنيفات لكل فاتورة قبل التصدير.');
  if(Math.abs(invoice.netCents+invoice.taxCents-invoice.grossCents)>2||invoice.grossCents<=0)throw new ApiError('راجع المبالغ قبل التصدير.');
 }
 return {invoices:parsed.data.invoices,categories};
}
export const desktopHeaders={'Cache-Control':'no-store, private','Pragma':'no-cache','X-Content-Type-Options':'nosniff'};
