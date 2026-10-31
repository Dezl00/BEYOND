import {extractInvoice} from '../lib/extract-invoice';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {COMPANY_TAX_ID,hasCompanyTaxIdentifier} from '../lib/company-tax';
import {amountsFromPrinted,editEntryAmount,exportRows,invoiceEntries,invoiceProblems,normalizeInvoice} from '../lib/domain';
import {invoiceSchema} from '../lib/schemas';
import {testInvoices,testCategories} from './fixtures/invoices';

const printed={reportedSubtotalCents:100000,reportedTaxCents:15000,reportedTotalCents:115000};
const grossOnly={...testInvoices[0],companyTaxIdPresent:false,...amountsFromPrinted(printed,false)};
test('company identifier is exact, accepts printed Arabic digits and rejects partial matches',()=>{
 assert.equal(COMPANY_TAX_ID,'311354415900003');
 const arabic=COMPANY_TAX_ID.replace(/[0-9]/g,c=>String.fromCharCode(1632+Number(c)));
 const persian=COMPANY_TAX_ID.replace(/[0-9]/g,c=>String.fromCharCode(1776+Number(c)));
 for(const value of [COMPANY_TAX_ID,arabic,persian,'311 354 415 900 003'])assert.equal(hasCompanyTaxIdentifier([value]),true,value);
 for(const value of ['0'+COMPANY_TAX_ID,COMPANY_TAX_ID+'0',COMPANY_TAX_ID.slice(0,-1),'31135441590003','300000000000003',''])assert.equal(hasCompanyTaxIdentifier([value]),false,value);
 assert.equal(hasCompanyTaxIdentifier([]),false);
});
test('missing company identifier creates one gross debit without a VAT label or extra row',()=>{
 assert.deepEqual([grossOnly.netCents,grossOnly.taxCents,grossOnly.grossCents],[115000,0,115000]);
 const entries=invoiceEntries([grossOnly]);assert.equal(entries.length,1);assert.equal(entries[0].kind,'gross');
 const rows=exportRows([grossOnly],testCategories);assert.equal(rows.length,1);assert.equal(rows[0].debit,1150);
 assert.equal(rows[0].account,'TEST-1');assert.equal(rows[0].analyticAccount,null);assert.equal(rows[0].credit,null);
 assert.ok(!rows[0].label.startsWith('قيمة مضافة'));
 assert.deepEqual(invoiceProblems(grossOnly,testCategories),[]);
});
test('gross-only treatment does not invent VAT when only a subtotal is printed',()=>{
 const amounts=amountsFromPrinted({reportedSubtotalCents:100000,reportedTaxCents:null,reportedTotalCents:null},false);
 assert.equal(amounts.grossCents,100000);assert.equal(amounts.taxCents,0);
 const withPrintedTax=amountsFromPrinted({...printed,reportedTotalCents:null},false);
 assert.equal(withPrintedTax.grossCents,115000);assert.equal(withPrintedTax.taxCents,0);
});
test('matching company invoices keep net and VAT rows and mixed exports contain three rows',()=>{
 const matching={...testInvoices[0],id:'matching',companyTaxIdPresent:true,...amountsFromPrinted(printed,true)};
 assert.deepEqual(exportRows([matching],testCategories).map(r=>r.debit),[1000,150]);
 assert.deepEqual(exportRows([grossOnly,matching],testCategories).map(r=>r.debit),[1150,1000,150]);
});
test('editing a gross-only amount never adds VAT back',()=>{
 const updated=editEntryAmount(grossOnly,'gross',200000);
 assert.deepEqual([updated.netCents,updated.taxCents,updated.grossCents],[200000,0,200000]);
 assert.equal(invoiceEntries([updated]).length,1);
});
test('company matching survives schema validation and normalization while legacy records are unchanged',()=>{
 assert.equal(invoiceSchema.parse(grossOnly).companyTaxIdPresent,false);
 const normalized=normalizeInvoice(grossOnly,testCategories);assert.equal(normalized.companyTaxIdPresent,false);assert.equal(normalized.taxCents,0);
 assert.equal(invoiceEntries([normalizeInvoice(testInvoices[0],testCategories)]).length,2);
});

test('invoice extraction matches printed evidence and does not expose tax identifiers as fields',async()=>{
 const original=globalThis.fetch;
 try{
  for(const [identifiers,expected] of [[[COMPANY_TAX_ID],true],[['300000000000003'],false],[[],false]] as const){
   globalThis.fetch=async(_url,options)=>{
    assert.ok(!String(options?.body).includes(COMPANY_TAX_ID),'The model must read evidence rather than echo a supplied company identifier');
    return Response.json({candidates:[{content:{parts:[{text:JSON.stringify({number:'0050',date:'2026-10-31',supplier:'مورد',description:'مشتريات',categoryCode:'TEST-1',handwrittenCategory:'',handwrittenCategoryCode:'',taxIdentifiers:identifiers,subtotalBeforeTax:1000,vatAmount:150,totalIncludingTax:1150,warnings:[]})}]}}]});
   };
   const result=await extractInvoice(new File([new Uint8Array([1,2,3])],'invoice.jpg',{type:'image/jpeg'}),testCategories,{keys:['mock-tax-test'],model:'mock-tax-model'},true);
   assert.equal(result.companyTaxIdPresent,expected);assert.ok(!('taxIdentifiers' in result));
  }
 }finally{globalThis.fetch=original;}
});
