import ts from 'typescript';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
const output=resolve('work/accounting-tests');
for(const file of ['lib/extract-invoice.ts','lib/company-tax.ts','tests/company-tax.test.ts','lib/desktop-accounts.ts','tests/desktop-accounts.test.ts','lib/category-response.ts','tests/category-response.test.ts','lib/desktop-auth.ts','tests/desktop.test.ts','lib/domain.ts','lib/schemas.ts','lib/gemini.ts','tests/fixtures/invoices.ts','tests/domain.test.ts','tests/gemini.test.ts','components/ui.tsx','components/review.tsx','tests/review.test.ts','lib/storage.ts','tests/mock-kv.ts','tests/storage.test.ts','lib/categories.ts','lib/pdf-canvas.ts','lib/export.ts','components/export-actions.tsx','tests/categories.test.ts','tests/pdf-layout.test.ts','lib/password.ts','lib/server.ts','tests/mock-auth-db.ts','app/api/auth/route.ts','app/api/auth/password/route.ts','tests/password.test.ts','tests/journal.test.ts']){
 const target=resolve(output,file.replace(/\.tsx?$/,'.js'));mkdirSync(dirname(target),{recursive:true});
 writeFileSync(target,ts.transpileModule(readFileSync(file,'utf8').replaceAll("'idb-keyval'","'../tests/mock-kv'").replaceAll("@/lib/server",resolve(output,'lib/server.js').replaceAll('\\','/')).replaceAll("from './auth-db'","from '../tests/mock-auth-db'").replaceAll("@/lib/export","../lib/export").replaceAll("@/lib/domain","../lib/domain").replaceAll("@/lib/storage","./review-dependencies").replaceAll("@/lib/files","./review-dependencies"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true,jsx:ts.JsxEmit.ReactJSX}}).outputText);
}
writeFileSync(resolve(output,'components/review-dependencies.js'),'exports.loadSource=async()=>null;exports.sourcePreview=async()=>\'\';');
writeFileSync(resolve(output,'package.json'),'{"type":"commonjs"}');
const test=spawnSync(process.execPath,['--test',resolve(output,'tests/company-tax.test.js'),resolve(output,'tests/desktop-accounts.test.js'),resolve(output,'tests/category-response.test.js'),resolve(output,'tests/desktop.test.js'),resolve(output,'tests/domain.test.js'),resolve(output,'tests/gemini.test.js'),resolve(output,'tests/review.test.js'),resolve(output,'tests/storage.test.js'),resolve(output,'tests/categories.test.js'),resolve(output,'tests/pdf-layout.test.js'),resolve(output,'tests/password.test.js'),resolve(output,'tests/journal.test.js')],{stdio:'inherit'});
process.exit(test.status??1);
