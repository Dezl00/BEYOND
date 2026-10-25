import {Invoice,Category} from './domain';
export const demoCategories:Category[]=[
 {code:'D-101',name:'مواد كهرباء'},{code:'D-102',name:'مواد سباكة'},
 {code:'D-103',name:'مستلزمات مكتبية'},{code:'D-104',name:'مواد بناء'},{code:'D-105',name:'مصروفات تشغيل'}
];
const samples = [
 ['INV-2048','مؤسسة النور للكهرباء','أحمد محمد','2026-10-25','D-101', [['كابل كهرباء نحاس 6 مم',3,69000],['قاطع كهربائي 32 أمبير',2,23000]]],
 ['INV-1876','شركة إمداد لمواد البناء','محمد علي','2026-10-24','D-104',[['أسمنت بورتلاندي 50 كجم',10,40250]]],
 ['FT-0092','مكتبة جرير','أحمد محمد','2026-10-24','D-103',[['ورق تصوير A4',5,14375],['أقلام حبر جاف',12,6900]]],
 ['INV-3301','مؤسسة الراشد للسباكة','خالد عبدالله','2026-10-23','D-102',[['محبس نحاس نصف بوصة',8,36800]]],
 ['INV-2081','مؤسسة النور للكهرباء','محمد علي','2026-10-22','D-101',[['لوحة توزيع كهربائية',1,132250]]],
 ['RC-0140','مؤسسة التميز للتوريدات','أحمد محمد','2026-10-22','D-105',[['مستلزمات تشغيل وصيانة',1,28750]]],
] as const;
export const demoInvoices:Invoice[]=samples.map((r,index)=>({
 id:'demo-'+index,number:r[0],supplier:r[1],employee:r[2],date:r[3],taxNumber:'300000000000003',
 items:r[5].map((l,n)=>({id:'demo-line-'+index+'-'+n,description:l[0],quantity:l[1],grossCents:l[2],categoryCode:r[4]})),
 reportedTotalCents:r[5].reduce((s,l)=>s+l[2],0),reportedTaxCents:null,status:index===2?'review':'approved',
 createdAt:'2026-10-25T09:00:00.000Z',sourceName:'فاتورة توضيحية '+(index+1)+'.pdf',sourceHash:'',page:1,
 warnings:index===2?['راجع بيانات هذه الفاتورة قبل الاعتماد']:[],duplicateReason:'',demo:true
}));
