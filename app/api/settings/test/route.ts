import {geminiRequest} from '@/lib/gemini';
import {credentials,errorResponse,ownerId,protectOrigin,workspaceDb,ApiError} from '@/lib/server';
export async function POST(request:Request){try{
 protectOrigin(request);const owner=await ownerId(request);const config=await credentials(request,owner);
 const result:{ai?:string;database?:string}={};
 if(config.keys.length){
  const r=await geminiRequest(config.keys,config.model,{signal:AbortSignal.timeout(20000)},'model');
  result.ai=r.ok?'متصل · '+config.keys.length+' مفاتيح مضافة؛ الاختبار لا يقيس الحصة المتبقية':r.status===429?'نفدت الحصة المتاحة لكل المفاتيح':'تعذر الاتصال؛ راجع المفاتيح واسم النموذج';
 }else result.ai='غير مفعّل';
 if(config.databaseUrl) try {await workspaceDb(config.databaseUrl);result.database='متصل';}catch{result.database='تعذر الاتصال؛ راجع رابط Neon وصلاحيات إنشاء الجداول';}
 else result.database='غير مفعّل';
 return Response.json(result);
}catch(e){return errorResponse(e);}}
