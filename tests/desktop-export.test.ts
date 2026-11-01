import {test} from 'node:test';
import assert from 'node:assert/strict';
import {prepareDesktopExportInvoices} from '../lib/desktop-data';
import {exportRows} from '../lib/domain';
import {testInvoices,testCategories} from './fixtures/invoices';

test('split invoices export the reviewed debit amounts even when the hidden total is stale or zero',()=>{
 for(const grossCents of [0,90000,115001]){
  const input={...testInvoices[0],companyTaxIdPresent:true,grossCents};
  const [prepared]=prepareDesktopExportInvoices([input]);
  assert.equal(prepared.grossCents,115000);
  assert.deepEqual(exportRows([prepared],testCategories).map(row=>row.debit),[1000,150]);
  assert.equal(input.grossCents,grossCents);
 }
});
test('gross-only invoices export exactly one reviewed total and discard stale hidden net/VAT values',()=>{
 const input={...testInvoices[0],companyTaxIdPresent:false,netCents:100000,taxCents:15000,grossCents:200000};
 const [prepared]=prepareDesktopExportInvoices([input]);
 assert.deepEqual([prepared.netCents,prepared.taxCents,prepared.grossCents],[200000,0,200000]);
 assert.deepEqual(exportRows([prepared],testCategories).map(row=>row.debit),[2000]);
 assert.equal(prepared.reportedTaxCents,15000);
});
test('mixed invoice exports preserve all visible debits and metadata without recalculating VAT',()=>{
 const input=[{...testInvoices[0],companyTaxIdPresent:true,netCents:100001,taxCents:14999,grossCents:0},{...testInvoices[0],id:'gross',companyTaxIdPresent:false,grossCents:23000}];
 const before=structuredClone(input),prepared=prepareDesktopExportInvoices(input);
 assert.deepEqual(exportRows(prepared,testCategories).map(row=>row.debit),[1000.01,149.99,230]);
 assert.deepEqual(input,before);
 assert.deepEqual({...prepared[0],grossCents:0},before[0]);
});
test('a genuinely zero or unreadable debit identifies the offending invoice and page',()=>{
 const invalid={...testInvoices[0],number:'0050',sourceName:'batch.pdf',page:7,netCents:0,taxCents:0,grossCents:115000};
 assert.throws(()=>prepareDesktopExportInvoices([testInvoices[0],invalid]),error=>error instanceof Error&&error.message.includes('0050')&&error.message.includes('batch.pdf')&&error.message.includes('صفحة 7')&&error.message.includes('صفر'));
});
test('a zero gross-only debit cannot be filled from hidden amounts that the user did not review',()=>{
 assert.throws(()=>prepareDesktopExportInvoices([{...testInvoices[0],companyTaxIdPresent:false,grossCents:0}]),/صفر/);
 const unnamed={...testInvoices[0],number:'',sourceName:'image-3.jpg',page:3,netCents:0,taxCents:0};
 assert.throws(()=>prepareDesktopExportInvoices([unnamed]),/image-3\.jpg.*صفحة 3/);
});
test('combining reviewed debit amounts still enforces the supported monetary range',()=>{
 assert.throws(()=>prepareDesktopExportInvoices([{...testInvoices[0],netCents:100000000000,taxCents:1}]),/الحد المسموح/);
});
