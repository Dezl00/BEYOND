import {extractInvoice,extractionError} from '@/lib/extract-invoice';
import {ApiError,credentials,errorResponse,ownerId,protectOrigin} from '@/lib/server';
import {categorySchema} from '@/lib/schemas';
export const maxDuration=300;
export async function POST(request:Request){try{
 protectOrigin(request);const owner=await ownerId(request);const config=await credentials(request,owner);
 if(Number(request.headers.get('content-length')||0)>4.2*1024*1024)throw new ApiError('الملف أكبر من الحد المسموح.',413);
 const form=await request.formData(),file=form.get('file');
 if(!(file instanceof File)||file.size>4*1024*1024||!['application/pdf','image/jpeg','image/png','image/webp'].includes(file.type))throw new ApiError('اختر صورة مدعومة أو PDF بحجم حتى 25 ميجابايت.');
 const categories=categorySchema.array().max(1000).safeParse(JSON.parse(String(form.get('categories')||'[]')));
 if(!categories.success)throw new ApiError('قائمة التصنيفات غير صالحة.');
 return Response.json({invoice:await extractInvoice(file,categories.data,config)},{headers:{'Cache-Control':'no-store'}});
}catch(error){if(error instanceof Error&&(error.name==='TimeoutError'||error.name==='AbortError'))return errorResponse(new ApiError('انتهت مهلة استخراج الفاتورة. يمكنك إعادة المحاولة.',504));return extractionError(error)||errorResponse(error);}}
