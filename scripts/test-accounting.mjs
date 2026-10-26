import ts from 'typescript';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
const output=resolve('work/accounting-tests');
for(const file of ['lib/domain.ts','lib/schemas.ts','lib/gemini.ts','tests/fixtures/invoices.ts','tests/domain.test.ts','tests/gemini.test.ts','components/ui.tsx','components/review.tsx','tests/review.test.ts','lib/storage.ts','tests/mock-kv.ts','tests/storage.test.ts','lib/categories.ts','lib/pdf-canvas.ts','lib/export.ts','components/export-actions.tsx','tests/categories.test.ts','tests/pdf-layout.test.ts']){
 const target=resolve(output,file.replace(/\.tsx?$/,'.js'));mkdirSync(dirname(target),{recursive:true});
 writeFileSync(target,ts.transpileModule(readFileSync(file,'utf8').replaceAll("'idb-keyval'","'../tests/mock-kv'").replaceAll("@/lib/export","../lib/export").replaceAll("@/lib/domain","../lib/domain").replaceAll("@/lib/storage","./review-dependencies").replaceAll("@/lib/files","./review-dependencies"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true,jsx:ts.JsxEmit.ReactJSX}}).outputText);
}
writeFileSync(resolve(output,'components/review-dependencies.js'),'exports.loadSource=async()=>null;exports.sourcePreview=async()=>\'\';');
writeFileSync(resolve(output,'package.json'),'{"type":"commonjs"}');
const test=spawnSync(process.execPath,['--test',resolve(output,'tests/domain.test.js'),resolve(output,'tests/gemini.test.js'),resolve(output,'tests/review.test.js'),resolve(output,'tests/storage.test.js'),resolve(output,'tests/categories.test.js'),resolve(output,'tests/pdf-layout.test.js')],{stdio:'inherit'});
process.exit(test.status??1);
