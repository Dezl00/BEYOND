import type {Category} from './domain';
import {categoryNameKey} from './categories';

export type ExpenseRule='operating'|'stationery'|'fuel';
const normalized=(value:string)=>categoryNameKey(value).replace(/ة/g,'ه').replace(/ى/g,'ي');
function words(value:string){
 const result=new Set<string>();
 for(const word of normalized(value).replace(/([\p{L}])([0-9])/gu,'$1 $2').split(/[^\p{L}\p{N}]+/u).filter(Boolean)){
  result.add(word);
  if(word.startsWith('ال'))result.add(word.slice(2));
  if(word.startsWith('وال')||word.startsWith('بال'))result.add(word.slice(3));
  if(word.startsWith('لل'))result.add(word.slice(2));
  if(word.startsWith('و'))result.add(word.slice(1));
 }
 return result;
}
const matches=(tokens:Set<string>,values:string[])=>values.some(v=>tokens.has(v));
const food=['اكل','شرب','طعام','اطعمه','وجبه','وجبات','ماكولات','مشروبات','قهوه','شاي','عصير','عصائر','فطور','افطار','غداء','عشاء','ساندويتش','سندويتش','food','meal','meals','drink','drinks','coffee','tea','juice','breakfast','lunch','dinner','sandwich','ساندوتش','رز','ارز','دجاج','لحم','لحوم','سمك','اسماك','كبسه','مندي','برياني','مشاوي','كباب','شاورما','فلافل','فول','بيتزا','برجر','جبن','زبادي','لبن','حليب','خبز','تميس','سكر','شوكولاته','بسكويت','تمر','حلويات','كيك','موز','برتقال','تفاح','بطاطس','بصل','طماطم','خضار','فواكه','بيبسي','كولا','سفن','سبرايت','نستله','نسكافيه','نسكافيه','chicken','beef','rice','burger','pizza','milk','bread','cola','pepsi','sprite','yogurt','cheese','fruit','vegetables','chocolate','biscuits','cookies'];
const water=['ماء','مياه','water'];
const plumbing=['سباكه','مواسير','ماسوره','انبوب','انابيب','مضخه','مضخات','محبس','صمام','خزان','خزانات','سخان','وصله','pipe','pipes','pump','valve','plumbing','heater','tank'];
const printing=['طباعه','طباعات','طبع','تصوير','استنساخ','print','printing','printout','photocopy','photocopies','copying','copies'];
const fuel=['بنزين','بترول','ديزل','وقود','محروقات','gasoline','petrol','diesel','fuel','unleaded'];
const parts=['فلتر','طرمبه','مضخه','حساس','خرطوم','غطاء','filter','pump','sensor','hose'];
const names:Record<ExpenseRule,string>={operating:'مصاريف تشغيل',stationery:'قرطاسية',fuel:'محروقات'};
const aliases:Record<ExpenseRule,string[]>={operating:['مصاريف تشغيل','مصاريف التشغيل','مصروفات تشغيل','مصروفات التشغيل','مصاريف تشغيلية'],stationery:['قرطاسية','قرطاسية تشغيلي','قرطاسية تشغيلى','مصاريف قرطاسية','مصروفات قرطاسية'],fuel:['محروقات','مصاريف محروقات','مصروفات محروقات']};
export function resolveExpenseRule(items:readonly string[],categories:Category[]):{handled:boolean;rule:ExpenseRule|'mixed'|null;category:Category|null;warning?:string}{
 const found=new Set<ExpenseRule>();
 for(const item of items){
  const tokens=words(item);
  if(matches(tokens,food)||(matches(tokens,water)&&!matches(tokens,plumbing)))found.add('operating');
  if(matches(tokens,printing))found.add('stationery');
  if(matches(tokens,fuel)&&!matches(tokens,parts))found.add('fuel');
 }
 if(!found.size)return {handled:false,rule:null,category:null};
 if(found.size>1)return {handled:true,rule:'mixed',category:null,warning:'توجد بنود تتبع أكثر من قاعدة تصنيف؛ اختر الحساب المناسب للفاتورة.'};
 const rule=[...found][0];
 const targets=categories.filter(c=>aliases[rule].some(name=>normalized(c.name)===normalized(name)));
 if(targets.length!==1)return {handled:true,rule,category:null,warning:targets.length?'يوجد أكثر من حساب مطابق لـ «'+names[rule]+'»؛ اختر الكود الصحيح.':'أضف حساب «'+names[rule]+'» وكوده إلى الحسابات لتصنيف هذه الفاتورة.'};
 return {handled:true,rule,category:targets[0]};
}
