import {stageSource} from './storage';
export type UploadJob={id:string;name:string;mime:string;bytes:ArrayBuffer;hash:string;page:number;status:'waiting'|'processing'|'done'|'error';error?:string};
export async function prepareFiles(files:File[],retentionHours:number,onProgress:(s:string)=>void,signal?:AbortSignal):Promise<UploadJob[]> {
 const jobs:UploadJob[]=[];
 for(const file of files){signal?.throwIfAborted();
  if(file.size>25*1024*1024) throw new Error(file.name+': الحد الأقصى للملف 25 ميجابايت.');
  const bytes=await file.arrayBuffer();
  if(file.type==='application/pdf'||file.name.toLowerCase().endsWith('.pdf')){
   const {PDFDocument}=await import('pdf-lib');
   let document;
   try{document=await PDFDocument.load(bytes);}catch{throw new Error('تعذر فتح '+file.name+'. تأكد أنه PDF سليم وغير محمي بكلمة مرور.');}
   if(jobs.length+document.getPageCount()>50) throw new Error('الدفعة الواحدة تدعم حتى 50 فاتورة / صفحة. قسّم الملفات إلى دفعات.');
   const originalHash=await sha256(bytes);
   for(let p=0;p<document.getPageCount();p++){signal?.throwIfAborted();
    onProgress('تجهيز '+file.name+' — صفحة '+(p+1));
    const one=await PDFDocument.create();const [page]=await one.copyPages(document,[p]);one.addPage(page);
    const split=await one.save(); const buffer=split.slice().buffer as ArrayBuffer;
    // Hash the original bytes and page index: PDF writers may add different metadata on repeated imports.
    const job:UploadJob={id:crypto.randomUUID(),name:file.name,mime:'application/pdf',bytes:buffer,hash:originalHash+':'+(p+1),page:p+1,status:'waiting'};
    signal?.throwIfAborted();stageSource(job.id,{bytes:buffer,mime:job.mime,name:job.name,expiresAt:Date.now()+retentionHours*3600000});jobs.push(job);
   }
  }else{
   if(!['image/jpeg','image/png','image/webp'].includes(file.type)) throw new Error('صيغة غير مدعومة: '+file.name+'. استخدم JPG أو PNG أو WEBP أو PDF.');
   if(jobs.length>=50) throw new Error('الدفعة الواحدة تدعم حتى 50 فاتورة.');
   const job:UploadJob={id:crypto.randomUUID(),name:file.name,mime:file.type,bytes,hash:await sha256(bytes),page:1,status:'waiting'};
   signal?.throwIfAborted();stageSource(job.id,{bytes,mime:job.mime,name:job.name,expiresAt:Date.now()+retentionHours*3600000});jobs.push(job);
  }
 }
 return jobs;
}
export async function sha256(bytes:ArrayBuffer){const hash=await crypto.subtle.digest('SHA-256',bytes);return Array.from(new Uint8Array(hash)).map(n=>n.toString(16).padStart(2,'0')).join('');}
export async function sourcePreview(bytes:ArrayBuffer,mime:string):Promise<string>{
 if(mime==='application/pdf'){
  const pdfjs=await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc='/pdf.worker.min.mjs';
  const doc=await pdfjs.getDocument({data:bytes.slice(0)}).promise;
  try{
   const page=await doc.getPage(1);const viewport=page.getViewport({scale:1.6});
   const canvas=document.createElement('canvas');canvas.width=viewport.width;canvas.height=viewport.height;
   await page.render({canvas,canvasContext:canvas.getContext('2d')!,viewport}).promise;
   return canvas.toDataURL('image/png');
  }finally{await doc.destroy();}
 }
 return URL.createObjectURL(new Blob([bytes],{type:mime}));
}
export function base64(bytes:ArrayBuffer) {
 let result='';const view=new Uint8Array(bytes);
 for(let i=0;i<view.length;i+=32768) result+=String.fromCharCode(...view.subarray(i,i+32768));
 return btoa(result);
}

export async function extractionPayload(job:UploadJob):Promise<Blob>{
 const limit=3.8*1024*1024;
 if(job.bytes.byteLength<=limit)return new Blob([job.bytes],{type:job.mime});
 let canvas:HTMLCanvasElement;
 if(job.mime==='application/pdf'){
  const pdfjs=await import('pdfjs-dist');pdfjs.GlobalWorkerOptions.workerSrc='/pdf.worker.min.mjs';
  const doc=await pdfjs.getDocument({data:job.bytes.slice(0)}).promise;
  try{const page=await doc.getPage(1),base=page.getViewport({scale:1});const viewport=page.getViewport({scale:Math.min(3,3000/Math.max(base.width,base.height))});canvas=document.createElement('canvas');canvas.width=viewport.width;canvas.height=viewport.height;await page.render({canvas,canvasContext:canvas.getContext('2d')!,viewport,background:'#ffffff'}).promise;}finally{await doc.destroy();}
 }else{
  const bitmap=await createImageBitmap(new Blob([job.bytes],{type:job.mime}));const scale=Math.min(1,3000/Math.max(bitmap.width,bitmap.height));canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);const ctx=canvas.getContext('2d')!;ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
 }
 for(const quality of [.94,.86,.76,.64]){const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/jpeg',quality));if(blob&&blob.size<=limit)return blob;}
 throw new Error('هذه الصفحة كبيرة جدًا للإرسال. استخدم صورة أصغر أو PDF بدقة أقل.');
}
