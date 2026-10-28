import {authorizeDesktop} from '@/lib/desktop-auth';
import {desktopExportInput,desktopHeaders} from '@/lib/desktop-data';
import {createExcelBytes} from '@/lib/export';
import {errorResponse} from '@/lib/server';
export const runtime='nodejs';
export async function POST(request:Request){try{const {owner}=authorizeDesktop(request,'export');const {invoices,categories}=await desktopExportInput(request,owner);const bytes=await createExcelBytes(invoices,categories,{company:'Beyond',retentionHours:24});return new Response(bytes as BodyInit,{headers:{...desktopHeaders,'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':'attachment; filename=Beyond-Journal.xlsx'}});}catch(error){return errorResponse(error);}}
