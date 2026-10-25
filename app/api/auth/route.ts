import {ApiError,authenticatedToken,createSessionCookie,errorResponse,passwordMatches,protectOrigin} from '@/lib/server';
import {z} from 'zod';
export async function POST(request:Request){try{
 protectOrigin(request);
 const input=z.object({password:z.string().min(1).max(500)}).safeParse(await request.json());
 if(!input.success||!await passwordMatches(input.data.password))throw new ApiError('كلمة المرور غير صحيحة.',401);
 return Response.json({ok:true},{headers:{'Set-Cookie':await createSessionCookie(new URL(request.url).protocol==='https:'),'Cache-Control':'no-store'}});
}catch(e){return errorResponse(e);}}
export async function DELETE(request:Request){try{
 protectOrigin(request);const headers=new Headers({'Cache-Control':'no-store'});
 for(const name of ['beyond_session','beyond_config'])headers.append('Set-Cookie',name+'=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'+(new URL(request.url).protocol==='https:'?'; Secure':''));
 return Response.json({ok:true},{headers});
}catch(e){return errorResponse(e);}}
