import {readFileSync} from 'node:fs';import {createRequire} from 'node:module';import {resolve} from 'node:path';import assert from 'node:assert/strict';import {PDFDocument,StandardFonts} from 'pdf-lib';
const env={};for(const line of readFileSync('.env.local','utf8').split(/\r?\n/)){if(!line||line.startsWith('#'))continue;const n=line.indexOf('=');if(n<1)continue;const value=line.slice(n+1);env[line.slice(0,n)]=value.startsWith('"')?JSON.parse(value):value;}
const require=createRequire(import.meta.url),{amountsFromPrinted,roundCents,invoiceProblems}=require(resolve('work/accounting-tests/lib/domain.js'));
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:3001';
let response=await fetch(base+'/api/settings');assert.equal(response.status,401);
response=await fetch(base+'/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:env.APP_PASSWORD})});assert.equal(response.status,200);const cookie=response.headers.get('set-cookie').split(';')[0],headers={Cookie:cookie};
response=await fetch(base+'/',{headers});assert.equal(response.status,200);const html=await response.text();assert.ok(!html.includes('صاحب العهدة'));console.log('PASS: authentication and initial workspace render without a custodian field.');
const category={code:'TEST-ALL',name:'مشتريات صيانة'};
const cases=[
 {name:'PRINTED-ALL',footer:['Total excluding VAT: 1000.00 SAR','VAT 15%: 150.00 SAR','FINAL TOTAL INCLUDING VAT: 1150.00 SAR'],net:1000,tax:150,gross:1150},
 {name:'EXCLUSIVE-ONLY',footer:['Total excluding VAT: 1000.00 SAR','VAT 15%: 150.00 SAR'],net:1000,tax:150,gross:null},
 {name:'INCLUSIVE-ONLY',footer:['FINAL TOTAL INCLUDING VAT: 1150.00 SAR'],net:null,tax:null,gross:1150},
 {name:'TOTAL-BEFORE-VAT',footer:['Total: 1000.00 SAR','VAT 15%: 150.00 SAR'],net:1000,tax:150,gross:null}
];
for(const sample of cases){
 const doc=await PDFDocument.create(),page=doc.addPage([595,842]),font=await doc.embedFont(StandardFonts.Helvetica);
 const text=['BEYOND SYNTHETIC TEST SUPPLIES','TEST INVOICE - NOT A REAL TRANSACTION','Invoice number: '+sample.name,'Date: 2026-10-25','VAT number: 300000000000003','','Product                        Qty   Net line amount','Electrical cable EC-77         2         500.00','Plumbing valve PV-10           1         500.00','',...sample.footer];
 text.forEach((line,i)=>page.drawText(line,{x:35,y:785-i*31,size:11,font}));
 const form=new FormData();form.set('file',new Blob([await doc.save()],{type:'application/pdf'}),sample.name+'.pdf');form.set('categories',JSON.stringify([category]));
 const started=Date.now();response=await fetch(base+'/api/extract',{method:'POST',headers,body:form,signal:AbortSignal.timeout(260000)});const body=await response.json();assert.equal(response.status,200,body.error);
 const invoice=body.invoice;assert.equal(invoice.number,sample.name);assert.equal(invoice.description,category.name);assert.ok(!/EC-77|PV-10/.test(invoice.description));assert.ok(!('items' in invoice));assert.ok(!('employee' in invoice));assert.ok(!('supplier' in invoice));assert.ok(!('taxNumber' in invoice));
 assert.equal(invoice.subtotalBeforeTax,sample.net);assert.equal(invoice.vatAmount,sample.tax);assert.equal(invoice.totalIncludingTax,sample.gross);
 const printed={reportedSubtotalCents:invoice.subtotalBeforeTax===null?null:roundCents(invoice.subtotalBeforeTax),reportedTaxCents:invoice.vatAmount===null?null:roundCents(invoice.vatAmount),reportedTotalCents:invoice.totalIncludingTax===null?null:roundCents(invoice.totalIncludingTax)};
 const amounts=amountsFromPrinted(printed);assert.equal(amounts.netCents,100000);assert.equal(amounts.taxCents,15000);assert.equal(amounts.grossCents,115000);
 const full={id:sample.name,number:invoice.number,date:invoice.date,description:invoice.description,categoryCode:invoice.categoryCode,...printed,...amounts,status:'review',createdAt:new Date().toISOString(),sourceName:sample.name+'.pdf',sourceHash:'',page:1,warnings:invoice.warnings,duplicateReason:''};
 assert.deepEqual(invoiceProblems(full,[category]),[]);
 console.log(JSON.stringify({case:sample.name,description:invoice.description,net:amounts.netCents/100,tax:amounts.taxCents/100,total:amounts.grossCents/100,seconds:Math.round((Date.now()-started)/1000)}));
}
console.log('PASS: 4 live Gemini extraction cases, one general description per invoice, no double VAT calculation.');
