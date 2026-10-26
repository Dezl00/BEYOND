import {ApiError,createSessionCookie,errorResponse,passwordService,authBucket,protectOrigin} from '@/lib/server';
import {z} from 'zod';
export const runtime='nodejs';
export async function POST(request:Request){try{
 protectOrigin(request);
 const input=z.object({password:z.string().min(1).max(128)}).safeParse(await request.json());
 if(!input.success)throw new ApiError('كلمة المرور غير صحيحة.',401);
 const version=await passwordService().login(input.data.password,authBucket(request,'login'));
 return Response.json({ok:true},{headers:{'Set-Cookie':await createSessionCookie(new URL(request.url).protocol==='https:',version),'Cache-Control':'no-store'}});
}catch(error){return errorResponse(error);}}
export async function DELETE(request:Request){try{
 protectOrigin(request);const headers=new Headers({'Cache-Control':'no-store'});
 for(const name of ['beyond_session','beyond_config'])headers.append('Set-Cookie',name+'=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'+(new URL(request.url).protocol==='https:'?'; Secure':''));
 return Response.json({ok:true},{headers});
}catch(error){return errorResponse(error);}}
