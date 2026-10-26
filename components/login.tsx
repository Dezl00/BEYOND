'use client';
import {useState} from 'react';
import {ArrowLeft,LockKeyhole,ShieldCheck,Eye,EyeOff} from 'lucide-react';
import {Logo,Spinner} from './ui';
export default function Login({configured}:{configured:boolean}){
 const [password,setPassword]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[visible,setVisible]=useState(false);
 async function submit(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');try{
  const response=await fetch('/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password})});const result=await response.json() as {error?:string};
  if(!response.ok)throw new Error(result.error||'تعذر تسجيل الدخول.');window.location.reload();
 }catch(e){setError(e instanceof Error?e.message:'تعذر الاتصال.');}finally{setBusy(false);}}
 return <main className="login-page"><div className="login-brand"><Logo/></div><section className="login-box"><span className="square-icon"><LockKeyhole size={23}/></span><span className="section-kicker">مساحة الشركة الخاصة</span><h1>مرحبًا بك في Beyond.</h1><p>ادخل إلى مساحة فواتيرك.<br/>بيانات منظمة، ومراجعة بوضوح أكبر.</p><form onSubmit={submit}><label className="form-label">كلمة المرور<div className="password-wrap"><input type={visible?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" maxLength={128} placeholder="أدخل كلمة مرور مساحة العمل" required autoFocus/><button type="button" className="icon-button" onClick={()=>setVisible(v=>!v)} aria-label={visible?'إخفاء كلمة المرور':'إظهار كلمة المرور'}>{visible?<EyeOff size={17}/>:<Eye size={17}/>}</button></div></label>{error&&<div className="login-error" role="alert">{error}</div>}{!configured&&<div className="notice warning">إعدادات الدخول غير متاحة حاليًا. تحقق من تجهيز كلمة المرور واتصال قاعدة البيانات على الخادم.</div>}<button className="btn primary full" disabled={busy||!configured}>{busy?<Spinner/>:<>الدخول إلى مساحة العمل <ArrowLeft size={17}/></>}</button></form><span className="login-note"><ShieldCheck size={14}/>دخول خاص · اتصال آمن · المراجعة بيدك</span></section><footer>Beyond فواتير · مساحة أوضح لحساباتك.</footer></main>;
}
