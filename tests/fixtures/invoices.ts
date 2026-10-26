import type {Category,Invoice} from '../../lib/domain';
export const testCategories:Category[]=[{code:'TEST-1',name:'مواد كهرباء'},{code:'TEST-2',name:'مواد سباكة'}];
export const testInvoices:Invoice[]=[{
 id:'test-invoice',number:'TEST-001',date:'2026-10-25',
 description:'شراء مواد كهربائية',categoryCode:'TEST-1',netCents:100000,taxCents:15000,grossCents:115000,amountSource:'printed_total',
 reportedSubtotalCents:100000,reportedTaxCents:15000,reportedTotalCents:115000,
 status:'approved',createdAt:'2026-10-25T09:00:00.000Z',sourceName:'test-invoice.pdf',sourceHash:'',page:1,warnings:[],duplicateReason:''
}];
