import {authorizeDesktop} from '@/lib/desktop-auth';
import {readDesktopCategories} from '@/lib/desktop-data';
import {categoryResponse} from '@/lib/category-response';
import {errorResponse} from '@/lib/server';
import {ApiError} from '@/lib/server';
import {accountChangeSchema,changeDesktopAccounts,desktopAccountRepository} from '@/lib/desktop-accounts';
export const runtime='nodejs';
export async function GET(request:Request){try{const {owner}=authorizeDesktop(request,'categories');return categoryResponse(request,await readDesktopCategories(owner));}catch(error){return errorResponse(error);}}
export async function POST(request:Request){try{
 const {owner}=authorizeDesktop(request,'accounts-write');
 if(Number(request.headers.get('content-length')||0)>512000)throw new ApiError('قائمة الحسابات كبيرة.',413);
 const bytes=new Uint8Array(await request.arrayBuffer());if(bytes.length>512000)throw new ApiError('قائمة الحسابات كبيرة.',413);
 let input:unknown;try{input=JSON.parse(new TextDecoder().decode(bytes));}catch{throw new ApiError('بيانات الحسابات غير صالحة.');}
 const parsed=accountChangeSchema.safeParse(input);if(!parsed.success)throw new ApiError('أدخل كود الحساب واسمه بشكل صحيح.');
 const categories=await changeDesktopAccounts(desktopAccountRepository(owner),parsed.data);
 return categoryResponse(new Request(request.url),categories);
}catch(error){return errorResponse(error);}}
