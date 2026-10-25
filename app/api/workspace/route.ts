import {ApiError,credentials,errorResponse,ownerId,protectOrigin,readWorkspace,writeWorkspace} from '@/lib/server';
import {workspaceSchema} from '@/lib/schemas';
import {invoiceProblems} from '@/lib/domain';
export async function GET(request:Request){try{
 const owner=await ownerId(request),c=await credentials(request,owner);
 if(!c.databaseUrl) return Response.json({configured:false},{headers:{'Cache-Control':'no-store'}});
 return Response.json({configured:true,workspace:await readWorkspace(c.databaseUrl,owner)},{headers:{'Cache-Control':'no-store'}});
}catch(e){return errorResponse(e);}}
export async function POST(request:Request){try{
 protectOrigin(request);const owner=await ownerId(request),c=await credentials(request,owner);
 if(!c.databaseUrl) throw new ApiError('فعّل اتصال Neon أولًا.',503);
 if(Number(request.headers.get('content-length')||0)>8*1024*1024) throw new ApiError('حجم البيانات كبير لهذه الدفعة.',413);
 const parsed=workspaceSchema.safeParse(await request.json());if(!parsed.success) throw new ApiError('بعض البيانات غير صالحة للحفظ.');
 const state=parsed.data;
 for(const invoice of state.invoices) if(invoice.status==='approved'&&invoiceProblems(invoice,state.categories).length) throw new ApiError('تعذر اعتماد فاتورة بها حقول ناقصة أو اختلافات حسابية.');
 if(new Set(state.categories.map(c=>c.code)).size!==state.categories.length) throw new ApiError('أكواد التصنيفات يجب أن تكون غير مكررة.');
 return Response.json({revision:await writeWorkspace(c.databaseUrl,owner,state)});
}catch(e){return errorResponse(e);}}
