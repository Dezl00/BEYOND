import type {Category,Invoice} from '../../lib/domain';
export const testCategories:Category[]=[{code:'TEST-1',name:'تصنيف اختبار'}];
export const testInvoices:Invoice[]=[{
 id:'test-invoice',number:'TEST-001',date:'2026-10-25',supplier:'مورد اختبار',taxNumber:'',employee:'موظف اختبار',
 items:[{id:'test-line-1',description:'بند أول للاختبار',quantity:3,grossCents:69000,categoryCode:'TEST-1'},{id:'test-line-2',description:'بند ثان للاختبار',quantity:2,grossCents:23000,categoryCode:'TEST-1'}],
 reportedTotalCents:92000,reportedTaxCents:null,status:'approved',createdAt:'2026-10-25T09:00:00.000Z',
 sourceName:'test-invoice.pdf',sourceHash:'',page:1,warnings:[],duplicateReason:''
}];
