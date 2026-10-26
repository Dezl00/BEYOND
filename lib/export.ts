import {type Invoice,type Preferences,type Category,exportColumns,exportRows} from './domain';
import {layoutPdfPages,paintPdfPage,type CanvasFactory} from './pdf-canvas';
const filename=(extension:string)=>'Beyond-Journal-'+new Date().toISOString().slice(0,10)+'.'+extension;
function download(blob:Blob,name:string){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);}
export async function exportExcel(invoices:Invoice[],categories:Category[],prefs:Preferences){
 if(!invoices.length)throw new Error('لا توجد فواتير للتصدير.');
 const {Workbook}=await import('exceljs');
 const workbook=new Workbook();workbook.creator=prefs.company||'Beyond';workbook.created=new Date();
 const sheet=workbook.addWorksheet('Journal',{views:[{rightToLeft:true,state:'frozen',ySplit:1}],pageSetup:{orientation:'landscape',paperSize:9,fitToPage:true,fitToWidth:1,fitToHeight:0}});
 const records=exportRows(invoices,categories);
 const widths=[22,115,24,19,19];
 exportColumns.forEach((column,index)=>{
  const col=sheet.getColumn(index+1);col.width=widths[index];if(column.key==='account')col.numFmt='@';
  const cell=sheet.getCell(1,index+1);cell.value=column.label;
  cell.font={name:'Arial',size:11,bold:true,color:{argb:'FF173569'}};
  cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFEDF3FF'}};
  cell.alignment={horizontal:'center',vertical:'middle',wrapText:false,readingOrder:'ltr'};
 });sheet.getRow(1).height=30;
 records.forEach((record,index)=>{
  const row=sheet.getRow(index+2);
  exportColumns.forEach((column,n)=>{
   const cell=row.getCell(n+1);cell.value=record[column.key];
   cell.font={name:'Arial',size:11};
   cell.alignment={horizontal:column.key==='label'?'right':column.key==='debit'?'left':'center',vertical:'middle',wrapText:false,readingOrder:column.key==='label'?'rtl':'ltr',shrinkToFit:column.key==='label'};
   if(column.key==='debit')cell.numFmt='#,##0.00';
   if(column.key==='account')cell.numFmt='@';
   if(Math.floor(index/2)%2===1)cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF3F7FD'}};
   cell.border={bottom:{style:index%2===1?'thin':'hair',color:{argb:'FFDCE5F2'}}};
  });row.height=27;
 });
 sheet.autoFilter={from:{row:1,column:1},to:{row:records.length+1,column:5}};
 sheet.pageSetup.printTitlesRow='1:1';sheet.pageSetup.printArea='A1:E'+(records.length+1);
 const bytes=await workbook.xlsx.writeBuffer();
 download(new Blob([bytes as BlobPart],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),filename('xlsx'));
}
export async function createPdfBytes(invoices:Invoice[],categories:Category[],prefs:Preferences,createCanvas:CanvasFactory=()=>document.createElement('canvas')){
 if(!invoices.length)throw new Error('لا توجد فواتير للتصدير.');
 const {jsPDF}=await import('jspdf');
 const canvas=createCanvas(),ctx=canvas.getContext('2d');if(!ctx)throw new Error('تعذر تجهيز PDF في هذا المتصفح.');
 const pages=layoutPdfPages(ctx,exportRows(invoices,categories));
 const pdf=new jsPDF({orientation:'landscape',unit:'mm',format:'a4',compress:true});
 for(let n=0;n<pages.length;n++){
  paintPdfPage(canvas,pages[n],prefs,n+1,pages.length,invoices.length);
  if(n)pdf.addPage('a4','landscape');
  pdf.addImage(canvas.toDataURL('image/png'),'PNG',0,0,297,210,undefined,'FAST');
 }
 canvas.width=1;canvas.height=1;
 return new Uint8Array(pdf.output('arraybuffer'));
}
export async function exportPdf(invoices:Invoice[],categories:Category[],prefs:Preferences){
 await document.fonts.load('14px BeyondArabic');await document.fonts.ready;
 const bytes=await createPdfBytes(invoices,categories,prefs);download(new Blob([bytes as BlobPart],{type:'application/pdf'}),filename('pdf'));
}
