import {z} from 'zod';
import {ApiError,credentials,encryptedCookie,errorResponse,ownerId,protectOrigin,validateDatabaseUrl} from '@/lib/server';
export async function GET(request:Request){try{
 const owner=await ownerId(request);const c=await credentials(request,owner);
 return Response.json({aiConfigured:!!c.key,databaseConfigured:!!c.databaseUrl,model:c.model},{headers:{'Cache-Control':'no-store'}});
}catch(e){return errorResponse(e);}}
export async function POST(request:Request){try{
 protectOrigin(request);const owner=await ownerId(request);const current=await credentials(request,owner);
 const parsed=z.object({apiKey:z.string().max(300).optional(),databaseUrl:z.string().max(3000).optional(),model:z.string().max(80).optional()}).safeParse(await request.json());if(!parsed.success)throw new ApiError('إعدادات غير صالحة.');const body=parsed.data;
 if(body.apiKey!==undefined&&typeof body.apiKey!=='string') throw new ApiError('مفتاح غير صالح.');
 if(body.databaseUrl!==undefined&&typeof body.databaseUrl!=='string') throw new ApiError('رابط غير صالح.');
 const next={...current,key:body.apiKey?.trim()||current.key,databaseUrl:body.databaseUrl?.trim()||current.databaseUrl,model:body.model||current.model};
 if(next.key.length>300||next.key&&next.key.length<20) throw new ApiError('راجع مفتاح Gemini.');
 if(next.databaseUrl) validateDatabaseUrl(next.databaseUrl);
 if(!/^gemini-[a-z0-9.-]{3,70}$/.test(next.model)) throw new ApiError('اسم نموذج Gemini غير صالح.');
 const cookie=await encryptedCookie(next,new URL(request.url).protocol==='https:');
 return Response.json({ok:true,aiConfigured:!!next.key,databaseConfigured:!!next.databaseUrl,model:next.model},{headers:{'Set-Cookie':cookie,'Cache-Control':'no-store'}});
}catch(e){return errorResponse(e);}}
