import {randomBytes,randomUUID,scrypt,timingSafeEqual} from 'node:crypto';
export type PasswordRecord={passwordHash:string;sessionVersion:string};
export type PasswordStore={
 get:()=>Promise<PasswordRecord|null>;
 replace:(expectedVersion:string,passwordHash:string,sessionVersion:string)=>Promise<boolean>;
 reserveAttempt:(bucket:string)=>Promise<boolean>;
 clearAttempts:(bucket:string)=>Promise<void>;
};
export class PasswordError extends Error{
 constructor(message:string,public status=400,public retryAfter?:number){super(message);}
}
const options={N:32768,r:8,p:3,maxmem:64*1024*1024};
function derive(password:string,salt:Buffer){
 return new Promise<Buffer>((resolve,reject)=>scrypt(password,salt,64,options,(error,key)=>error?reject(error):resolve(key)));
}
export function validateNewPassword(password:string){
 if(password.length<12||password.length>128)throw new PasswordError('استخدم كلمة مرور من 12 إلى 128 حرفًا.');
}
export async function hashPassword(password:string){
 validateNewPassword(password);const salt=randomBytes(16),key=await derive(password,salt);
 return ['scrypt',options.N,options.r,options.p,salt.toString('base64url'),key.toString('base64url')].join('$');
}
export async function verifyPassword(password:string,encoded:string){
 if(password.length<1||password.length>128)return false;
 const parts=encoded.split('$');
 if(parts.length!==6||parts[0]!=='scrypt'||parts[1]!==String(options.N)||parts[2]!==String(options.r)||parts[3]!==String(options.p))return false;
 try{const salt=Buffer.from(parts[4],'base64url'),expected=Buffer.from(parts[5],'base64url');if(salt.length!==16||expected.length!==64)return false;return timingSafeEqual(await derive(password,salt),expected);}catch{return false;}
}
export function createPasswordService(store:PasswordStore){
 async function attempt(bucket:string){
  if(!await store.reserveAttempt(bucket))throw new PasswordError('محاولات كثيرة. انتظر 15 دقيقة ثم حاول مرة أخرى.',429,900);
 }
 return {
  async login(password:string,bucket:string){
   await attempt(bucket);const record=await store.get();
   if(!record)throw new PasswordError('لم تُجهّز كلمة مرور مساحة العمل بعد.',503);
   if(!await verifyPassword(password,record.passwordHash))throw new PasswordError('كلمة المرور غير صحيحة.',401);
   await store.clearAttempts(bucket);return record.sessionVersion;
  },
  async change(currentPassword:string,newPassword:string,bucket:string){
   validateNewPassword(newPassword);
   if(currentPassword===newPassword)throw new PasswordError('اختر كلمة مرور جديدة مختلفة عن الحالية.');
   await attempt(bucket);const record=await store.get();
   if(!record)throw new PasswordError('لم تُجهّز كلمة مرور مساحة العمل بعد.',503);
   if(!await verifyPassword(currentPassword,record.passwordHash))throw new PasswordError('كلمة المرور الحالية غير صحيحة.',401);
   const sessionVersion=randomUUID(),passwordHash=await hashPassword(newPassword);
   if(!await store.replace(record.sessionVersion,passwordHash,sessionVersion))throw new PasswordError('تغيّرت كلمة المرور من نافذة أخرى. سجّل الدخول مجددًا.',409);
   await store.clearAttempts(bucket);return sessionVersion;
  }
 };
}
