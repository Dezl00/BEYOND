import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createGeminiClient,parseGeminiKeys,resolveGeminiKeys} from '../lib/gemini';
const keys=['test-key-one','test-key-two','test-key-three'];
const ok=()=>Response.json({candidates:[{content:{parts:[{text:'invoice result'}]}}]});
const limited=(headers:Record<string,string>={},details:unknown[]=[])=>Response.json({error:{status:'RESOURCE_EXHAUSTED',details}},{status:429,headers});
function setup(replies:Response[],clock={value:100000}){
 const calls:{key:string|null;body:BodyInit|null|undefined;signal:AbortSignal|null|undefined;url:string}[]=[];
 const request=createGeminiClient({now:()=>clock.value,fetcher:async(url,init)=>{calls.push({key:new Headers(init?.headers).get('x-goog-api-key'),body:init?.body,signal:init?.signal,url:String(url)});const response=replies.shift();assert.ok(response,'Unexpected extra Gemini request');return response;}});
 return {request,calls,clock};
}
test('one variable accepts comma, newline, Arabic comma and removes duplicates',()=>{
 assert.deepEqual(parseGeminiKeys(' key1,key2\nkey1،key3;key4 '),['key1','key2','key3','key4']);
});
test('new environment pool overrides legacy single-key cookies',()=>{
 assert.deepEqual(resolveGeminiKeys({GEMINI_API_KEYS:'one,two',GEMINI_API_KEY:'old'},{key:'stale'}),['one','two']);
});
test('explicit new settings can override the server pool',()=>{
 assert.deepEqual(resolveGeminiKeys({GEMINI_API_KEYS:'one,two'},{keys:['three','four']}),['three','four']);
});
test('legacy environment and backup keys remain usable during deployment',()=>{
 assert.deepEqual(resolveGeminiKeys({GEMINI_API_KEY:'one',GEMINI_API_KEY_BACKUP_2:'three',GEMINI_API_KEY_BACKUP_1:'two'}),['one','two','three']);
});
test('empty new variable falls back to the existing single key',()=>{
 assert.deepEqual(resolveGeminiKeys({GEMINI_API_KEYS:' ',GEMINI_API_KEY:'one'}),['one']);
 assert.deepEqual(resolveGeminiKeys({}),[]);
});
test('429 switches automatically and resends exactly the same invoice once',async()=>{
 const {request,calls}=setup([limited(),ok()]);
 const signal=AbortSignal.timeout(5000),body=JSON.stringify({invoice:'same invoice'});
 const response=await request(keys,'gemini-test',{method:'POST',headers:{'Content-Type':'application/json'},body,signal});
 assert.equal(response.status,200);
 assert.deepEqual(calls.map(c=>c.key),keys.slice(0,2));
 assert.ok(calls.every(c=>c.body===body&&c.signal===signal));
 assert.ok(calls.every(c=>!c.url.includes('test-key')));
});
test('the working key remains active on subsequent invoices',async()=>{
 const {request,calls}=setup([limited(),ok(),ok()]);
 await request(keys,'gemini-test');await request(keys,'gemini-test');
 assert.deepEqual(calls.map(c=>c.key),[keys[0],keys[1],keys[1]]);
});
test('all exhausted keys return safe 429 without leaking provider errors',async()=>{
 const {request,calls}=setup([limited({'Retry-After':'120'}),limited({'Retry-After':'90'}),limited({'Retry-After':'30'})]);
 const response=await request(keys,'gemini-test');
 assert.equal(response.status,429);assert.equal(response.headers.get('Retry-After'),'30');
 assert.equal(calls.length,3);
 const text=await response.text();assert.ok(keys.every(key=>!text.includes(key)));
 const again=await request(keys,'gemini-test');assert.equal(again.status,429);assert.equal(calls.length,3);
});
test('provider RetryInfo is respected and keys are reusable after cooldown',async()=>{
 const {request,calls,clock}=setup([limited({},[{'@type':'type.googleapis.com/google.rpc.RetryInfo',retryDelay:'12.5s'}]),ok()]);
 const first=await request([keys[0]],'gemini-test');assert.equal(first.headers.get('Retry-After'),'13');
 clock.value+=12000;await request([keys[0]],'gemini-test');assert.equal(calls.length,1);
 clock.value+=501;assert.equal((await request([keys[0]],'gemini-test')).status,200);
});
test('Retry-After HTTP date is respected',async()=>{
 const {request}=setup([limited({'Retry-After':new Date(160000).toUTCString()})]);
 assert.equal((await request([keys[0]],'gemini-test')).headers.get('Retry-After'),'60');
});
test('expired cooldown does not cause attempts on every key',async()=>{
 const {request,calls,clock}=setup([limited({'Retry-After':'1'}),ok()]);
 await request([keys[0]],'gemini-test');clock.value+=1001;
 assert.equal((await request([keys[0]],'gemini-test')).status,200);assert.equal(calls.length,2);
});
test('input, permission, billing and model errors are returned without switching keys',async()=>{
 for(const status of [400,401,402,403,404,500,503]){
  const {request,calls}=setup([Response.json({error:'provider error'},{status})]);
  assert.equal((await request(keys,'gemini-test')).status,status);assert.equal(calls.length,1);
 }
});
test('a timeout or cancellation does not submit the invoice to another key',async()=>{
 let calls=0;
 const request=createGeminiClient({fetcher:async()=>{calls++;throw new DOMException('Timed out','TimeoutError');}});
 await assert.rejects(request(keys,'gemini-test'),{name:'TimeoutError'});assert.equal(calls,1);
 const controller=new AbortController();controller.abort();
 await assert.rejects(request(keys,'gemini-test',{signal:controller.signal}),{name:'AbortError'});assert.equal(calls,1);
});
test('duplicate keys are attempted only once and a different model has its own cooldown',async()=>{
 const {request,calls}=setup([limited(),ok()]);
 await request([keys[0],keys[0]],'gemini-one');
 assert.equal(calls.length,1);
 assert.equal((await request([keys[0]],'gemini-two')).status,200);
});
test('connection check uses the same pool without exposing a key in the URL',async()=>{
 const {request,calls}=setup([limited(),ok()]);
 await request(keys,'gemini-test',{},'model');
 assert.ok(calls.every(c=>c.url.endsWith('/gemini-test')));
 assert.deepEqual(calls.map(c=>c.key),keys.slice(0,2));
});
test('missing keys fail locally without contacting Gemini',async()=>{
 const {request,calls}=setup([]);
 await assert.rejects(request([],'gemini-test'),/not configured/);assert.equal(calls.length,0);
});

test('legacy cookie cannot hide configured backup keys during upgrade',()=>{
 assert.deepEqual(resolveGeminiKeys({GEMINI_API_KEY:'one',GEMINI_API_KEY_BACKUP_1:'two'},{key:'stale'}),['one','two']);
 assert.deepEqual(resolveGeminiKeys({},{key:'saved'}),['saved']);
});
