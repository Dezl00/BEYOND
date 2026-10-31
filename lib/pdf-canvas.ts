import {exportColumns,type Preferences,type exportRows} from './domain';
type RecordRow=ReturnType<typeof exportRows>[number];
type CellRow={lines:string[][];height:number;fontSize:number;index:number;group:number;groupEnd:boolean};
export type PdfPage={rows:CellRow[]};
export type CanvasFactory=()=>HTMLCanvasElement;
const WIDTH=1122,HEIGHT=794,LEFT=42,RIGHT=1080,TOP=201,BOTTOM=727;
const widths=[148,560,150,90,90];
const font=(size:number,bold=false)=>(bold?'600 ':'400 ')+size+'px BeyondArabic, Arial, sans-serif';
function wrap(ctx:CanvasRenderingContext2D,value:string,width:number){
 const result:string[]=[];
 for(const paragraph of value.replace(/\s+/g,' ').trim().split('\n')){
  let line='';
  for(const word of paragraph.split(/\s+/).filter(Boolean)){
   const next=line?line+' '+word:word;
   if(ctx.measureText(next).width<=width){line=next;continue;}
   if(line){result.push(line);line='';}
   if(ctx.measureText(word).width<=width){line=word;continue;}
   for(const letter of word){if(line&&ctx.measureText(line+letter).width>width){result.push(line);line='';}line+=letter;}
  }
  result.push(line);
 }
 return result.length?result:[''];
}
export function layoutPdfPages(ctx:CanvasRenderingContext2D,records:RecordRow[],groupSizes?:number[]):PdfPage[]{
 const groups:{group:number;groupEnd:boolean;first:boolean;size:number}[]=[];
 const sizes=groupSizes??Array.from({length:Math.ceil(records.length/2)},(_,n)=>Math.min(2,records.length-n*2));
 sizes.forEach((size,group)=>{for(let n=0;n<size;n++)groups.push({group,groupEnd:n===size-1,first:n===0,size});});
 const measured=records.map((record,index)=>{
  let size=14,lines:string[][]=[],height=0;
  do{
   ctx.font=font(size);
   lines=exportColumns.map((column,n)=>wrap(ctx,column.key==='debit'?Number(record.debit).toFixed(2):record[column.key]===null?'':String(record[column.key]??''),widths[n]-20));
   height=Math.max(54,Math.max(...lines.map(cell=>cell.length))*(size+6)+20);
   if((height<=BOTTOM-TOP&&(size<=10||lines.every(cell=>cell.length<=1)))||size<=7)break;
   size--;
  }while(true);
  return {lines,height,fontSize:size,index,group:groups[index]?.group??index,groupEnd:groups[index]?.groupEnd??true};
 });
 const pages:PdfPage[]=[],capacity=BOTTOM-TOP;let current:CellRow[]=[],used=0;
 for(let n=0;n<measured.length;n++){
  const row=measured[n];
  const pairHeight=groups[n]?.first?measured.slice(n,n+groups[n].size).reduce((sum,r)=>sum+r.height,0):0;
  if(current.length&&((pairHeight&&pairHeight<=capacity&&used+pairHeight>capacity)||used+row.height>capacity)){pages.push({rows:current});current=[];used=0;}
  current.push(row);used+=row.height;
 }
 if(current.length)pages.push({rows:current});
 return pages;
}
export function paintPdfPage(canvas:HTMLCanvasElement,page:PdfPage,prefs:Preferences,pageNumber:number,pageCount:number,invoiceCount:number,rowCount=invoiceCount*2){
 canvas.width=WIDTH*2;canvas.height=HEIGHT*2;
 const ctx=canvas.getContext('2d');if(!ctx)throw new Error('تعذر تجهيز PDF في هذا المتصفح.');
 ctx.scale(2,2);ctx.fillStyle='#ffffff';ctx.fillRect(0,0,WIDTH,HEIGHT);
 ctx.textBaseline='top';ctx.direction='rtl';ctx.textAlign='right';ctx.fillStyle='#173569';ctx.font=font(28,true);
 let company=prefs.company;while(ctx.measureText(company).width>700&&company.length>1)company=company.slice(0,-1);ctx.fillText(company,RIGHT,38);
 ctx.font=font(18,true);ctx.fillText('جورنا الفواتير',RIGHT,82);
 ctx.font=font(12);ctx.fillStyle='#66758c';ctx.fillText(invoiceCount+' فاتورة · '+rowCount+' صف · ريال سعودي',RIGHT,116);
 ctx.direction='ltr';ctx.textAlign='left';ctx.fillText(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Riyadh'}).format(new Date()),LEFT,48);
 ctx.strokeStyle='#2458e6';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(LEFT,145);ctx.lineTo(RIGHT,145);ctx.stroke();
 let edge=RIGHT;ctx.font=font(13,true);ctx.direction='rtl';ctx.textAlign='right';
 for(let n=0;n<exportColumns.length;n++){const x=edge-widths[n];ctx.fillStyle='#edf3ff';ctx.fillRect(x,159,widths[n],42);ctx.fillStyle='#173569';ctx.fillText(exportColumns[n].label,edge-10,172);edge=x;}
 let y=TOP;
 for(const row of page.rows){
  edge=RIGHT;ctx.font=font(row.fontSize);ctx.fillStyle=row.group%2===0?'#ffffff':'#f5f8fd';ctx.fillRect(LEFT,y,RIGHT-LEFT,row.height);
  for(let n=0;n<exportColumns.length;n++){
   const x=edge-widths[n],numeric=['account','debit','credit'].includes(exportColumns[n].key);
   ctx.direction=numeric?'ltr':'rtl';ctx.textAlign=numeric?'left':'right';ctx.fillStyle=exportColumns[n].key==='debit'?'#173569':'#354b67';
   row.lines[n].forEach((line,k)=>ctx.fillText(line,numeric?x+10:edge-10,y+10+k*(row.fontSize+6)));
   edge=x;
  }
  y+=row.height;ctx.strokeStyle=row.groupEnd?'#b8ccec':'#e7ecf3';ctx.lineWidth=row.groupEnd?1.4:.6;ctx.beginPath();ctx.moveTo(LEFT,y);ctx.lineTo(RIGHT,y);ctx.stroke();
 }
 ctx.strokeStyle='#dce4ef';ctx.lineWidth=.7;ctx.beginPath();ctx.moveTo(LEFT,751);ctx.lineTo(RIGHT,751);ctx.stroke();
 ctx.font=font(11);ctx.fillStyle='#78899f';ctx.direction='rtl';ctx.textAlign='right';ctx.fillText('Account · Lable · Analtic Account · Debit · Credit',RIGHT,764);
 ctx.direction='ltr';ctx.textAlign='left';ctx.fillText(pageNumber+' / '+pageCount,LEFT,764);
}
