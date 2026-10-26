process.on('uncaughtException',error=>{console.error('Password initialization failed: '+(error instanceof Error?error.name:'OperationError'));process.exit(1);});
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {randomBytes,randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {resolve,dirname} from 'node:path';
import ts from 'typescript';
const root=resolve('.'),output=resolve('work/password-tools');
const local={};
try{for(const line of (await readFile(resolve('.env.local'),'utf8')).split(/\r?\n/)){const match=line.match(/^([A-Z_0-9]+)=(.*)$/);if(!match)continue;let value=match[2].trim();try{value=JSON.parse(value);}catch{value=value.replace(/^['"]|['"]$/g,'');}local[match[1]]=value;}}catch{}
const url=process.env.DATABASE_URL||local.DATABASE_URL;if(!url)throw new Error('DATABASE_URL is required to initialize login.');
for(const file of ['lib/password.ts','lib/auth-db.ts']){const target=resolve(output,file.replace(/\.ts$/,'.js'));await mkdir(dirname(target),{recursive:true});await writeFile(target,ts.transpileModule(await readFile(resolve(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText);}
await writeFile(resolve(output,'package.json'),'{"type":"commonjs"}');
const require=createRequire(import.meta.url),{hashPassword,verifyPassword}=require(resolve(output,'lib/password.js')),{passwordDatabase}=require(resolve(output,'lib/auth-db.js'));
const db=passwordDatabase(url),existing=await db.get();
if(existing){console.log('Login is already initialized. No password was changed.');process.exit(0);}
const legacy=process.argv.includes('--migrate-existing')?local.APP_PASSWORD:'';
const password=legacy||randomBytes(18).toString('base64url');
const passwordHash=await hashPassword(password);
const sessionVersion=randomUUID();
if(!await db.initialize({passwordHash,sessionVersion}))throw new Error('Login was initialized concurrently. No existing password was overwritten.');
const saved=await db.get();if(!saved||!await verifyPassword(password,saved.passwordHash))throw new Error('Password verification failed after initialization.');
await writeFile(resolve('../BEYOND-access.txt'),'Beyond — بيانات الدخول الخاصة\n\nكلمة مرور النظام الحالية:\n'+password+'\n\nيمكن تغييرها من الإعدادات > كلمة مرور النظام.\nلا ترفع هذا الملف إلى GitHub. بعد تغيير كلمة المرور يصبح هذا الملف قديمًا.\n','utf8');
for(const filename of ['.env.local','../BEYOND.vercel.env'])try{const text=await readFile(filename,'utf8');await writeFile(filename,text.split(/\r?\n/).filter(line=>!/^APP_PASSWORD=/.test(line)).join('\n'));}catch{}
console.log('Login initialized and verified in Neon. Access details were saved privately outside the repository. Environment password entries were removed.');
