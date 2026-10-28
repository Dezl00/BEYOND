import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDesktopToken,verifyDesktopToken,authorizeDesktop} from '../lib/desktop-auth';
import {readFileSync} from 'node:fs';
const secret='test-only-desktop-secret-'.repeat(3);
test('desktop token has fixed owner and limited audience, rejects tampering and expiry',()=>{
 const token=createDesktopToken(secret,Date.now()+60000,'test-installation');
 assert.deepEqual(verifyDesktopToken(token,secret),{owner:'beyond-owner',installation:'test-installation'});
 assert.throws(()=>verifyDesktopToken(token,secret+'changed'));
 assert.throws(()=>verifyDesktopToken(token+'x',secret));
 assert.throws(()=>verifyDesktopToken(token,secret,Date.now()+120000));
 assert.throws(()=>verifyDesktopToken('',secret));
 assert.throws(()=>verifyDesktopToken(token,''));
});
test('desktop endpoints require bearer authorization and reject browser cross-site requests',()=>{
 process.env.APP_ENCRYPTION_KEY=secret;
 const token=createDesktopToken(secret,Date.now()+60000,'cross-site-test');
 assert.throws(()=>authorizeDesktop(new Request('https://beyond.test/api/desktop/categories'),'categories'));
 assert.throws(()=>authorizeDesktop(new Request('https://beyond.test/api/desktop/categories',{headers:{Authorization:'Bearer '+token,Origin:'https://other.test'}}),'categories'));
 assert.equal(authorizeDesktop(new Request('https://beyond.test/api/desktop/categories',{headers:{Authorization:'Bearer '+token}}),'categories').owner,'beyond-owner');
});
test('desktop category repository has only a parameterized SELECT and never workspace migrations or writes',()=>{
 const text=readFileSync('lib/desktop-data.ts','utf8');
 assert.match(text,/SELECT data->'categories' AS categories FROM beyond_workspaces WHERE owner_id=\$1/);
 assert.doesNotMatch(text,/\b(?:INSERT|UPDATE|DELETE|CREATE|ALTER)\b|workspaceDb|readWorkspace|writeWorkspace/);
});
test('desktop requests never accept a database URL or Gemini key from the client',()=>{
 for(const file of ['categories','extract','export/pdf','export/xlsx']){
  const text=readFileSync('app/api/desktop/'+file+'/route.ts','utf8');
  assert.doesNotMatch(text,/credentials\(|ownerId\(|writeWorkspace|readWorkspace|request\.headers\.get\(['"](?:database|gemini)/);
 }
});
