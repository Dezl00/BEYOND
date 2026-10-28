import {join} from 'node:path';
import {createCanvas,GlobalFonts} from '@napi-rs/canvas';
import {authorizeDesktop} from '@/lib/desktop-auth';
import {desktopExportInput,desktopHeaders} from '@/lib/desktop-data';
import {createPdfBytes} from '@/lib/export';
import type {CanvasFactory} from '@/lib/pdf-canvas';
import {errorResponse} from '@/lib/server';
export const runtime='nodejs';export const maxDuration=60;
let fontLoaded=false;
export async function POST(request:Request){try{const {owner}=authorizeDesktop(request,'export');const {invoices,categories}=await desktopExportInput(request,owner);
 if(!fontLoaded){GlobalFonts.registerFromPath(join(process.cwd(),'public/fonts/arabic.woff2'),'BeyondArabic');fontLoaded=true;}
 const bytes=await createPdfBytes(invoices,categories,{company:'Beyond',retentionHours:24},(()=>createCanvas(1,1)) as unknown as CanvasFactory);
 return new Response(bytes as BodyInit,{headers:{...desktopHeaders,'Content-Type':'application/pdf','Content-Disposition':'attachment; filename=Beyond-Journal.pdf'}});
}catch(error){return errorResponse(error);}}
