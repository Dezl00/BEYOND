import {neon} from '@neondatabase/serverless';
import {PasswordError,type PasswordRecord,type PasswordStore} from './password';
const OWNER='beyond-owner';
const ready=new Map<string,Promise<void>>();
export function passwordDatabase(url:string){
 if(!url)throw new PasswordError('تعذر الوصول إلى إعدادات الدخول. راجع اتصال قاعدة البيانات على الخادم.',503);
 const sql=neon(url);
 async function ensure(){
  let pending=ready.get(url);
  if(!pending){
   pending=(async()=>{
    await sql.query('CREATE TABLE IF NOT EXISTS beyond_auth (owner_id TEXT PRIMARY KEY, password_hash TEXT NOT NULL, session_version TEXT NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now())');
    await sql.query('CREATE TABLE IF NOT EXISTS beyond_auth_attempts (bucket_hash TEXT PRIMARY KEY, attempts INTEGER NOT NULL, window_started_at TIMESTAMPTZ NOT NULL DEFAULT now())');
   })();ready.set(url,pending);pending.catch(()=>ready.delete(url));
  }
  await pending;
 }
 const store:PasswordStore={
  async get(){await ensure();const rows=await sql.query('SELECT password_hash,session_version FROM beyond_auth WHERE owner_id=$1',[OWNER]);return rows.length?{passwordHash:rows[0].password_hash,sessionVersion:rows[0].session_version}:null;},
  async replace(expectedVersion,passwordHash,sessionVersion){await ensure();const rows=await sql.query('UPDATE beyond_auth SET password_hash=$1,session_version=$2,updated_at=now() WHERE owner_id=$3 AND session_version=$4 RETURNING owner_id',[passwordHash,sessionVersion,OWNER,expectedVersion]);return rows.length===1;},
  async reserveAttempt(bucket){await ensure();const rows=await sql.query("INSERT INTO beyond_auth_attempts(bucket_hash,attempts,window_started_at) VALUES($1,1,now()) ON CONFLICT(bucket_hash) DO UPDATE SET attempts=CASE WHEN beyond_auth_attempts.window_started_at < now()-interval '15 minutes' THEN 1 ELSE beyond_auth_attempts.attempts+1 END,window_started_at=CASE WHEN beyond_auth_attempts.window_started_at < now()-interval '15 minutes' THEN now() ELSE beyond_auth_attempts.window_started_at END RETURNING attempts",[bucket]);return rows[0].attempts<=10;},
  async clearAttempts(bucket){await ensure();await sql.query('DELETE FROM beyond_auth_attempts WHERE bucket_hash=$1',[bucket]);}
 };
 return {...store,async initialize(record:PasswordRecord){await ensure();const rows=await sql.query('INSERT INTO beyond_auth(owner_id,password_hash,session_version) VALUES($1,$2,$3) ON CONFLICT(owner_id) DO NOTHING RETURNING owner_id',[OWNER,record.passwordHash,record.sessionVersion]);return rows.length===1;}};
}
