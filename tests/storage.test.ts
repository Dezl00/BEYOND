import {test,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {database} from './mock-kv';
import {stageSource,clearStagedSources,loadSource,persistImportedSources,discardOldUploads,loadWorkspace,saveWorkspace} from '../lib/storage';
import {testInvoices,testCategories} from './fixtures/invoices';
import {emptyWorkspace} from '../lib/domain';
const source=()=>({bytes:new Uint8Array([1,2,3]).buffer,mime:'image/png',name:'invoice.png',expiresAt:Date.now()+100000});
beforeEach(()=>{database.clear();clearStagedSources();});
test('upload and preview remain in memory without writing invoice records or sources',async()=>{
 stageSource('pending',source());
 assert.ok(await loadSource('pending'));
 assert.equal(database.size,0);
 clearStagedSources();
 assert.equal(await loadSource('pending'),null);
 assert.equal(database.size,0);
});
test('only explicitly imported source IDs become persistent',async()=>{
 stageSource('imported',source());stageSource('discarded',source());
 await persistImportedSources(['imported'],24);clearStagedSources();
 assert.ok(await loadSource('imported'));assert.equal(await loadSource('discarded'),null);
 assert.deepEqual([...database.keys()],['source:imported']);
});
test('old queues, previewed drafts and their originals are deleted while imported originals survive',async()=>{
 database.set('beyond-pending',[{id:'pending'}]);database.set('beyond-queue',[{id:'pending'}]);
 database.set('source:pending',source());database.set('source:imported',source());
 await discardOldUploads(['imported']);
 assert.deepEqual([...database.keys()],['source:imported']);
});
test('saving preferences cannot persist unimported invoices',async()=>{
 await saveWorkspace({...structuredClone(emptyWorkspace),categories:testCategories,invoices:[testInvoices[0],{...testInvoices[0],id:'previewed',status:'review'}]});
 const saved=database.get('beyond-workspace-v1');
 assert.deepEqual(saved.invoices.map((i:{id:string})=>i.id),[testInvoices[0].id]);
});
test('loading old stored drafts removes them permanently without changing imported invoice amounts',async()=>{
 database.set('beyond-workspace-v1',{...structuredClone(emptyWorkspace),schemaVersion:3,categories:testCategories,invoices:[testInvoices[0],{...testInvoices[0],id:'old-draft',status:'review'}]});
 const saved=await loadWorkspace();
 assert.equal(saved.schemaVersion,4);assert.equal(saved.invoices.length,1);
 assert.equal(saved.invoices[0].netCents,100000);assert.equal(saved.invoices[0].taxCents,15000);
 assert.equal(database.get('beyond-workspace-v1').invoices.length,1);
});
