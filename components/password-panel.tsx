'use client';
import {useState} from 'react';
import {LockKeyhole,Save} from 'lucide-react';
import {toast} from 'sonner';
import {Spinner} from './ui';
export default function PasswordPanel(){
 const [currentPassword,setCurrentPassword]=useState(''),[newPassword,setNewPassword]=useState(''),[confirmation,setConfirmation]=useState(''),[saving,setSaving]=useState(false);
 async function change(event:React.FormEvent){
  event.preventDefault();
  if(newPassword!==confirmation){toast.error('تأكيد كلمة المرور لا يطابق الكلمة الجديدة.');return;}
  setSaving(true);
  try{
   const response=await fetch('/api/auth/password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({currentPassword,newPassword,confirmPassword:confirmation})});
   const result=await response.json();if(!response.ok)throw new Error(result.error||'تعذر تغيير كلمة المرور.');
   setCurrentPassword('');setNewPassword('');setConfirmation('');
   toast.success('تم تغيير كلمة المرور وإغلاق الجلسات القديمة. يمكنك الاستمرار هنا.');
  }catch(error){toast.error(error instanceof Error?error.message:'تعذر تغيير كلمة المرور.');}finally{setSaving(false);}
 }
 return <section className="panel settings-panel"><div className="panel-heading"><div><h2>كلمة مرور النظام</h2><p>غيّر كلمة الدخول من هنا. تحفظ في قاعدة البيانات، ولا تحتاج متغير بيئة لكلمة المرور.</p></div><LockKeyhole size={22}/></div><form onSubmit={change}><label className="form-label">كلمة المرور الحالية<input type="password" autoComplete="current-password" value={currentPassword} onChange={e=>setCurrentPassword(e.target.value)} required maxLength={128}/></label><label className="form-label">كلمة المرور الجديدة<input type="password" autoComplete="new-password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} required minLength={12} maxLength={128}/></label><label className="form-label">تأكيد كلمة المرور الجديدة<input type="password" autoComplete="new-password" value={confirmation} onChange={e=>setConfirmation(e.target.value)} required minLength={12} maxLength={128}/></label><p className="field-hint">12 حرفًا على الأقل. عند التغيير تتوقف جلسات الدخول القديمة.</p><button className="btn primary" disabled={saving}>{saving?<Spinner/>:<Save size={16}/>}تغيير كلمة المرور</button></form></section>;
}
