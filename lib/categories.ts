export type Category={code:string;name:string};
type Annotation={categoryCode:string;handwrittenCategory:string;handwrittenCategoryCode:string};
const text=(value:string)=>value.replace(/[\u0000-\u001f\u007f]/g,' ').trim().replace(/\s+/g,' ');
export const categoryNameKey=(value:string)=>text(value).normalize('NFKC').replace(/[\u064b-\u065f\u0670\u0640]/g,'').replace(/[أإآ]/g,'ا').toLowerCase();
const codeText=(value:string)=>text(value).replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632)).replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-1776));
export function nextCategoryCode(categories:Category[]){
 const numeric=categories.map(c=>c.code).filter(code=>/^\d+$/.test(code)&&code.length<30).sort((a,b)=>BigInt(a)<BigInt(b)?-1:BigInt(a)>BigInt(b)?1:0);
 if(numeric.length){const last=numeric[numeric.length-1];let candidate=(BigInt(last)+BigInt(1)).toString().padStart(last.length,'0');while(categories.some(c=>c.code===candidate))candidate=(BigInt(candidate)+BigInt(1)).toString().padStart(last.length,'0');return candidate;}
 let n=1;while(categories.some(c=>c.code==='AUTO-'+String(n).padStart(3,'0')))n++;
 return 'AUTO-'+String(n).padStart(3,'0');
}
export function resolveExtractedCategory(input:Annotation,categories:Category[]):{category:Category|null;created:boolean}{
 const name=text(input.handwrittenCategory).slice(0,180),code=codeText(input.handwrittenCategoryCode).slice(0,80);
 if(name){
  const existing=categories.find(c=>categoryNameKey(c.name)===categoryNameKey(name));
  if(existing)return {category:existing,created:false};
  const safeCode=code&&/^[\p{L}\p{N}_.-]+$/u.test(code)&&!categories.some(c=>c.code===code)?code:nextCategoryCode(categories);
  return {category:{name,code:safeCode},created:true};
 }
 const existing=categories.find(c=>c.code===(code||input.categoryCode));
 return {category:existing||null,created:false};
}
