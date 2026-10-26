import {test} from 'node:test';
import assert from 'node:assert/strict';
import {taxFromInclusive,taxFromExclusive,amountsFromPrinted,editInvoiceAmount,useSubtotalInsteadOfTotal,totals,invoiceProblems,invoiceAmountWarnings,duplicateCandidates,generalDescription,exportRows,parseCategories,cleanWorkspace,emptyWorkspace,normalizeInvoice,workspaceNeedsMigration,invoiceEntries,editEntryAmount} from '../lib/domain';
import {extractedSchema,workspaceSchema} from '../lib/schemas';
import {testInvoices,testCategories} from './fixtures/invoices';
const base=()=>structuredClone(testInvoices[0]);
const printed=(net:number|null,tax:number|null,gross:number|null)=>({reportedSubtotalCents:net,reportedTaxCents:tax,reportedTotalCents:gross});
test('inclusive 1150 has net 1000 and VAT 150',()=>{assert.equal(taxFromInclusive(115000),15000);assert.deepEqual(amountsFromPrinted(printed(null,null,115000)),{netCents:100000,taxCents:15000,grossCents:115000,amountSource:'gross_only'});});
test('before-tax 1000 adds VAT once to reach 1150',()=>{assert.equal(taxFromExclusive(100000),15000);assert.deepEqual(amountsFromPrinted(printed(100000,null,null)),{netCents:100000,taxCents:15000,grossCents:115000,amountSource:'derived_subtotal'});});
test('printed subtotal and VAT are added, never treated as an inclusive subtotal',()=>{const a=amountsFromPrinted(printed(100000,15000,null));assert.equal(a.netCents,100000);assert.equal(a.grossCents,115000);assert.equal(a.taxCents,15000);});
test('all three correct printed amounts are preserved',()=>{const a=amountsFromPrinted(printed(100000,15000,115000));assert.equal(a.netCents,100000);assert.equal(a.grossCents,115000);assert.equal(a.taxCents,15000);assert.equal(a.amountSource,'printed_total');});
test('a pre-tax subtotal misread as the final total is flagged without extracting VAT again',()=>{const a=amountsFromPrinted(printed(100000,15000,100000));assert.equal(a.netCents,100000);assert.equal(a.taxCents,15000);assert.equal(a.grossCents,115000);assert.equal(a.amountSource,'needs_review');assert.ok(invoiceProblems({...base(),...printed(100000,15000,100000),...a},testCategories).length);});
test('a mislabeled pre-tax total is detected even when subtotal is missing',()=>{const a=amountsFromPrinted(printed(null,15000,100000));assert.equal(a.grossCents,115000);assert.equal(a.netCents,100000);assert.equal(a.amountSource,'needs_review');});
test('confirming a read amount as pre-tax resolves the ambiguity',()=>{const i={...base(),...printed(null,15000,100000),...amountsFromPrinted(printed(null,15000,100000))};const fixed=useSubtotalInsteadOfTotal(i);assert.equal(fixed.grossCents,115000);assert.equal(fixed.reportedTotalCents,null);assert.equal(fixed.reportedSubtotalCents,100000);assert.deepEqual(invoiceProblems(fixed,testCategories),[]);});
test('small valid invoices do not falsely trigger subtotal-misread detection',()=>{assert.equal(amountsFromPrinted(printed(5,1,6)).amountSource,'printed_total');});
test('missing totals remain incomplete rather than fabricating a total',()=>{assert.deepEqual(amountsFromPrinted(printed(null,null,null)),{netCents:0,taxCents:0,grossCents:0,amountSource:'missing'});});
test('editing net adds VAT while editing final extracts VAT',()=>{const net=editInvoiceAmount(base(),'netCents',200000);assert.equal(net.grossCents,230000);assert.equal(net.taxCents,30000);const gross=editInvoiceAmount(base(),'grossCents',230000);assert.equal(gross.netCents,200000);assert.equal(gross.taxCents,30000);});
test('printed tax rounding is preserved with a visible warning instead of recomputing printed values',()=>{const i={...base(),...printed(100000,15005,115005),...amountsFromPrinted(printed(100000,15005,115005))};assert.equal(i.taxCents,15005);assert.deepEqual(invoiceProblems(i,testCategories),[]);assert.equal(invoiceAmountWarnings(i).length,1);});
test('contradictory printed amounts are blocked before approval',()=>{const i={...base(),...printed(90000,15000,115000),...amountsFromPrinted(printed(90000,15000,115000))};assert.ok(invoiceProblems(i,testCategories).some(p=>p.includes('قبل الضريبة')));});
test('each invoice exports net then VAT with identical metadata and one amount column',()=>{
 const rows=exportRows([base()],testCategories);
 assert.equal(rows.length,2);assert.deepEqual(rows.map(r=>r.amount),[1000,150]);
 const {amount:net,...first}=rows[0],{amount:vat,...second}=rows[1];assert.deepEqual(first,second);
 assert.deepEqual(Object.keys(rows[0]),['number','date','description','category','code','amount']);
});

test('aggregate totals count invoices and add invoice amounts once',()=>{assert.deepEqual(totals([base(),{...base(),id:'second'}]),{gross:230000,tax:30000,net:200000,invoices:2});});
test('legacy multiple items migrate to a general description without product names',()=>{const legacy={...base(),employee:'remove this',description:undefined,items:[{grossCents:69000,categoryCode:'TEST-1',description:'اسم منتج قديم 1',quantity:3},{grossCents:46000,categoryCode:'TEST-1',description:'اسم منتج قديم 2',quantity:2}]};const i=normalizeInvoice(legacy,testCategories);assert.equal(i.description,'مشتريات مواد كهرباء');assert.equal(i.grossCents,115000);assert.equal(i.taxCents,15000);assert.ok(!JSON.stringify(i).includes('اسم منتج'));assert.ok(!('items' in i));assert.ok(!('employee' in i));});
test('legacy invoices split across categories require an overall category',()=>{const legacy={...base(),items:[{grossCents:69000,categoryCode:'TEST-1'},{grossCents:46000,categoryCode:'TEST-2'}]};const i=normalizeInvoice(legacy,testCategories);assert.equal(i.description,'مشتريات متنوعة');assert.equal(i.categoryCode,'');assert.equal(i.status,'review');assert.equal(i.grossCents,115000);});
test('workspace migration removes obsolete fields and export columns and is idempotent',()=>{const old={...structuredClone(emptyWorkspace),schemaVersion:1,preferences:{...emptyWorkspace.preferences,employee:'obsolete',columns:['number','employee','quantity','description','gross']},invoices:[{...base(),employee:'obsolete',items:[{grossCents:115000,categoryCode:'TEST-1',description:'old item'}]}],categories:testCategories,revision:8};const clean=cleanWorkspace(old);assert.equal(clean.schemaVersion,4);assert.equal(clean.revision,8);assert.ok(!('employee' in clean.preferences));assert.ok(!('employee' in clean.invoices[0]));assert.deepEqual(clean.preferences.columns,['number','description','amount']);assert.equal(workspaceNeedsMigration(clean),false);assert.deepEqual(cleanWorkspace(clean),clean);assert.equal(old.preferences.employee,'obsolete');});
test('demo cleanup preserves real invoices and categories',()=>{const state={...structuredClone(emptyWorkspace),categories:testCategories,invoices:[{...base(),id:'demo-0'},base(),{...base(),id:'legacy',demo:true}]};const clean=cleanWorkspace(state);assert.deepEqual(clean.invoices,[base()]);assert.deepEqual(clean.categories,testCategories);});
test('blank workspace remains empty with no person field',()=>{assert.equal(emptyWorkspace.invoices.length,0);assert.equal(emptyWorkspace.categories.length,0);assert.deepEqual(totals([]),{gross:0,tax:0,net:0,invoices:0});assert.ok(!('employee' in emptyWorkspace.preferences));});
test('summary description and category are required, custodian is not',()=>{assert.deepEqual(invoiceProblems(base(),testCategories),[]);const i=base();i.description='';i.categoryCode='';const problems=invoiceProblems(i,testCategories);assert.ok(problems.some(p=>p.includes('وصف')));assert.ok(problems.some(p=>p.includes('تصنيف')));});
test('invalid calendar dates and wrong monetary totals are rejected',()=>{const i=base();i.date='2026-02-31';i.grossCents=500;assert.ok(invoiceProblems(i,testCategories).some(p=>p.includes('تاريخ')));assert.ok(invoiceProblems(i,testCategories).some(p=>p.includes('الإجمالي')));});
test('duplicates compare the invoice final amount and exclude the same record',()=>{assert.equal(duplicateCandidates({...base(),id:'new'},[base()]).length,1);assert.equal(duplicateCandidates(base(),[base()]).length,0);});
test('category codes retain leading zeros',()=>{assert.deepEqual(parseCategories('00101\tمواد كهرباء\n00102, مواد سباكة\n00101, مكرر'),[{code:'00101',name:'مواد كهرباء'},{code:'00102',name:'مواد سباكة'}]);});
test('extraction requires explicit before-tax and inclusive-total field names',()=>{assert.equal(extractedSchema.safeParse({number:'1',date:'2026-10-25',description:'مشتريات عامة',categoryCode:'TEST-1',subtotalBeforeTax:1000,vatAmount:150,totalIncludingTax:1150,warnings:[]}).success,true);assert.equal(extractedSchema.safeParse({number:'1',date:'2026-10-25',total:1000,tax:150,items:[]}).success,false);});
test('saved workspace schema contains invoice-level fields only',()=>{const parsed=workspaceSchema.parse({...emptyWorkspace,categories:testCategories,invoices:[{...base(),employee:'not persisted'}]});assert.ok(!('employee' in parsed.invoices[0]));assert.equal(parsed.invoices[0].grossCents,115000);});

test('AI summaries use the overall category without listing individual products',()=>{assert.equal(generalDescription('TEST-1',testCategories),'مشتريات مواد كهرباء');assert.equal(generalDescription('GENERAL',[{code:'GENERAL',name:'مشتريات صيانة'}]),'مشتريات صيانة');});
test('uncertain category still gets a general invoice description',()=>{assert.equal(generalDescription('',testCategories),'مشتريات متنوعة');});

test('editing printed tax with no inclusive total preserves the pre-tax amount',()=>{const i={...base(),...printed(100000,15000,null),...amountsFromPrinted(printed(100000,15000,null))};const next=editInvoiceAmount(i,'taxCents',15005);assert.equal(next.netCents,100000);assert.equal(next.grossCents,115005);});
test('impossible extracted amounts stay reviewable without negative stored amounts',()=>{const amounts=amountsFromPrinted(printed(null,15000,10000));assert.equal(amounts.netCents,0);assert.ok(invoiceProblems({...base(),...printed(null,15000,10000),...amounts},testCategories).length);});

test('legacy pre-tax totals mistakenly stored as final are migrated into review',()=>{const legacy={...base(),reportedSubtotalCents:undefined,reportedTaxCents:15000,reportedTotalCents:100000,items:[{grossCents:100000,categoryCode:'TEST-1'}]};const next=normalizeInvoice(legacy,testCategories);assert.equal(next.netCents,100000);assert.equal(next.taxCents,15000);assert.equal(next.grossCents,115000);assert.equal(next.status,'review');assert.equal(next.amountSource,'needs_review');});

test('version 2 data permanently drops supplier and tax registration fields',()=>{
 const old={...structuredClone(emptyWorkspace),schemaVersion:2,categories:testCategories,preferences:{...emptyWorkspace.preferences,columns:['number','supplier','taxNumber','description','gross']},invoices:[{...base(),supplier:'old supplier',taxNumber:'123456789'}]};
 assert.equal(workspaceNeedsMigration(old),true);
 const clean=cleanWorkspace(old);
 assert.equal(clean.schemaVersion,4);
 assert.deepEqual(clean.preferences.columns,['number','description','amount']);
 assert.ok(!('supplier' in clean.invoices[0]));
 assert.ok(!('taxNumber' in clean.invoices[0]));
 assert.equal(clean.invoices[0].grossCents,115000);
 assert.equal(clean.invoices[0].date,old.invoices[0].date);
 assert.deepEqual(cleanWorkspace(clean),clean);
 assert.equal(workspaceNeedsMigration(clean),false);
});
test('supplier and tax registration are absent from extraction, validation and exports',()=>{
 const invoice=base(),rows=exportRows([invoice],testCategories);
 assert.deepEqual(invoiceProblems(invoice,testCategories),[]);
 assert.equal(Object.keys(rows[0]).length,6);
 assert.ok(!('supplier' in rows[0]));assert.ok(!('taxNumber' in rows[0]));
 const extracted=extractedSchema.parse({number:'1',date:'2026-10-25',description:'مشتريات عامة',categoryCode:'TEST-1',subtotalBeforeTax:1000,vatAmount:150,totalIncludingTax:1150,warnings:[],supplier:'removed',taxNumber:'removed'});
 assert.ok(!('supplier' in extracted));assert.ok(!('taxNumber' in extracted));
});
test('manual amount corrections can be approved without editing hidden source evidence',()=>{
 const invoice={...base(),reportedSubtotalCents:90000,reportedTaxCents:12000,reportedTotalCents:100000,amountSource:'needs_review' as const};
 const corrected=editInvoiceAmount(invoice,'grossCents',115000);
 assert.equal(corrected.netCents,100000);assert.equal(corrected.taxCents,15000);
 assert.deepEqual(invoiceProblems(corrected,testCategories),[]);
 const invalid=editInvoiceAmount(corrected,'taxCents',9000);
 assert.ok(invoiceProblems(invalid,testCategories).length);
});
test('duplicate matching uses number, date and final amount without supplier',()=>{
 const invoice={...base(),id:'new'};
 assert.equal(duplicateCandidates(invoice,[base()]).length,1);
 assert.equal(duplicateCandidates({...invoice,date:'2026-10-24'},[base()]).length,0);
 assert.equal(duplicateCandidates({...invoice,grossCents:150000},[base()]).length,0);
 assert.equal(duplicateCandidates({...invoice,sourceHash:'same'},[{...base(),sourceHash:'same',date:'2026-10-24'}]).length,1);
});

test('only completed imports survive workspace cleanup, even after preview',()=>{
 const draft={...base(),id:'previewed-only',status:'review' as const};
 const state={...structuredClone(emptyWorkspace),schemaVersion:3,categories:testCategories,invoices:[base(),draft]};
 const clean=cleanWorkspace(state);assert.deepEqual(clean.invoices,[base()]);assert.equal(workspaceNeedsMigration(state),true);
 assert.deepEqual(cleanWorkspace(clean),clean);
});
test('the server workspace schema rejects unimported invoices',()=>{
 assert.equal(workspaceSchema.safeParse({...emptyWorkspace,invoices:[{...base(),status:'review'}]}).success,false);
});
test('a full batch yields adjacent pairs for every invoice',()=>{
 const invoices=Array.from({length:50},(_,n)=>({...base(),id:String(n),number:'N-'+n}));
 const entries=invoiceEntries(invoices),rows=exportRows(invoices,testCategories);
 assert.equal(rows.length,100);
 for(let n=0;n<50;n++){assert.equal(entries[2*n].invoice.id,String(n));assert.equal(entries[2*n].kind,'net');assert.equal(entries[2*n+1].invoice.id,String(n));assert.equal(entries[2*n+1].kind,'tax');}
});
test('editing VAT row preserves the original net row and recomputes internal reconciliation',()=>{
 const changed=editEntryAmount(base(),'tax',15005);assert.equal(changed.netCents,100000);assert.equal(changed.taxCents,15005);assert.equal(changed.grossCents,115005);
 assert.deepEqual(exportRows([changed],testCategories).map(r=>r.amount),[1000,150.05]);
});
