import {credentials,errorResponse,ownerId,protectOrigin,workspaceDb,ApiError} from '@/lib/server';
export async function POST(request:Request){try{
 protectOrigin(request);const owner=await ownerId(request);const config=await credentials(request,owner);
 const result:{ai?:string;database?:string}={};
 if(config.key){
  const r=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+config.model,{headers:{'x-goog-api-key':config.key},signal:AbortSignal.timeout(20000)});
  result.ai=r.ok?'متصل':'تعذر الاتصال؛ راجع المفتاح واسم النموذج';
 }else result.ai='غير مفعّل';
 if(config.databaseUrl) try {await workspaceDb(config.databaseUrl);result.database='متصل';}catch{result.database='تعذر الاتصال؛ راجع رابط Neon وصلاحيات إنشاء الجداول';}
 else result.database='غير مفعّل';
 return Response.json(result);
}catch(e){return errorResponse(e);}}
