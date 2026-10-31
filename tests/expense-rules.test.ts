import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolveExpenseRule} from '../lib/expense-rules';
import {extractInvoice} from '../lib/extract-invoice';
const categories=[{code:'410514000000',name:'مصاريف تشغيل'},{code:'410403000000',name:'قرطاسية تشغيلي'},{code:'410510000000',name:'محروقات'},{code:'other',name:'مواد كهرباء'}];
test('purchased food, beverages and drinking water use operating expenses',()=>{
 for(const item of ['وجبة غداء','مياه شرب','ماء 330 مل','قهوة وشاي','Food and drinks','Water bottles'])assert.equal(resolveExpenseRule([item],categories).category?.code,'410514000000',item);
});
test('printing and photocopying use the operational stationery account from the supplied chart',()=>{
 for(const item of ['طباعة مخططات','تصوير مستندات','خدمات الطباعة والتصوير','Photocopy A4'])assert.equal(resolveExpenseRule([item],categories).category?.code,'410403000000',item);
});
test('petrol and diesel use fuel, without confusing replacement parts or water pipes',()=>{
 for(const item of ['بنزين91','بنزين 95','Diesel fuel','ديزل'])assert.equal(resolveExpenseRule([item],categories).category?.code,'410510000000',item);
 for(const item of ['مواسير مياه','مضخة ماء','Water pipe','فلتر بنزين','طرمبة بنزين','fuel pump','مواد كهرباء'])assert.equal(resolveExpenseRule([item],categories).handled,false,item);
});
test('an applicable purchased item wins over unrelated items, while conflicting rules require review',()=>{
 assert.equal(resolveExpenseRule(['أسلاك','مياه شرب'],categories).category?.code,'410514000000');
 const mixed=resolveExpenseRule(['بنزين','تصوير مستندات'],categories);assert.equal(mixed.rule,'mixed');assert.equal(mixed.category,null);assert.ok(mixed.warning);
});
test('missing and ambiguous target accounts never invent a code',()=>{
 const missing=resolveExpenseRule(['بنزين'],[]);assert.equal(missing.category,null);assert.ok(missing.warning);
 const ambiguous=resolveExpenseRule(['مياه'],[categories[0],{code:'duplicate',name:'مصاريف التشغيل'}]);assert.equal(ambiguous.category,null);assert.ok(ambiguous.warning);
});
test('the server overrides handwritten classification only for explicit purchased item rules and keeps internal evidence private',async()=>{
 const original=globalThis.fetch;
 globalThis.fetch=async()=>Response.json({candidates:[{content:{parts:[{text:JSON.stringify({number:'050',date:'2026-10-31',supplier:'مورد',description:'فاتورة',categoryCode:'other',handwrittenCategory:'مواد كهرباء',handwrittenCategoryCode:'other',subtotalBeforeTax:100,vatAmount:15,totalIncludingTax:115,taxIdentifiers:['311354415900003'],lineItemDescriptions:['بنزين 95'],warnings:[]})}]}}]});
 try{
  const result=await extractInvoice(new File(['image'],'invoice.jpg',{type:'image/jpeg'}),categories,{keys:['test-key'],model:'gemini-2.5-flash'},true);
  assert.equal(result.categoryCode,'410510000000');assert.equal(result.automaticCategoryRule,'fuel');assert.equal(result.companyTaxIdPresent,true);
  assert.ok(!('lineItemDescriptions' in result));assert.ok(!('taxIdentifiers' in result));
 }finally{globalThis.fetch=original;}
});
