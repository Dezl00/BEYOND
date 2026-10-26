'use client';
import {useEffect,useMemo,useState} from 'react';
import {X,Pencil,CheckCheck,Undo2,FileText,ZoomIn,ZoomOut,Trash2,Save,PanelLeftClose,PanelLeftOpen,Image as ImageIcon} from 'lucide-react';
import {toast} from 'sonner';
import {Invoice,Category,money,invoiceProblems,duplicateCandidates,roundCents,editInvoiceAmount} from '@/lib/domain';
import {loadSource} from '@/lib/storage';
import {sourcePreview} from '@/lib/files';
import {Modal,Spinner} from './ui';
export default function Review({initial,categories,existing,onClose,onSave}:{initial:Invoice[];categories:Category[];existing:Invoice[];onClose:()=>void;onSave:(v:Invoice[],approved:boolean,excludedIds?:string[])=>Promise<void>}){
 const [docs,setDocs]=useState(()=>structuredClone(initial)),[editing,setEditing]=useState(initial.some(i=>i.sourceName==='إدخال يدوي')),[sourceId,setSourceId]=useState(initial[0]?.id||'');
 const [showSource,setShowSource]=useState(false),[preview,setPreview]=useState(''),[loading,setLoading]=useState(false),[sourceError,setSourceError]=useState(''),[zoom,setZoom]=useState(1);
 const [saving,setSaving]=useState(false),[selected,setSelected]=useState<Set<string>>(new Set(initial.map(d=>d.id))),[bulkCategory,setBulkCategory]=useState('');
 const problems=useMemo(()=>new Map(docs.map(d=>[d.id,invoiceProblems(d,categories)])),[docs,categories]);
 const duplicates=useMemo(()=>new Map(docs.map(d=>[d.id,duplicateCandidates(d,[...existing,...docs])])),[docs,existing]);
 useEffect(()=>{let cancelled=false,url='';setPreview('');setSourceError('');setZoom(1);
  if(!showSource||!sourceId){setLoading(false);return;}
  setLoading(true);
  (async()=>{try{const source=await loadSource(sourceId);if(!source){if(!cancelled)setSourceError('الأصل غير متاح على هذا الجهاز أو انتهت مدة الاحتفاظ به.');return;}url=await sourcePreview(source.bytes,source.mime);if(!cancelled)setPreview(url);}catch{if(!cancelled)setSourceError('تعذرت معاينة الأصل.');}finally{if(!cancelled)setLoading(false);}})();
  return()=>{cancelled=true;if(url.startsWith('blob:'))URL.revokeObjectURL(url);};
 },[sourceId,showSource]);
 function update(id:string,key:keyof Invoice,value:unknown){setDocs(previous=>previous.map(d=>d.id===id?{...d,[key]:value}:d));}
 function editAmount(id:string,key:'netCents'|'taxCents'|'grossCents',value:number){setDocs(previous=>previous.map(d=>d.id===id?editInvoiceAmount(d,key,value):d));}
 function toggle(id:string){setSelected(previous=>{const next=new Set(previous);next.has(id)?next.delete(id):next.add(id);return next;});}
 function exclude(id:string){setDocs(previous=>previous.filter(d=>d.id!==id));if(sourceId===id)setSourceId(docs.find(d=>d.id!==id)?.id||'');setSelected(previous=>new Set([...previous].filter(value=>value!==id)));}
 function applyCategory(){if(!bulkCategory)return;setDocs(previous=>previous.map(d=>selected.has(d.id)?{...d,categoryCode:bulkCategory}:d));}
 async function save(approved:boolean){
  if(approved){
   const invalid=docs.find(d=>problems.get(d.id)?.length);
   if(invalid){setEditing(true);setSourceId(invalid.id);toast.error((invalid.number||'فاتورة جديدة')+': '+problems.get(invalid.id)![0]);return;}
   const duplicate=docs.find(d=>duplicates.get(d.id)?.length&&!d.duplicateReason.trim());
   if(duplicate){setSourceId(duplicate.id);toast.error('اكتب سبب تسجيل الفاتورة المكررة داخل صفها أو استبعدها.');return;}
  }
  setSaving(true);
  try{await onSave(docs.map(d=>({...d,status:approved?'approved':'review'})),approved,initial.filter(i=>!docs.some(d=>d.id===i.id)).map(i=>i.id));onClose();}catch{toast.error('تعذر حفظ الفواتير. أعد المحاولة.');}finally{setSaving(false);}
 }
 return <Modal onClose={onClose} wide label="معاينة الفواتير بملء الشاشة">
  <div className="review-heading"><h2>معاينة الفواتير <span className="badge blue">{docs.length}</span></h2><div className="button-row"><button className="btn small-btn" aria-expanded={showSource} aria-controls="invoice-source-panel" onClick={()=>setShowSource(value=>!value)}>{showSource?<PanelLeftClose size={17}/>:<PanelLeftOpen size={17}/>} {showSource?'إخفاء الصور وتوسيع الجدول':'إظهار صور الفواتير'}</button><button className="icon-button" onClick={onClose} aria-label="إغلاق المعاينة"><X size={22}/></button></div></div>
  <div className="review-toolbar"><div className="button-row review-edit-tools"><button className={'btn '+(editing?'primary':'')} onClick={()=>setEditing(value=>!value)}><Pencil size={16}/>{editing?'إنهاء التعديل':'تعديل جماعي'}</button>{editing&&<button className="icon-button" aria-label="التراجع عن التعديلات" onClick={()=>{setDocs(structuredClone(initial));setSelected(new Set(initial.map(i=>i.id)));}}><Undo2 size={17}/></button>}<select aria-label="تصنيف الفواتير المحددة" value={bulkCategory} onChange={e=>setBulkCategory(e.target.value)}><option value="">تصنيف المحدد…</option>{categories.map(c=><option key={c.code} value={c.code}>{c.name} · {c.code}</option>)}</select><button className="btn small-btn" onClick={applyCategory} disabled={!selected.size||!bulkCategory}>تطبيق</button></div><div className="button-row review-save-tools"><button className="btn" disabled={saving} onClick={()=>save(false)}><Save size={16}/>{docs.length?'حفظ للمراجعة':'تأكيد الاستبعاد'}</button><button className="btn primary" disabled={saving||!docs.length} onClick={()=>save(true)}>{saving?<Spinner/>:<CheckCheck size={17}/>}اعتماد واستيراد</button></div></div>
  <div className={'review-body '+(showSource?'with-source':'table-only')}>
   <div className="review-data"><div className="review-table-wrap"><table className="review-table invoice-summary-table"><thead><tr><th><input type="checkbox" aria-label="تحديد كل الفواتير" checked={docs.length>0&&selected.size===docs.length} onChange={e=>setSelected(new Set(e.target.checked?docs.map(d=>d.id):[]))}/></th><th>رقم الفاتورة</th><th>التاريخ</th><th>الوصف العام للفاتورة</th><th>التصنيف / الكود</th><th>قبل الضريبة</th><th>الضريبة 15%</th><th>الإجمالي النهائي</th><th/></tr></thead><tbody>{docs.map(d=>{
    const matches=duplicates.get(d.id)||[],issues=problems.get(d.id)||[];
    const amountError=issues.find(p=>/مبالغ|الإجمالي|الضريبة/.test(p));
    return <tr key={d.id} className={sourceId===d.id?'active-invoice':''} onFocus={()=>setSourceId(d.id)} onClick={()=>setSourceId(d.id)}>
     <td><input type="checkbox" aria-label={'تحديد الفاتورة '+d.number} checked={selected.has(d.id)} onChange={()=>toggle(d.id)}/></td>
     <td><CellInput value={d.number} label="رقم الفاتورة" editing={editing} invalid={!d.number.trim()} onChange={v=>update(d.id,'number',v)}/>{matches.length>0&&<div className="duplicate-inline"><span title={matches.map(p=>p.number+' · '+p.date+' · '+money(p.grossCents)+' ر.س').join('\n')}>احتمال تكرار</span><input aria-label="سبب تسجيل الفاتورة المكررة" value={d.duplicateReason} onChange={e=>update(d.id,'duplicateReason',e.target.value)} placeholder="سبب إعادة التسجيل"/></div>}</td>
     <td><CellInput value={d.date} label="تاريخ الفاتورة" editing={editing} invalid={issues.some(p=>p.includes('تاريخ'))} type={editing?'date':'text'} onChange={v=>update(d.id,'date',v)}/></td>
     <td><textarea className={'cell-input summary-description '+(editing?'editable':'')} aria-label="الوصف العام للفاتورة" aria-invalid={!d.description.trim()} readOnly={!editing} rows={2} maxLength={1500} value={d.description} placeholder="وصف عام للفاتورة" onChange={e=>update(d.id,'description',e.target.value)}/></td>
     <td><select aria-label={'تصنيف الفاتورة '+(d.number||'الجديدة')} aria-invalid={!d.categoryCode} value={d.categoryCode} onChange={e=>update(d.id,'categoryCode',e.target.value)} className="invoice-category-select"><option value="">اختر التصنيف</option>{categories.map(c=><option key={c.code} value={c.code}>{c.name} · {c.code}</option>)}</select></td>
     <td><MoneyInput value={d.netCents} label="مبلغ الفاتورة قبل الضريبة" editing={editing} invalid={!!amountError} title={amountError} onChange={value=>editAmount(d.id,'netCents',value)}/></td>
     <td><MoneyInput value={d.taxCents} label="ضريبة الفاتورة" editing={editing} invalid={!!amountError} title={amountError} onChange={value=>editAmount(d.id,'taxCents',value)}/></td>
     <td><MoneyInput value={d.grossCents} label="الإجمالي النهائي شامل الضريبة" editing={editing} invalid={!!amountError} title={amountError} onChange={value=>editAmount(d.id,'grossCents',value)}/></td>
     <td><div className="review-row-actions"><button className="icon-button" aria-label={'عرض صورة الفاتورة '+d.number} onClick={()=>{setSourceId(d.id);setShowSource(true);}}><ImageIcon size={16}/></button>{!existing.some(i=>i.id===d.id)&&<button className="icon-button danger" aria-label="استبعاد الفاتورة من الاستيراد" onClick={()=>exclude(d.id)}><Trash2 size={16}/></button>}</div></td>
    </tr>;
   })}</tbody></table>{!docs.length&&<div className="empty-state"><FileText size={30}/><h3>تم استبعاد الفواتير من هذه الدفعة</h3></div>}</div></div>
   {showSource&&<aside className="source-panel" id="invoice-source-panel"><div className="source-top"><span>صورة الفاتورة</span><div className="zoom-tools"><button className="icon-button" aria-label="تصغير الأصل" onClick={()=>setZoom(value=>Math.max(.4,value-.15))}><ZoomOut size={17}/></button><small>{Math.round(zoom*100)}%</small><button className="icon-button" aria-label="تكبير الأصل" onClick={()=>setZoom(value=>Math.min(3,value+.15))}><ZoomIn size={17}/></button><button className="icon-button" aria-label="إخفاء الصور وتوسيع الجدول" onClick={()=>setShowSource(false)}><X size={17}/></button></div></div><select className="source-select" aria-label="اختيار صورة الفاتورة" value={sourceId} onChange={e=>setSourceId(e.target.value)}>{docs.map((d,n)=><option key={d.id} value={d.id}>{n+1}. {d.number||d.sourceName} — صفحة {d.page}</option>)}</select><div className="source-canvas">{loading?<div className="source-empty"><Spinner/></div>:preview?<img src={preview} alt="أصل الفاتورة للمراجعة" style={{width:zoom*100+'%',maxWidth:'none'}}/>:<div className="source-empty"><FileText size={35}/><p>{sourceError||'الفاتورة مدخلة يدويًا.'}</p></div>}</div></aside>}
  </div>
 </Modal>;
}
function CellInput({value,label,editing,onChange,type='text',invalid=false}:{value:string;label:string;editing:boolean;onChange:(value:string)=>void;type?:string;invalid?:boolean}){
 return <input className={'cell-input '+(editing?'editable':'')} type={type} value={value} readOnly={!editing} aria-label={label} aria-invalid={invalid} onChange={e=>onChange(e.target.value)}/>;
}
function MoneyInput({value,label,editing,onChange,invalid=false,title}:{value:number;label:string;editing:boolean;onChange:(value:number)=>void;invalid?:boolean;title?:string}){
 const [focused,setFocused]=useState(false),[draft,setDraft]=useState('');
 const display=(value/100).toFixed(2);
 return <input className={'cell-input money-input '+(editing?'editable':'')} dir="ltr" inputMode="decimal" type="text" readOnly={!editing} aria-label={label} aria-invalid={invalid} title={title} value={focused?draft:display} onFocus={()=>{setFocused(true);setDraft(display);}} onBlur={()=>setFocused(false)} onChange={e=>{const text=e.target.value;setDraft(text);const normalized=text.replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632)).replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-1776)).replace(/[,\s٬]/g,'').replace('٫','.');if(/^\d*(\.\d{0,2})?$/.test(normalized))onChange(roundCents(Number(normalized)));}}/>;
}
