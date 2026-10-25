'use client';
import {X,LoaderCircle,Camera,RefreshCw,Check} from 'lucide-react';
import {useEffect,useRef,useState} from 'react';
export function Logo({compact=false}:{compact?:boolean}){
 return <div className="brand"><span className="brand-symbol"><svg width="27" height="30" viewBox="0 0 27 30" fill="none" aria-hidden="true"><path d="M3 2h8v10l9-6 5 7-14 10H3V2Z" fill="currentColor"/><path d="m11 23 9-6 5 7-9 6H3v-7h8Z" fill="currentColor" opacity=".48"/></svg></span>{!compact&&<span className="brand-word"><b>beyond<span>.</span></b><small>فواتير، بوضوح أكبر</small></span>}</div>;
}
export function Modal({children,onClose,wide=false,label}:{children:React.ReactNode;onClose:()=>void;wide?:boolean;label:string}){
 const ref=useRef<HTMLDivElement>(null);const close=useRef(onClose);close.current=onClose;
 useEffect(()=>{const old=document.activeElement as HTMLElement;const overflow=document.body.style.overflow;document.body.style.overflow='hidden';
 const key=(e:KeyboardEvent)=>{if(e.key==='Escape')close.current();if(e.key==='Tab'){const focusable=ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]');if(!focusable?.length)return;const first=focusable[0],last=focusable[focusable.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}};
 document.addEventListener('keydown',key);ref.current?.focus();return()=>{document.body.style.overflow=overflow;document.removeEventListener('keydown',key);old?.focus();};},[]);
 return <div className={'modal-backdrop '+(wide?'wide':'')} onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><div className={'modal '+(wide?'modal-wide':'')} role="dialog" aria-modal="true" aria-label={label} ref={ref} tabIndex={-1}>{children}</div></div>;
}
export function Spinner(){return <LoaderCircle size={17} className="spin"/>;}
export function CameraModal({onClose,onCapture}:{onClose:()=>void;onCapture:(f:File)=>void}){
 const video=useRef<HTMLVideoElement>(null);const stream=useRef<MediaStream|null>(null);const [error,setError]=useState('');
 useEffect(()=>{let disposed=false;navigator.mediaDevices?.getUserMedia({video:{facingMode:'environment',width:{ideal:1920}},audio:false}).then(s=>{if(disposed){s.getTracks().forEach(t=>t.stop());return;}stream.current=s;if(video.current)video.current.srcObject=s;}).catch(()=>setError('تعذر تشغيل الكاميرا. اسمح بالوصول إليها، أو ارفع صورة من الجهاز.'));if(!navigator.mediaDevices)setError('الكاميرا تحتاج متصفحًا يدعمها واتصال HTTPS.');return()=>{disposed=true;stream.current?.getTracks().forEach(t=>t.stop());};},[]);
 function capture(){const v=video.current;if(!v||!v.videoWidth)return;const c=document.createElement('canvas');c.width=v.videoWidth;c.height=v.videoHeight;c.getContext('2d')!.drawImage(v,0,0);c.toBlob(b=>{if(b){onCapture(new File([b],'فاتورة-كاميرا-'+Date.now()+'.jpg',{type:'image/jpeg'}));onClose();}},'image/jpeg',.94);}
 return <Modal onClose={onClose} label="تصوير فاتورة"><div className="modal-heading"><div><h2>صوّر فاتورتك</h2><p>ضع الفاتورة كاملة داخل الإطار وبإضاءة واضحة.</p></div><button className="icon-button" onClick={onClose} aria-label="إغلاق"><X size={20}/></button></div>{error?<div className="notice warning">{error}</div>:<video ref={video} autoPlay playsInline muted className="camera-video"/>}<div className="modal-footer"><button className="btn" onClick={onClose}>إلغاء</button><button className="btn primary" onClick={capture} disabled={!!error}><Camera size={17}/>التقاط الفاتورة</button></div></Modal>;
}
