import {test} from 'node:test';
import assert from 'node:assert/strict';
import {taxFromInclusive,allocatedTaxes,totals,invoiceProblems,duplicateCandidates,exportRows,parseCategories,cleanWorkspace,emptyWorkspace} from '../lib/domain';
import {testInvoices,testCategories} from './fixtures/invoices';
test('15% tax is extracted from gross, not multiplied by gross',()=>{assert.equal(taxFromInclusive(115000),15000);assert.equal(taxFromInclusive(11500),1500);});
test('line tax allocation preserves invoice tax down to the halala',()=>{for(let size=1;size<=25;size++){const items=Array.from({length:size},(_,i)=>({id:String(i),description:'بند',quantity:1,grossCents:(i+1)*397,categoryCode:'A'}));assert.equal(allocatedTaxes(items).reduce((s,n)=>s+n,0),taxFromInclusive(items.reduce((s,l)=>s+l.grossCents,0)));}});
test('line export never repeats full invoice gross on each item',()=>{const rows=exportRows([testInvoices[0]],testCategories);assert.equal(rows.length,2);assert.equal(rows.reduce((s,r)=>s+Math.round(r.gross*100),0),92000);assert.equal(totals([testInvoices[0]]).gross,92000);});
test('incomplete or uncategorized invoice cannot be approved',()=>{const i=structuredClone(testInvoices[0]);i.employee='';i.items[0].categoryCode='UNKNOWN';const errors=invoiceProblems(i,testCategories);assert.ok(errors.some(e=>e.includes('العهدة')));assert.ok(errors.some(e=>e.includes('تصنيف')));});
test('mismatched printed invoice totals are flagged',()=>{const i=structuredClone(testInvoices[0]);i.reportedTotalCents=100;assert.ok(invoiceProblems(i,testCategories).some(e=>e.includes('مجموع البنود')));});
test('invalid calendar dates are rejected',()=>{const i=structuredClone(testInvoices[0]);i.date='2026-02-31';assert.ok(invoiceProblems(i,testCategories).some(e=>e.includes('تاريخ')));});
test('duplicate detection catches another scan and excludes the same record',()=>{const original=testInvoices[0];const duplicate={...structuredClone(original),id:'new-scan'};assert.equal(duplicateCandidates(duplicate,[original]).length,1);assert.equal(duplicateCandidates(original,[original]).length,0);});
test('codes preserve leading zeros and can be pasted from Excel',()=>{const cats=parseCategories('00101\tمواد كهرباء\n00102, مواد سباكة\n00101, مكرر');assert.deepEqual(cats,[{code:'00101',name:'مواد كهرباء'},{code:'00102',name:'مواد سباكة'}]);});

test('empty workspace has no invoices, categories, expenses, or tax',()=>{
 assert.equal(emptyWorkspace.invoices.length,0);assert.equal(emptyWorkspace.categories.length,0);
 assert.deepEqual(totals(emptyWorkspace.invoices),{gross:0,tax:0,net:0,items:0});
});
test('legacy demo records are removed while real invoices and settings are preserved',()=>{
 const actual=structuredClone(testInvoices[0]);
 const oldFlag={...structuredClone(actual),id:'legacy-placeholder',demo:true};
 const oldId={...structuredClone(actual),id:'demo-0'};
 const state={...structuredClone(emptyWorkspace),invoices:[oldFlag,actual,oldId],categories:testCategories,revision:8};
 const result=cleanWorkspace(state);
 assert.deepEqual(result.invoices,[actual]);assert.deepEqual(result.categories,testCategories);assert.equal(result.revision,8);
 assert.equal(state.invoices.length,3);
});
