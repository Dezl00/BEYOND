import WorkspaceApp from '@/components/workspace-app';
import Login from '@/components/login';
import {cookies} from 'next/headers';
import {authenticatedToken,passwordRecord} from '@/lib/server';
export const dynamic='force-dynamic';
export default async function Page(){
 const token=(await cookies()).get('beyond_session')?.value;
 let authenticated=false,configured=false;
 try{const record=await passwordRecord();configured=!!record&&!!process.env.APP_ENCRYPTION_KEY;authenticated=await authenticatedToken(token,record);}catch{/* Authentication fails closed when the database is unavailable. */}
 return authenticated?<WorkspaceApp/>:<Login configured={configured}/>;
}
