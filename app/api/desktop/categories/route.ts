import {authorizeDesktop} from '@/lib/desktop-auth';
import {readDesktopCategories,desktopHeaders} from '@/lib/desktop-data';
import {errorResponse} from '@/lib/server';
export const runtime='nodejs';
export async function GET(request:Request){try{const {owner}=authorizeDesktop(request,'categories');return Response.json({categories:await readDesktopCategories(owner)},{headers:desktopHeaders});}catch(error){return errorResponse(error);}}
