import {z} from 'zod';
export const categorySchema=z.object({code:z.string().trim().min(1).max(80),name:z.string().trim().min(1).max(180)});
export const invoiceSchema=z.object({
 id:z.string().max(100),number:z.string().max(150),date:z.string().max(30),supplier:z.string().max(300),
 taxNumber:z.string().max(100),employee:z.string().max(200),
 items:z.array(z.object({id:z.string().max(100),description:z.string().max(1500),quantity:z.number().positive().finite(),
 grossCents:z.number().int().nonnegative().max(100000000000),categoryCode:z.string().max(80)})).max(1000),
 reportedTotalCents:z.number().int().nonnegative().nullable(),reportedTaxCents:z.number().int().nonnegative().nullable(),
 status:z.enum(['review','approved']),createdAt:z.string(),sourceName:z.string().max(300),sourceHash:z.string().max(150),
 page:z.number().int().positive(),warnings:z.array(z.string().max(500)).max(30),duplicateReason:z.string().max(1000),demo:z.boolean().optional()
});
export const workspaceSchema=z.object({
 invoices:z.array(invoiceSchema).max(10000),categories:z.array(categorySchema).max(1000),revision:z.number().int().nonnegative(),
 preferences:z.object({company:z.string().max(100),employee:z.string().max(200),retentionHours:z.number().int().min(1).max(8760),columns:z.array(z.string()).max(12)})
});
export const extractedSchema=z.object({
 number:z.string(),date:z.string(),supplier:z.string(),taxNumber:z.string(),
 total:z.number().nonnegative().nullable(),tax:z.number().nonnegative().nullable(),
 warnings:z.array(z.string()),items:z.array(z.object({
 description:z.string(),quantity:z.number().positive(),gross:z.number().nonnegative(),categoryCode:z.string()
 })).min(1).max(500)
});
export const extractionJsonSchema={
 type:'object',properties:{
  number:{type:'string'},date:{type:'string'},supplier:{type:'string'},taxNumber:{type:'string'},
  total:{type:['number','null']},tax:{type:['number','null']},warnings:{type:'array',items:{type:'string'}},
  items:{type:'array',items:{type:'object',properties:{
   description:{type:'string'},quantity:{type:'number'},gross:{type:'number'},categoryCode:{type:'string'}
  },required:['description','quantity','gross','categoryCode']}}
 },required:['number','date','supplier','taxNumber','total','tax','warnings','items']
};
