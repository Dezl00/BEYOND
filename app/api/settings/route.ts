import {z} from 'zod';
import {ApiError,credentials,encryptedCookie,errorResponse,ownerId,protectOrigin,validateDatabaseUrl} from '@/lib/server';
import {parseGeminiKeys} from '@/lib/gemini';
export async function GET(request:Request){try{
 const owner=await ownerId(request);const c=await credentials(request,owner);
 return Response.json({aiConfigured:!!c.keys.length,aiKeyCount:c.keys.length,databaseConfigured:!!c.databaseUrl,model:c.model},{headers:{'Cache-Control':'no-store'}});
}catch(e){return errorResponse(e);}}
export async function POST(request:Request){try{
 protectOrigin(request);const owner=await ownerId(request);const current=await credentials(request,owner);
 const parsed=z.object({apiKeys:z.string().max(3000).optional(),apiKey:z.string().max(3000).optional(),databaseUrl:z.string().max(3000).optional(),model:z.string().max(80).optional()}).safeParse(await request.json());
 if(!parsed.success)throw new ApiError('إعدادات غير صالحة.');
 const body=parsed.data,input=(body.apiKeys??body.apiKey)?.trim(),keys=input?parseGeminiKeys(input):current.keys;
 if(keys.length>10||keys.some(key=>key.length<20||key.length>300||!/^[a-zA-Z0-9_.-]+$/.test(key)))throw new ApiError('أدخل حتى 10 مفاتيح Gemini صحيحة، مفصولة بفواصل.');
 const next={...current,keys,databaseUrl:body.databaseUrl?.trim()||current.databaseUrl,model:body.model||current.model};
 if(next.databaseUrl)validateDatabaseUrl(next.databaseUrl);
 if(!/^gemini-[a-z0-9.-]{3,70}$/.test(next.model))throw new ApiError('اسم نموذج Gemini غير صالح.');
 const cookie=await encryptedCookie(next,new URL(request.url).protocol==='https:');
 if(cookie.length>4000)throw new ApiError('الإعدادات أكبر من حجم الحفظ المتاح. ضع المفاتيح في متغير GEMINI_API_KEYS على الخادم.');
 return Response.json({ok:true,aiConfigured:!!next.keys.length,aiKeyCount:next.keys.length,databaseConfigured:!!next.databaseUrl,model:next.model},{headers:{'Set-Cookie':cookie,'Cache-Control':'no-store'}});
}catch(e){return errorResponse(e);}}
