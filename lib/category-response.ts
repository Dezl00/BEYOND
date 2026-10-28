import {createHash} from 'node:crypto';
import type {Category} from './domain';
const headers={'Cache-Control':'no-store, private','Pragma':'no-cache','X-Content-Type-Options':'nosniff'};
export function categoryResponse(request:Request,categories:Category[]){
 const etag='"accounts-'+createHash('sha256').update(JSON.stringify(categories)).digest('hex')+'"';
 const matching=request.headers.get('if-none-match')?.split(',').some(value=>value.trim()==='*'||value.trim().replace(/^W\//,'')===etag);
 if(matching)return new Response(null,{status:304,headers:{...headers,ETag:etag}});
 return Response.json({categories},{headers:{...headers,ETag:etag}});
}
