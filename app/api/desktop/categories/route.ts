import {authorizeDesktop} from '@/lib/desktop-auth';
import {readDesktopCategories} from '@/lib/desktop-data';
import {categoryResponse} from '@/lib/category-response';
import {errorResponse} from '@/lib/server';
export const runtime='nodejs';
export async function GET(request:Request){try{const {owner}=authorizeDesktop(request,'categories');return categoryResponse(request,await readDesktopCategories(owner));}catch(error){return errorResponse(error);}}
