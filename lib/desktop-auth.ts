import {createHmac,timingSafeEqual} from 'node:crypto';
import {ApiError,protectOrigin} from './server';
const audience='beyond.windows.ephemeral.v1';
function signature(payload:string,secret:string){return createHmac('sha256',secret).update(audience+':'+payload).digest();}
export function createDesktopToken(secret:string,expires:number,installation:string,manageAccounts=false){
 if(secret.length<32)throw new Error('Server encryption key is required');
 const payload=Buffer.from(JSON.stringify({aud:audience,owner:'beyond-owner',exp:expires,installation,...(manageAccounts?{manageAccounts:true}:{})})).toString('base64url');
 return payload+'.'+signature(payload,secret).toString('base64url');
}
export function verifyDesktopToken(token:string,secret:string,now=Date.now()){
 if(secret.length<32||token.length>2048)throw new ApiError('تعذر التحقق من ربط البرنامج.',401);
 try{
  const parts=token.split('.');if(parts.length!==2)throw new Error();
  const expected=signature(parts[0],secret),actual=Buffer.from(parts[1],'base64url');
  if(actual.length!==expected.length||!timingSafeEqual(expected,actual))throw new Error();
  const claims=JSON.parse(Buffer.from(parts[0],'base64url').toString('utf8'));
  if(claims.aud!==audience||claims.owner!=='beyond-owner'||!Number.isSafeInteger(claims.exp)||claims.exp<=now||typeof claims.installation!=='string'||!claims.installation)throw new Error();
  return {owner:'beyond-owner',installation:claims.installation as string,...(claims.manageAccounts===true?{manageAccounts:true}:{})};
 }catch{throw new ApiError('انتهت صلاحية ربط البرنامج أو بيانات الربط غير صالحة.',401);}
}
const windows=new Map<string,{start:number;count:number}>();
export function authorizeDesktop(request:Request,scope:'categories'|'accounts-write'|'extract'|'export'){
 protectOrigin(request);
 const token=request.headers.get('authorization')?.match(/^Bearer (\S+)$/)?.[1]||'';
 const claims=verifyDesktopToken(token,process.env.APP_ENCRYPTION_KEY||'');
 if(scope==='accounts-write'&&!('manageAccounts' in claims))throw new ApiError('هذه النسخة لا تملك صلاحية تعديل الحسابات. استخدم الإصدار الجديد.',403);
 const now=Date.now(),windowMs=60000;
 for(const [key,value] of windows)if(now-value.start>=windowMs)windows.delete(key);
 const key=claims.installation+':'+scope,limit=scope==='extract'?60:scope==='export'?20:60;
 const value=windows.get(key)||{start:now,count:0};
 if(value.count>=limit)throw new ApiError('طلبات متتابعة كثيرة. انتظر دقيقة ثم أعد المحاولة.',429);
 value.count++;windows.set(key,value);return claims;
}
