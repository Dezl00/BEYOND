import {test} from 'node:test';
import assert from 'node:assert/strict';
import {layoutPdfPages,paintPdfPage} from '../lib/pdf-canvas';
import {exportRows,emptyWorkspace} from '../lib/domain';
import {testInvoices} from './fixtures/invoices';
function context(){
 const painted:string[]=[];
 return {painted,ctx:{measureText:(text:string)=>({width:Array.from(text).length*7}),fillText:(text:string)=>painted.push(text),scale(){},fillRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){}} as unknown as CanvasRenderingContext2D};
}
test('PDF draws fixed Arabic headers, supplier, account code and both amounts directly',()=>{
 const {ctx,painted}=context() as unknown as {ctx:CanvasRenderingContext2D;painted:string[]};
 const pages=layoutPdfPages(ctx,exportRows(testInvoices));const canvas={getContext:()=>ctx} as unknown as HTMLCanvasElement;
 paintPdfPage(canvas,pages[0],emptyWorkspace.preferences,1,pages.length,1);
 assert.equal(canvas.width,2244);assert.equal(canvas.height,1588);
 for(const value of ['اسم المورد','الحساب','المبلغ','TEST-1','1000.00','150.00'])assert.ok(painted.includes(value),value);
 assert.ok(!painted.includes('التصنيف'));assert.ok(!painted.includes('1150.00'));
});
test('PDF paginates all records without blank pages and keeps normal invoice pairs together',()=>{
 const {ctx}=context() as unknown as {ctx:CanvasRenderingContext2D};
 const rows=exportRows(Array.from({length:50},(_,n)=>({...testInvoices[0],id:String(n)})));
 const pages=layoutPdfPages(ctx,rows);
 assert.ok(pages.length>1);assert.equal(pages.flatMap(p=>p.rows).length,100);
 assert.ok(pages.every(p=>p.rows.length>0&&p.rows.length%2===0));
 assert.deepEqual(pages.flatMap(p=>p.rows.map(r=>r.index)),Array.from({length:100},(_,n)=>n));
});
test('long Arabic descriptions wrap inside page boundaries without dropping content',()=>{
 const {ctx}=context() as unknown as {ctx:CanvasRenderingContext2D};
 const description='مشتريات مواد كهربائية للموقع '.repeat(40);
 const rows=exportRows([{...testInvoices[0],description}]),pages=layoutPdfPages(ctx,rows);
 assert.equal(pages.flatMap(p=>p.rows).length,2);
 assert.ok(pages.every(p=>p.rows.reduce((sum,row)=>sum+row.height,0)<=526));
 assert.ok(pages[0].rows[0].lines[3].length>1);
});
