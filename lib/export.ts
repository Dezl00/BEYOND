import {type Invoice,type Preferences,exportColumns,exportRows} from './domain';
import {layoutPdfPages,paintPdfPage,type CanvasFactory} from './pdf-canvas';
const filename=(extension:string)=>'Beyond-فواتير-'+new Date().toISOString().slice(0,10)+'.'+extension;
function download(blob:Blob,name:string){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);}
export async function exportExcel(invoices:Invoice[],prefs:Preferences){
 if(!invoices.length)throw new Error('لا توجد فواتير للتصدير.');
 const {Workbook}=await import('exceljs');
 const workbook=new Workbook();workbook.creator='Beyond';workbook.created=new Date();
 const sheet=workbook.addWorksheet('الفواتير',{views:[{rightToLeft:true,state:'frozen',ySplit:5}],pageSetup:{orientation:'landscape',paperSize:9,fitToPage:true,fitToWidth:1,fitToHeight:0}});
 const records=exportRows(invoices);
 sheet.mergeCells(1,1,1,exportColumns.length);sheet.getCell(1,1).value=prefs.company+' | فواتير';sheet.getCell(1,1).font={name:'Arial',bold:true,size:22,color:{argb:'FFFFFFFF'}};sheet.getCell(1,1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF173569'}};sheet.getRow(1).height=48;
 sheet.mergeCells(2,1,2,exportColumns.length);sheet.getCell(2,1).value='كشف الفواتير — الريال السعودي SAR';sheet.getRow(2).height=26;
 sheet.mergeCells(3,1,3,exportColumns.length);sheet.getCell(3,1).value=invoices.length+' فاتورة | '+records.length+' صف';sheet.getCell(3,1).font={name:'Arial',size:11,color:{argb:'FF667085'}};
 exportColumns.forEach((column,index)=>{sheet.getColumn(index+1).width=column.key==='description'?38:column.key==='supplier'?30:22;const cell=sheet.getCell(5,index+1);cell.value=column.label;cell.font={name:'Arial',bold:true,color:{argb:'FF173569'}};cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFEDF3FF'}};cell.alignment={horizontal:'right',vertical:'middle'};});sheet.getRow(5).height=32;
 records.forEach((record,index)=>{const row=sheet.getRow(index+6);exportColumns.forEach((column,n)=>{const cell=row.getCell(n+1);cell.value=record[column.key];cell.font={name:'Arial',size:11};cell.alignment={horizontal:column.key==='amount'?'left':'right',vertical:'middle',wrapText:true};if(column.key==='amount')cell.numFmt='#,##0.00';if(Math.floor(index/2)%2===1)cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF3F7FD'}};cell.border={bottom:{style:index%2===1?'thin':'hair',color:{argb:'FFDCE5F2'}}};});row.height=42;});
 sheet.autoFilter={from:{row:5,column:1},to:{row:records.length+5,column:exportColumns.length}};
 sheet.headerFooter.oddFooter='Beyond فواتير | صفحة &P من &N';sheet.pageSetup.printTitlesRow='1:5';
 const bytes=await workbook.xlsx.writeBuffer();download(new Blob([bytes as BlobPart],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),filename('xlsx'));
}
export async function createPdfBytes(invoices:Invoice[],prefs:Preferences,createCanvas:CanvasFactory=()=>document.createElement('canvas')){
 if(!invoices.length)throw new Error('لا توجد فواتير للتصدير.');
 const {jsPDF}=await import('jspdf');
 const canvas=createCanvas(),ctx=canvas.getContext('2d');if(!ctx)throw new Error('تعذر تجهيز PDF في هذا المتصفح.');
 const pages=layoutPdfPages(ctx,exportRows(invoices));
 const pdf=new jsPDF({orientation:'landscape',unit:'mm',format:'a4',compress:true});
 for(let n=0;n<pages.length;n++){
  paintPdfPage(canvas,pages[n],prefs,n+1,pages.length,invoices.length);
  if(n)pdf.addPage('a4','landscape');
  pdf.addImage(canvas.toDataURL('image/png'),'PNG',0,0,297,210,undefined,'FAST');
 }
 canvas.width=1;canvas.height=1;
 return new Uint8Array(pdf.output('arraybuffer'));
}
export async function exportPdf(invoices:Invoice[],prefs:Preferences){
 await document.fonts.load('14px BeyondArabic');await document.fonts.ready;
 const bytes=await createPdfBytes(invoices,prefs);download(new Blob([bytes as BlobPart],{type:'application/pdf'}),filename('pdf'));
}
