import WorkspaceApp from '@/components/workspace-app';
import Login from '@/components/login';
import {cookies} from 'next/headers';
import {authenticatedToken} from '@/lib/server';
export const dynamic='force-dynamic';
export default async function Page(){
 const token=(await cookies()).get('beyond_session')?.value;
 const authenticated=await authenticatedToken(token);
 return authenticated?<WorkspaceApp/>:<Login configured={!!process.env.APP_PASSWORD&&!!process.env.APP_ENCRYPTION_KEY}/>;
}
