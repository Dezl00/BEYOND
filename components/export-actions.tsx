'use client';
import {useState} from 'react';
import {FileText,Columns3} from 'lucide-react';
import {toast} from 'sonner';
import type {Invoice,Preferences,Category} from '@/lib/domain';
import {exportExcel,exportPdf} from '@/lib/export';
import {Spinner} from './ui';
export default function ExportActions({invoices,categories,preferences}:{invoices:Invoice[];categories:Category[];preferences:Preferences}){
 const [busy,setBusy]=useState<'xlsx'|'pdf'|null>(null);
 async function run(format:'xlsx'|'pdf'){
  setBusy(format);
  try{if(format==='xlsx')await exportExcel(invoices,categories,preferences);else await exportPdf(invoices,categories,preferences);toast.success('تم تنزيل الملف.');}
  catch(e){toast.error(e instanceof Error?e.message:'تعذر التصدير. أعد المحاولة.');}
  finally{setBusy(null);}
 }
 return <div className="button-row direct-export" aria-label="تصدير مباشر"><button className="btn" disabled={!!busy||!invoices.length} onClick={()=>run('xlsx')}>{busy==='xlsx'?<Spinner/>:<Columns3 size={16}/>}Excel</button><button className="btn" disabled={!!busy||!invoices.length} onClick={()=>run('pdf')}>{busy==='pdf'?<Spinner/>:<FileText size={16}/>}PDF</button></div>;
}
