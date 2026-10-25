import ts from 'typescript';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
const output=resolve('work/accounting-tests');
for(const file of ['lib/domain.ts','lib/demo.ts','tests/domain.test.ts']){
 const target=resolve(output,file.replace(/\.ts$/,'.js'));mkdirSync(dirname(target),{recursive:true});
 writeFileSync(target,ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText);
}
writeFileSync(resolve(output,'package.json'),'{"type":"commonjs"}');
const test=spawnSync(process.execPath,['--test',resolve(output,'tests/domain.test.js')],{stdio:'inherit'});
process.exit(test.status??1);
