import {test} from 'node:test';
import assert from 'node:assert/strict';
import {accountChangeSchema,changeDesktopAccounts,mergeAccounts} from '../lib/desktop-accounts';
import {categoryEtag} from '../lib/category-response';
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

test('editing both account code and name remaps invoice references in the same commit',async()=>{
 let mapping:Record<string,string>|undefined;
 const categories=[{code:'001',name:'قديم'}];
 const result=await changeDesktopAccounts({read:async()=>({revision:2,categories,usage:{'001':3}}),commit:async(revision,next,remaps)=>{assert.equal(revision,2);mapping=remaps;return true;}},{action:'update',previous:categories[0],category:{code:'0002',name:'جديد'}});
 assert.deepEqual(result,[{code:'0002',name:'جديد'}]);assert.deepEqual(mapping,{'001':'0002'});
 assert.throws(()=>mergeAccounts([...categories,{code:'0002',name:'موجود'}],{action:'update',previous:categories[0],category:{code:'0002',name:'آخر'}}),{status:409});
});
test('deleting an account used by saved invoices requires a valid replacement',async()=>{
 const categories=[{code:'001',name:'قديم'},{code:'002',name:'بديل'}];let writes=0;
 const repository={read:async()=>({revision:1,categories,usage:{'001':1}}),commit:async(revision:number,next:typeof categories,remaps?:Record<string,string>)=>{writes++;assert.deepEqual(remaps,{'001':'002'});return true;}};
 await assert.rejects(()=>changeDesktopAccounts(repository,{action:'delete',category:categories[0]}),{status:409});assert.equal(writes,0);
 assert.deepEqual(await changeDesktopAccounts(repository,{action:'delete',category:categories[0],replacementCode:'002'}),[categories[1]]);assert.equal(writes,1);
 assert.throws(()=>mergeAccounts(categories,{action:'delete',category:categories[0],replacementCode:'001'}));
});
test('catalog replacement removes old accounts, retains every supplied account and protects concurrent changes',async()=>{
 const categories=[{code:'old',name:'قديم'}],next=[{code:'00001',name:'أ'},{code:'00002',name:'ب'}];
 let committed=false;
 const repository={read:async()=>({revision:4,categories,usage:{}}),commit:async(revision:number,result:typeof next)=>{assert.deepEqual(result,next);committed=true;return true;}};
 await assert.rejects(()=>changeDesktopAccounts(repository,{action:'replace',categories:next,expectedEtag:'stale'}),{status:409});assert.equal(committed,false);
 assert.deepEqual(await changeDesktopAccounts(repository,{action:'replace',categories:next,expectedEtag:categoryEtag(categories)}),next);assert.equal(committed,true);
 assert.throws(()=>mergeAccounts(categories,{action:'replace',categories:[next[0],next[0]],expectedEtag:categoryEtag(categories)}));
});
test('catalog replacement cannot orphan invoice accounts and rejects invalid remappings',async()=>{
 const categories=[{code:'old',name:'قديم'}];const repository={read:async()=>({revision:1,categories,usage:{old:1}}),commit:async()=>true};
 const change={action:'replace' as const,categories:[{code:'new',name:'جديد'}],expectedEtag:categoryEtag(categories)};
 await assert.rejects(()=>changeDesktopAccounts(repository,change),{status:409});
 await assert.rejects(()=>changeDesktopAccounts(repository,{...change,replacements:{old:'missing'}}));
 assert.deepEqual(await changeDesktopAccounts(repository,{...change,replacements:{old:'new'}}),change.categories);
});
