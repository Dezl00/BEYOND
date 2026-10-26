import {test,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {hashPassword,verifyPassword,createPasswordService,validateNewPassword} from '../lib/password';
import {resetAuth,currentRecord,passwordDatabase} from './mock-auth-db';
import {POST as login,DELETE as logout} from '../app/api/auth/route';
import {POST as change} from '../app/api/auth/password/route';
import {authenticatedToken,createSessionCookie,ownerId} from '../lib/server';
process.env.DATABASE_URL='postgresql://test-only';
process.env.APP_ENCRYPTION_KEY='unit-test-encryption-key-long-enough-2026';
process.env.APP_PASSWORD='obsolete-environment-value-must-be-ignored';
const original='initial test password 2026',replacement='new test password 2026';
const initialHash=hashPassword(original);
beforeEach(async()=>resetAuth({passwordHash:await initialHash,sessionVersion:'initial-version'}));
const token=(cookie:string)=>cookie.split(';')[0].slice('beyond_session='.length);
function request(path:string,body:unknown,cookie='',origin='https://beyond.example'){
 return new Request('https://beyond.example'+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,...(cookie?{Cookie:cookie.split(';')[0]}:{})},body:JSON.stringify(body)});
}
async function cookie(){return (await login(request('/api/auth',{password:original}))).headers.get('set-cookie')!;}
test('password hashes have random salts, verify correctly and never contain the password',async()=>{
 const first=await hashPassword(replacement),second=await hashPassword(replacement);
 assert.notEqual(first,second);assert.ok(!first.includes(replacement));assert.equal(await verifyPassword(replacement,first),true);assert.equal(await verifyPassword('wrong',first),false);
});
test('malformed hashes and excessive parameters are rejected without evaluation',async()=>{
 assert.equal(await verifyPassword(original,'scrypt$999999999$8$3$x$y'),false);assert.equal(await verifyPassword(original,'garbage'),false);
 assert.throws(()=>validateNewPassword('short'));assert.throws(()=>validateNewPassword('x'.repeat(129)));
});
test('login uses the stored hash and returns a protected session without secrets',async()=>{
 const response=await login(request('/api/auth',{password:original}));assert.equal(response.status,200);
 const setCookie=response.headers.get('set-cookie')!;for(const part of ['HttpOnly','SameSite=Strict','Secure'])assert.ok(setCookie.includes(part));
 assert.deepEqual(await response.json(),{ok:true});assert.equal(await authenticatedToken(token(setCookie),currentRecord),true);
});
test('environment password cannot log in and missing database record fails closed',async()=>{
 assert.equal((await login(request('/api/auth',{password:process.env.APP_PASSWORD}))).status,401);
 resetAuth(null);assert.equal((await login(request('/api/auth',{password:original}))).status,503);
 assert.equal(await authenticatedToken(undefined,null),false);
});
test('password change requires authentication',async()=>{
 assert.equal((await change(request('/api/auth/password',{currentPassword:original,newPassword:replacement,confirmPassword:replacement}))).status,401);
 assert.equal(currentRecord?.sessionVersion,'initial-version');
});
test('wrong current password and mismatched confirmation cannot change the password',async()=>{
 const session=await cookie();
 assert.equal((await change(request('/api/auth/password',{currentPassword:'wrong',newPassword:replacement,confirmPassword:replacement},session))).status,401);
 assert.equal((await change(request('/api/auth/password',{currentPassword:original,newPassword:replacement,confirmPassword:'different'},session))).status,400);
 assert.equal(currentRecord?.sessionVersion,'initial-version');
});
test('changing the password invalidates every old session and keeps the caller signed in',async()=>{
 const first=await cookie(),second=await createSessionCookie(true,'initial-version');
 const response=await change(request('/api/auth/password',{currentPassword:original,newPassword:replacement,confirmPassword:replacement},first));
 assert.equal(response.status,200);const fresh=response.headers.get('set-cookie')!;
 assert.equal(await authenticatedToken(token(first),currentRecord),false);assert.equal(await authenticatedToken(token(second),currentRecord),false);
 assert.equal(await authenticatedToken(token(fresh),currentRecord),true);
 assert.equal((await login(request('/api/auth',{password:original}))).status,401);
 assert.equal((await login(request('/api/auth',{password:replacement}))).status,200);
 await assert.rejects(ownerId(request('/api/settings',{},first)));
});
test('tampered sessions cannot authenticate',async()=>{
 const session=await cookie(),value=token(session);assert.equal(await authenticatedToken(value.slice(0,-5)+'xxxxx',currentRecord),false);
});
test('too many login attempts return 429 with a wait time',async()=>{
 for(let n=0;n<10;n++)assert.equal((await login(request('/api/auth',{password:'wrong password'}))).status,401);
 const response=await login(request('/api/auth',{password:original}));assert.equal(response.status,429);assert.equal(response.headers.get('retry-after'),'900');
 assert.equal(currentRecord?.sessionVersion,'initial-version');
});
test('cross-origin login and password changes are rejected',async()=>{
 assert.equal((await login(request('/api/auth',{password:original},'','https://other.example'))).status,403);
 const session=await cookie();assert.equal((await change(request('/api/auth/password',{currentPassword:original,newPassword:replacement,confirmPassword:replacement},session,'https://other.example'))).status,403);
});
test('compare-and-swap prevents concurrent password changes from silently overwriting each other',async()=>{
 const service=createPasswordService(passwordDatabase('test'));
 const results=await Promise.allSettled([service.change(original,replacement,'one'),service.change(original,'another password 2026','two')]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 assert.equal(results.filter(r=>r.status==='rejected').length,1);
});
test('logout expires both authentication and connection cookies',async()=>{
 const response=await logout(new Request('https://beyond.example/api/auth',{method:'DELETE',headers:{Origin:'https://beyond.example'}}));
 assert.equal(response.status,200);const header=response.headers.get('set-cookie')!;assert.ok(header.includes('beyond_session=;'));assert.ok(header.includes('beyond_config=;'));assert.ok(header.includes('Max-Age=0'));
});
