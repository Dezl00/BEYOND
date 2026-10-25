export type Category = { code: string; name: string };
export type Line = { id: string; description: string; quantity: number; grossCents: number; categoryCode: string };
export type Invoice = {
 id: string; number: string; date: string; supplier: string; taxNumber: string; employee: string;
 items: Line[]; reportedTotalCents: number | null; reportedTaxCents: number | null;
 status: 'review' | 'approved'; createdAt: string; sourceName: string; sourceHash: string;
 page: number; warnings: string[]; duplicateReason: string; demo?: boolean;
};
export type Preferences = { company: string; employee: string; retentionHours: number; columns: string[] };
export type Workspace = { invoices: Invoice[]; categories: Category[]; preferences: Preferences; revision: number };
export const columns = [
 { key:'number',label:'رقم الفاتورة' },{key:'date',label:'التاريخ'},{key:'supplier',label:'المورد'},
 {key:'taxNumber',label:'الرقم الضريبي'},{key:'employee',label:'صاحب العهدة'},
 {key:'description',label:'وصف البند'},{key:'quantity',label:'الكمية'},
 {key:'category',label:'التصنيف'},{key:'code',label:'الكود'},
 {key:'net',label:'الصافي'},{key:'tax',label:'الضريبة 15%'},{key:'gross',label:'الإجمالي'},
];
export const emptyWorkspace: Workspace = {
 invoices:[], categories:[], revision:0,
 preferences:{company:'Beyond',employee:'',retentionHours:24,columns:columns.map(c=>c.key)}
};
export const isDemoInvoice = (invoice:Invoice) => invoice.demo===true || invoice.id.startsWith('demo-');
export const cleanWorkspace = (workspace:Workspace):Workspace => ({...workspace,invoices:workspace.invoices.filter(invoice=>!isDemoInvoice(invoice))});
export const roundCents = (value:number) => Math.round((value + Number.EPSILON)*100);
export const money = (cents:number) => new Intl.NumberFormat('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}).format(cents/100);
export const count = (value:number) => new Intl.NumberFormat('en-US').format(value);
export const taxFromInclusive = (grossCents:number) => Math.round(grossCents*15/115);
export function allocatedTaxes(items:Line[]) {
 const total = items.reduce((s,i)=>s+i.grossCents,0);
 const target = taxFromInclusive(total);
 const values = items.map(i=>Math.floor(i.grossCents*15/115));
 let remaining = target-values.reduce((a,b)=>a+b,0);
 const ranking=items.map((i,index)=>({index,fraction:i.grossCents*15/115-values[index]})).sort((a,b)=>b.fraction-a.fraction);
 for(let n=0;n<remaining;n++) values[ranking[n%ranking.length].index]++;
 return values;
}
export function totals(invoices:Invoice[]) {
 const gross=invoices.reduce((sum,i)=>sum+i.items.reduce((s,l)=>s+l.grossCents,0),0);
 const tax=invoices.reduce((sum,i)=>sum+taxFromInclusive(i.items.reduce((s,l)=>s+l.grossCents,0)),0);
 return {gross,tax,net:gross-tax,items:invoices.reduce((sum,i)=>sum+i.items.length,0)};
}
export function invoiceProblems(invoice:Invoice,categories:Category[]) {
 const problems:string[]=[];
 if(!invoice.number.trim()) problems.push('رقم الفاتورة غير مكتمل');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(invoice.date) || (Number.isNaN(Date.parse(invoice.date+'T12:00:00Z')) || new Date(invoice.date+'T12:00:00Z').toISOString().slice(0,10)!==invoice.date)) problems.push('تاريخ الفاتورة غير مكتمل');
 if(!invoice.supplier.trim()) problems.push('اسم المورد غير مكتمل');
 if(!invoice.employee.trim()) problems.push('حدد صاحب العهدة');
 if(!invoice.items.length) problems.push('لا توجد بنود');
 for(const line of invoice.items) {
  if(!line.description.trim()) problems.push('وصف أحد البنود غير مكتمل');
  if(!Number.isSafeInteger(line.grossCents)||line.grossCents<=0||line.grossCents>100000000000) problems.push('راجع مبلغ أحد البنود');
  if(!Number.isFinite(line.quantity)||line.quantity<=0) problems.push('راجع كمية أحد البنود');
  if(!categories.some(c=>c.code===line.categoryCode)) problems.push('اختر تصنيفًا معتمدًا لكل بند');
 }
 const t=totals([invoice]);
 if(invoice.reportedTotalCents!==null&&Math.abs(t.gross-invoice.reportedTotalCents)>2) problems.push('مجموع البنود يختلف عن إجمالي الفاتورة؛ راجع المبالغ');
 if(invoice.reportedTaxCents!==null&&Math.abs(t.tax-invoice.reportedTaxCents)>2) problems.push('الضريبة المكتوبة تختلف عن الضريبة المحسوبة؛ راجع الفاتورة');
 return [...new Set(problems)];
}
export function duplicateCandidates(invoice:Invoice,previous:Invoice[]) {
 return previous.filter(p=>p.id!==invoice.id&&(
  (!!invoice.sourceHash&&p.sourceHash===invoice.sourceHash)||
  (!!invoice.number.trim()&&p.number.trim().toLowerCase()===invoice.number.trim().toLowerCase()&&
   p.supplier.trim().toLowerCase()===invoice.supplier.trim().toLowerCase()&&totals([p]).gross===totals([invoice]).gross)
 ));
}
export function exportRows(invoices:Invoice[],categories:Category[]) {
 return invoices.flatMap(i=>{const taxes=allocatedTaxes(i.items);return i.items.map((line,index)=>({
  number:i.number,date:i.date,supplier:i.supplier,taxNumber:i.taxNumber,employee:i.employee,
  description:line.description,quantity:line.quantity,
  category:categories.find(c=>c.code===line.categoryCode)?.name||'غير مصنف',code:line.categoryCode,
  net:(line.grossCents-taxes[index])/100,tax:taxes[index]/100,gross:line.grossCents/100
 }));});
}
export function parseCategories(text:string):Category[] {
 const result:Category[]=[];
 for(const raw of text.split(/\r?\n/)) {
  const parts=raw.trim().split(/\t|[,،;]| \| /).map(s=>s.trim()).filter(Boolean);
  if(parts.length<2) continue;
  const code=parts[0]; const name=parts.slice(1).join(' ');
  if(code&&name&&!result.some(c=>c.code===code)) result.push({code,name});
 }
 return result;
}
