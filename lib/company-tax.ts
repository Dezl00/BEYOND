// Fixed company identifier supplied by the owner. Preserve every digit exactly.
export const COMPANY_TAX_ID='31135441590003';
export function hasCompanyTaxIdentifier(identifiers:readonly string[]):boolean{
 return identifiers.some(value=>value.normalize('NFKC')
  .replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632))
  .replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-1776))
  .replace(/[^0-9]/g,'')===COMPANY_TAX_ID);
}
