import {neon} from '@neondatabase/serverless';
import {PDFDocument,StandardFonts} from 'pdf-lib';
const input=await new Promise((resolve,reject)=>{let text='';const terminal=process.stdin.isTTY;if(terminal){process.stdin.setRawMode(true);console.error('Ready for service credentials on stdin (hidden).');}const done=()=>{process.stdin.removeAllListeners('data');if(terminal)process.stdin.setRawMode(false);process.stdin.pause();try{resolve(JSON.parse(text));}catch{reject(new Error('Invalid configuration input'));}};process.stdin.setEncoding('utf8');process.stdin.on('data',chunk=>{text+=chunk;if(text.includes('\n')||text.includes('\r'))done();});process.stdin.resume();});
const result={neon:false,gemini:false,keyIndex:-1,model:null,extraction:false,keyChecks:[]};
try{const sql=neon(input.databaseUrl);await sql.query('SELECT 1 AS connected');await sql.query('CREATE TABLE IF NOT EXISTS beyond_workspaces (owner_id TEXT PRIMARY KEY, revision INTEGER NOT NULL DEFAULT 0, data JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now())');result.neon=true;}catch(e){result.neonError=e.name;}
let selectedKey='';
for(let index=0;index<input.keys.length;index++){
 try{
  const response=await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000',{headers:{'x-goog-api-key':input.keys[index]},signal:AbortSignal.timeout(20000)});
  result.keyChecks.push({index,status:response.status});if(!response.ok)continue;
  const data=await response.json();const names=(data.models||[]).filter(m=>m.supportedGenerationMethods?.includes('generateContent')).map(m=>m.name.replace('models/',''));
  const model=['gemini-3.8-flash','gemini-3.6-flash','gemini-2.5-flash'].find(name=>names.includes(name))||names.find(name=>name.includes('flash')&&!name.includes('image')&&!name.includes('live')&&!name.includes('tts'));
  if(!model)continue;result.gemini=true;result.keyIndex=index;result.model=model;selectedKey=input.keys[index];break;
 }catch(e){result.keyChecks.push({index,error:e.cause?.code||e.name});}
}
if(selectedKey){
 try {
  const configured=await fetch('http://127.0.0.1:3000/api/settings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({apiKeys:input.keys.join(','),databaseUrl:input.databaseUrl,model:result.model})});
  if(!configured.ok)throw Error('LocalSetupError');const cookie=configured.headers.get('set-cookie').split(';')[0];
  const pdf=await PDFDocument.create();const page=pdf.addPage([595,842]);const font=await pdf.embedFont(StandardFonts.Helvetica);const bold=await pdf.embedFont(StandardFonts.HelveticaBold);
  const lines=['BEYOND TEST SUPPLIES','SYNTHETIC TEST INVOICE - NOT A REAL DOCUMENT','Invoice number: BEYOND-TEST-001','Date: 2026-10-25','VAT number: 300000000000003','','Item                      Qty   Net total   VAT 15%   Gross','Electrical cable           2      100.00      15.00    115.00','Plumbing valve             1      100.00      15.00    115.00','','Subtotal excl. VAT: 200.00 SAR','VAT 15%:              30.00 SAR','TOTAL INCL. VAT:     230.00 SAR'];
  lines.forEach((line,i)=>page.drawText(line,{x:45,y:780-i*32,size:i===0?20:11,font:i===0?bold:font}));
  const bytes=await pdf.save();const form=new FormData();form.set('file',new Blob([bytes],{type:'application/pdf'}),'beyond-test.pdf');form.set('categories',JSON.stringify([{code:'TEST-E',name:'مواد كهرباء'},{code:'TEST-P',name:'مواد سباكة'}]));
  const response=await fetch('http://127.0.0.1:3000/api/extract',{method:'POST',headers:{Cookie:cookie},body:form,signal:AbortSignal.timeout(120000)});result.extractStatus=response.status;
  const extracted=await response.json();if(response.ok){const invoice=extracted.invoice;result.extraction=invoice.number==='BEYOND-TEST-001'&&!!invoice.description&&invoice.totalIncludingTax===230&&invoice.vatAmount===30;result.extractedSample={number:invoice.number,description:invoice.description,total:invoice.totalIncludingTax,tax:invoice.vatAmount,category:invoice.categoryCode};}else result.extractError=extracted.error;
 }catch(e){result.extractError=e.name;}
}
console.log(JSON.stringify(result));
