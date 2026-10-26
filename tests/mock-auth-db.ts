import type {PasswordRecord,PasswordStore} from '../lib/password';
export let currentRecord:PasswordRecord|null=null;
const attempts=new Map<string,number>();
export function resetAuth(record:PasswordRecord|null){currentRecord=record?{...record}:null;attempts.clear();}
export function passwordDatabase(_url:string):PasswordStore{
 return {
  async get(){return currentRecord?{...currentRecord}:null;},
  async replace(expectedVersion,passwordHash,sessionVersion){if(!currentRecord||currentRecord.sessionVersion!==expectedVersion)return false;currentRecord={passwordHash,sessionVersion};return true;},
  async reserveAttempt(bucket){const count=(attempts.get(bucket)||0)+1;attempts.set(bucket,count);return count<=10;},
  async clearAttempts(bucket){attempts.delete(bucket);}
 };
}
