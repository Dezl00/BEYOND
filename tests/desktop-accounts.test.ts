import {test} from 'node:test';
import assert from 'node:assert/strict';
import {accountChangeSchema,changeDesktopAccounts,mergeAccounts} from '../lib/desktop-accounts';
import {authorizeDesktop,createDesktopToken} from '../lib/desktop-auth';

test('legacy desktop tokens cannot write accounts, newly granted tokens can',()=>{
 const secret='account-scope-test-secret-'.repeat(3);process.env.APP_ENCRYPTION_KEY=secret;
 const request=(token:string)=>new Request('https://beyond.test/api/desktop/categories',{headers:{Authorization:'Bearer '+token}});
 assert.throws(()=>authorizeDesktop(request(createDesktopToken(secret,Date.now()+60000,'old')),'accounts-write'),{status:403});
 assert.equal(authorizeDesktop(request(createDesktopToken(secret,Date.now()+60000,'new',true)),'accounts-write').owner,'beyond-owner');
});
test('adding accounts preserves leading zeros and rejects different names for an existing code',()=>{
 const existing=[{code:'005101',name:'كهرباء'}];
 const result=mergeAccounts(existing,{action:'add',categories:[{code:'005102',name:'سباكة'}]});
 assert.deepEqual(result.map(c=>c.code),['005101','005102']);assert.equal(existing.length,1);
 assert.throws(()=>mergeAccounts(existing,{action:'add',categories:[{code:'005101',name:'اسم مختلف'}]}),{status:409});
 assert.throws(()=>mergeAccounts(existing,{action:'add',categories:[{code:'2',name:'أ'},{code:'2',name:'ب'}]}));
});
test('retrying a completed account addition is idempotent',async()=>{
 let writes=0;
 const categories=[{code:'001',name:'مكتب'}];
 const result=await changeDesktopAccounts({read:async()=>({revision:3,categories}),commit:async()=>{writes++;return true;}},{action:'add',categories});
 assert.deepEqual(result,categories);assert.equal(writes,0);
});
test('concurrent additions merge after a revision conflict without dropping other accounts',async()=>{
 let revision=0,categories=[{code:'01',name:'أ'}];let attempts=0;
 const result=await changeDesktopAccounts({read:async()=>({revision,categories}),commit:async(expected,next)=>{
  attempts++;if(attempts===1){categories=[...categories,{code:'02',name:'من الويب'}];revision++;return false;}
  assert.equal(expected,revision);categories=next;revision++;return true;
 }},{action:'add',categories:[{code:'03',name:'من الويندوز'}]});
 assert.deepEqual(result.map(c=>c.code),['01','02','03']);assert.equal(attempts,2);
});
test('renaming preserves the account code and rejects stale changes',()=>{
 const current=[{code:'0004',name:'قديم'}];
 assert.deepEqual(mergeAccounts(current,{action:'rename',code:'0004',name:'جديد',previousName:'قديم'}),[{code:'0004',name:'جديد'}]);
 assert.throws(()=>mergeAccounts(current,{action:'rename',code:'0004',name:'آخر',previousName:'اسم قديم آخر'}),{status:409});
});
test('account requests cannot include invoices, extra fields, empty names or oversized batches',()=>{
 assert.equal(accountChangeSchema.safeParse({action:'add',categories:[{code:'001',name:'حساب'}],invoices:[]}).success,false);
 assert.equal(accountChangeSchema.safeParse({action:'add',categories:[{code:'001',name:' ' }]}).success,false);
 assert.equal(accountChangeSchema.safeParse({action:'add',categories:Array.from({length:101},(_,i)=>({code:String(i),name:'حساب'}))}).success,false);
});
