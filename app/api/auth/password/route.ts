import {z} from 'zod';
import {ownerId,protectOrigin,errorResponse,createSessionCookie,passwordService,authBucket,ApiError} from '@/lib/server';
export const runtime='nodejs';
export async function POST(request:Request){try{
 protectOrigin(request);await ownerId(request);
 const input=z.object({currentPassword:z.string().min(1).max(128),newPassword:z.string().min(12).max(128),confirmPassword:z.string().max(128)}).safeParse(await request.json());
 if(!input.success)throw new ApiError('أكمل الحقول واستخدم كلمة مرور جديدة من 12 إلى 128 حرفًا.');
 if(input.data.newPassword!==input.data.confirmPassword)throw new ApiError('تأكيد كلمة المرور لا يطابق الكلمة الجديدة.');
 const version=await passwordService().change(input.data.currentPassword,input.data.newPassword,authBucket(request,'change'));
 return Response.json({ok:true},{headers:{'Set-Cookie':await createSessionCookie(new URL(request.url).protocol==='https:',version),'Cache-Control':'no-store'}});
}catch(error){return errorResponse(error);}}
