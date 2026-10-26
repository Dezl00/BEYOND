export type Category={code:string;name:string};
export type AmountSource='printed_total'|'derived_subtotal'|'gross_only'|'manual'|'needs_review'|'missing';
export type Invoice={
 id:string;number:string;date:string;supplier:string;
 description:string;categoryCode:string;netCents:number;taxCents:number;grossCents:number;amountSource:AmountSource;
 reportedSubtotalCents:number|null;reportedTaxCents:number|null;reportedTotalCents:number|null;
 status:'review'|'approved';createdAt:string;sourceName:string;sourceHash:string;page:number;warnings:string[];duplicateReason:string;demo?:boolean;
};
export type Preferences={company:string;retentionHours:number};
export type Workspace={schemaVersion:5;invoices:Invoice[];categories:Category[];preferences:Preferences;revision:number};
export const exportColumns=[
 {key:'account',label:'Account'},{key:'label',label:'Lable'},{key:'analyticAccount',label:'Analtic Account'},
 {key:'debit',label:'Debit'},{key:'credit',label:'Credit'}
] as const;
export const emptyWorkspace:Workspace={schemaVersion:5,invoices:[],categories:[],revision:0,preferences:{company:'Beyond',retentionHours:24}};
export const roundCents=(value:number)=>Math.round((value+Number.EPSILON)*100);
export const money=(cents:number)=>new Intl.NumberFormat('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}).format(cents/100);
export const count=(value:number)=>new Intl.NumberFormat('en-US').format(value);
export const taxFromInclusive=(grossCents:number)=>Math.round(grossCents*15/115);
export const taxFromExclusive=(netCents:number)=>Math.round(netCents*15/100);
const near=(left:number,right:number)=>Math.abs(left-right)<=2;
export type PrintedAmounts={reportedSubtotalCents:number|null;reportedTaxCents:number|null;reportedTotalCents:number|null};
export function amountsFromPrinted(value:PrintedAmounts):Pick<Invoice,'netCents'|'taxCents'|'grossCents'|'amountSource'>{
 const net=value.reportedSubtotalCents,tax=value.reportedTaxCents,gross=value.reportedTotalCents;
 if(gross!==null){
  // A subtotal read as a grand total must never have VAT extracted from it a second time.
  const subtotalMisread=tax!==null&&tax>2&&((net!==null&&near(gross,net))||(net===null&&near(tax,taxFromExclusive(gross))&&!near(tax,taxFromInclusive(gross))));
  if(subtotalMisread){const before=net??gross;return {netCents:before,taxCents:tax!,grossCents:before+tax!,amountSource:'needs_review'};}
  const vat=tax??taxFromInclusive(gross);
  return {netCents:Math.max(0,gross-vat),taxCents:vat,grossCents:gross,amountSource:tax===null?'gross_only':'printed_total'};
 }
 if(net!==null){const vat=tax??taxFromExclusive(net);return {netCents:net,taxCents:vat,grossCents:net+vat,amountSource:'derived_subtotal'};}
 return {netCents:0,taxCents:tax??0,grossCents:0,amountSource:'missing'};
}
export function editInvoiceAmount(invoice:Invoice,field:'netCents'|'taxCents'|'grossCents',value:number):Invoice{
 if(field==='netCents'){const tax=taxFromExclusive(value);return {...invoice,netCents:value,taxCents:tax,grossCents:value+tax,amountSource:'manual'};}
 if(field==='grossCents'){const computed=taxFromInclusive(value);const tax=invoice.reportedTaxCents!==null&&near(invoice.reportedTaxCents,computed)?invoice.reportedTaxCents:computed;return {...invoice,grossCents:value,taxCents:tax,netCents:value-tax,amountSource:'manual'};}
 if(invoice.reportedTotalCents===null||invoice.grossCents<value)return {...invoice,taxCents:value,grossCents:invoice.netCents+value,amountSource:'manual'};
 return {...invoice,taxCents:value,netCents:invoice.grossCents-value,amountSource:'manual'};
}
export const applyPrintedAmounts=(invoice:Invoice):Invoice=>({...invoice,...amountsFromPrinted(invoice)});
export function useSubtotalInsteadOfTotal(invoice:Invoice):Invoice{
 const updated={...invoice,reportedSubtotalCents:invoice.reportedSubtotalCents??invoice.reportedTotalCents,reportedTotalCents:null};
 return applyPrintedAmounts(updated);
}
export function totals(invoices:Invoice[]){
 return invoices.reduce((s,i)=>({gross:s.gross+i.grossCents,tax:s.tax+i.taxCents,net:s.net+i.netCents,invoices:s.invoices+1}),{gross:0,tax:0,net:0,invoices:0});
}
export function invoiceProblems(invoice:Invoice,categories:Category[]){
 const problems:string[]=[];
 if(!invoice.number.trim())problems.push('رقم الفاتورة غير مكتمل');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(invoice.date)||Number.isNaN(Date.parse(invoice.date+'T12:00:00Z'))||new Date(invoice.date+'T12:00:00Z').toISOString().slice(0,10)!==invoice.date)problems.push('تاريخ الفاتورة غير مكتمل');
 if(!categories.some(c=>c.code===invoice.categoryCode))problems.push('اختر التصنيف العام للفاتورة');
 if(![invoice.netCents,invoice.taxCents,invoice.grossCents].every(n=>Number.isSafeInteger(n)&&n>=0&&n<=100000000000)||invoice.grossCents<=0)problems.push('راجع مبالغ الفاتورة');
 if(!near(invoice.netCents+invoice.taxCents,invoice.grossCents))problems.push('قبل الضريبة + الضريبة لا يساوي الإجمالي النهائي');
 const sourceConsistent=invoice.amountSource!=='manual'&&invoice.reportedSubtotalCents!==null&&invoice.reportedTaxCents!==null&&invoice.reportedTotalCents!==null&&near(invoice.reportedSubtotalCents+invoice.reportedTaxCents,invoice.reportedTotalCents);
 if(!sourceConsistent&&!near(invoice.taxCents,taxFromExclusive(invoice.netCents)))problems.push('الضريبة لا تطابق نسبة 15% من المبلغ قبل الضريبة');
 if(invoice.amountSource==='needs_review')problems.push('المبلغ المقروء كإجمالي يبدو قبل الضريبة؛ أكد نوع المبلغ من الأصل');
 if(invoice.amountSource!=='manual'&&invoice.reportedTotalCents!==null&&!near(invoice.grossCents,invoice.reportedTotalCents))problems.push('الإجمالي النهائي لا يطابق الإجمالي المكتوب؛ راجع هل المبلغ المقروء قبل الضريبة');
 if(invoice.amountSource!=='manual'&&invoice.reportedSubtotalCents!==null&&!near(invoice.netCents,invoice.reportedSubtotalCents))problems.push('المبلغ قبل الضريبة لا يطابق الصافي المكتوب في الأصل');
 if(invoice.amountSource!=='manual'&&invoice.reportedTaxCents!==null&&!near(invoice.taxCents,invoice.reportedTaxCents))problems.push('الضريبة لا تطابق الضريبة المكتوبة في الأصل');
 return [...new Set(problems)];
}
export function invoiceAmountWarnings(invoice:Invoice){return near(invoice.taxCents,taxFromExclusive(invoice.netCents))?[]:['الضريبة المكتوبة تختلف عن حساب 15%؛ راجع النسبة أو فروق التقريب في الأصل. تم الاحتفاظ بالمبالغ المكتوبة.'];}
export function duplicateCandidates(invoice:Invoice,previous:Invoice[]){
 return previous.filter(p=>p.id!==invoice.id&&((!!invoice.sourceHash&&p.sourceHash===invoice.sourceHash)||(!!invoice.number.trim()&&p.number.trim().toLowerCase()===invoice.number.trim().toLowerCase()&&!!invoice.date&&p.date===invoice.date&&(!p.supplier||!invoice.supplier||p.supplier.trim().toLowerCase()===invoice.supplier.trim().toLowerCase())&&p.grossCents===invoice.grossCents)));
}
export function generalDescription(categoryCode:string,categories:Category[]){const name=categories.find(c=>c.code===categoryCode)?.name.trim();if(!name)return 'مشتريات متنوعة';return /^(مشتريات|مصروفات|خدمات|أعمال|توريد|صيانة|إيجار|نقل|شحن)/.test(name)?name:'مشتريات '+name;}
export type EntryKind='net'|'tax';
export function invoiceEntries(invoices:Invoice[]){return invoices.flatMap(invoice=>[{invoice,kind:'net' as const,amountCents:invoice.netCents},{invoice,kind:'tax' as const,amountCents:invoice.taxCents}]);}
export function editEntryAmount(invoice:Invoice,kind:EntryKind,value:number):Invoice{
 if(kind==='net')return editInvoiceAmount(invoice,'netCents',value);
 return {...invoice,taxCents:value,grossCents:invoice.netCents+value,amountSource:'manual'};
}
const journalText=(value:string)=>value.replace(/\s+/g,' ').trim();
export function journalDate(value:string){
 const match=value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
 return match?match[3]+'/'+match[2]+'/'+match[1]:journalText(value);
}
export function journalLabel(invoice:Invoice,categories:Category[],kind:EntryKind='net'){
 const supplier=journalText(invoice.supplier),number=journalText(invoice.number),date=journalDate(invoice.date);
 const category=journalText(categories.find(c=>c.code===invoice.categoryCode)?.name||'');
 const label=[supplier,number?'فاتورة رقم '+number:'',date?'بتاريخ '+date:'',category].filter(Boolean).join(' ');
 return kind==='tax'?['قيمة مضافة',label].filter(Boolean).join(' '):label;
}
export function exportRows(invoices:Invoice[],categories:Category[]){
 return invoiceEntries(invoices).map(({invoice,kind,amountCents})=>({
  account:invoice.categoryCode,label:journalLabel(invoice,categories,kind),analyticAccount:null,
  debit:amountCents/100,credit:null
 }));
}
export function parseCategories(text:string):Category[]{
 const result:Category[]=[];for(const line of text.split(/\r?\n/)){const parts=line.trim().split(/\t|[,،;]| \| /).map(s=>s.trim()).filter(Boolean);if(parts.length<2)continue;const code=parts[0],name=parts.slice(1).join(' ');if(code&&name&&!result.some(c=>c.code===code))result.push({code,name});}return result;
}
const string=(value:unknown,fallback='')=>typeof value==='string'?value:fallback;
const integer=(value:unknown,fallback=0)=>typeof value==='number'&&Number.isSafeInteger(value)?value:fallback;
const nullable=(value:unknown)=>typeof value==='number'&&Number.isSafeInteger(value)?value:null;
export const isDemoInvoice=(invoice:{id:string;demo?:boolean})=>invoice.demo===true||invoice.id.startsWith('demo-');
export function normalizeInvoice(input:unknown,categories:Category[]):Invoice{
 const value=input as Record<string,unknown>;
 const legacy=Array.isArray(value.items),lines=legacy?value.items as Record<string,unknown>[]:[];
 const codes=[...new Set(lines.map(l=>string(l.categoryCode)).filter(Boolean))];
 const category=legacy?(codes.length===1?codes[0]:''):string(value.categoryCode);
 const categoryName=categories.find(c=>c.code===category)?.name;
 const printed:PrintedAmounts={reportedSubtotalCents:nullable(value.reportedSubtotalCents),reportedTaxCents:nullable(value.reportedTaxCents),reportedTotalCents:nullable(value.reportedTotalCents)};
 const oldGross=lines.reduce((s,l)=>s+integer(l.grossCents),0);
 const derived=amountsFromPrinted({...printed,reportedTotalCents:printed.reportedTotalCents??(legacy?oldGross:null)});
 const amountSource=legacy?derived.amountSource:(['printed_total','derived_subtotal','gross_only','manual','needs_review','missing'].includes(string(value.amountSource))?value.amountSource as AmountSource:'manual');
 const warnings=Array.isArray(value.warnings)?value.warnings.filter((s):s is string=>typeof s==='string'):[];
 if(legacy&&codes.length>1)warnings.push('الفاتورة كانت موزعة على أكثر من تصنيف؛ اختر تصنيفًا عامًا واحدًا.');
 return {
  id:string(value.id),number:string(value.number),date:string(value.date),supplier:string(value.supplier),
  description:legacy?generalDescription(category,categories):string(value.description),categoryCode:category,
  netCents:legacy?derived.netCents:integer(value.netCents),taxCents:legacy?derived.taxCents:integer(value.taxCents),grossCents:legacy?derived.grossCents:integer(value.grossCents),amountSource,
  ...printed,status:value.status==='approved'&&amountSource!=='needs_review'&&(!legacy||codes.length<=1)?'approved':'review',
  createdAt:string(value.createdAt),sourceName:string(value.sourceName),sourceHash:string(value.sourceHash),page:integer(value.page,1),
  warnings:[...new Set(warnings)],duplicateReason:string(value.duplicateReason)
 };
}
export function cleanWorkspace(input:unknown):Workspace{
 const value=input as Record<string,unknown>,preferences=(value.preferences||{}) as Record<string,unknown>;
 const categories=Array.isArray(value.categories)?value.categories as Category[]:[];
 return {schemaVersion:5,invoices:(Array.isArray(value.invoices)?value.invoices:[]).filter(i=>!isDemoInvoice(i as Invoice)&&(i as Invoice).status==='approved').map(i=>({...normalizeInvoice(i,categories),status:'approved' as const})),categories,
 preferences:{company:string(preferences.company,'Beyond'),retentionHours:integer(preferences.retentionHours,24)},revision:integer(value.revision)};
}
export function workspaceNeedsMigration(input:unknown):boolean{
 const value=input as Record<string,unknown>,preferences=(value.preferences||{}) as Record<string,unknown>;
 return value.schemaVersion!==5||'employee' in preferences||'columns' in preferences||(Array.isArray(value.invoices)&&value.invoices.some(i=>'items' in i||'employee' in i||'taxNumber' in i||i.status!=='approved'||isDemoInvoice(i)));
}
