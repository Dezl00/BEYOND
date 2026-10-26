import {z} from 'zod';
export const categorySchema=z.object({code:z.string().trim().min(1).max(80),name:z.string().trim().min(1).max(180)});
const cents=z.number().int().nonnegative().max(100000000000);
export const invoiceSchema=z.object({
 id:z.string().max(100),number:z.string().max(150),date:z.string().max(30),supplier:z.string().max(300).default(''),
 description:z.string().max(1500),categoryCode:z.string().max(80),netCents:cents,taxCents:cents,grossCents:cents,
 amountSource:z.enum(['printed_total','derived_subtotal','gross_only','manual','needs_review','missing']),
 reportedSubtotalCents:cents.nullable(),reportedTaxCents:cents.nullable(),reportedTotalCents:cents.nullable(),
 status:z.enum(['review','approved']),createdAt:z.string(),sourceName:z.string().max(300),sourceHash:z.string().max(150),
 page:z.number().int().positive(),warnings:z.array(z.string().max(500)).max(30),duplicateReason:z.string().max(1000)
});
export const workspaceSchema=z.object({
 schemaVersion:z.literal(5).default(5),invoices:z.array(invoiceSchema.refine(invoice=>invoice.status==='approved','Only imported invoices can be saved')).max(10000),categories:z.array(categorySchema).max(1000),revision:z.number().int().nonnegative(),
 preferences:z.object({company:z.string().max(100),retentionHours:z.number().int().min(1).max(8760)})
});
export const extractedSchema=z.object({
 number:z.string(),date:z.string(),supplier:z.string().max(300),description:z.string(),categoryCode:z.string(),handwrittenCategory:z.string().max(180),handwrittenCategoryCode:z.string().max(80),
 subtotalBeforeTax:z.number().nonnegative().nullable(),vatAmount:z.number().nonnegative().nullable(),totalIncludingTax:z.number().nonnegative().nullable(),
 warnings:z.array(z.string())
});
export const extractionJsonSchema={
 type:'object',properties:{
  number:{type:'string'},date:{type:'string'},supplier:{type:'string',description:'Supplier or merchant name, not the buyer; empty when unreadable.'},handwrittenCategory:{type:'string',description:'Readable handwritten expense classification added by the user on this page. Empty if absent or uncertain. Never copy product names or printed invoice headings.'},handwrittenCategoryCode:{type:'string',description:'Only a code explicitly handwritten next to the category. Never invent a code. Empty if absent.'},
  description:{type:'string',description:'One short general Arabic summary for the entire invoice. Never list individual products, quantities, or part numbers.'},
  categoryCode:{type:'string'},
  subtotalBeforeTax:{type:['number','null'],description:'Printed invoice-wide taxable net subtotal EXCLUDING VAT, AFTER invoice discounts. Never a per-item amount.'},
  vatAmount:{type:['number','null'],description:'Printed invoice-wide VAT amount, not a percentage.'},
  totalIncludingTax:{type:['number','null'],description:'Final invoice grand total INCLUDING VAT. Do not use a subtotal, taxable amount, unit price, amount paid, or remaining balance. Null if no inclusive grand total is clearly printed.'},
  warnings:{type:'array',items:{type:'string'}}
 },required:['number','date','supplier','description','categoryCode','handwrittenCategory','handwrittenCategoryCode','subtotalBeforeTax','vatAmount','totalIncludingTax','warnings']
};
