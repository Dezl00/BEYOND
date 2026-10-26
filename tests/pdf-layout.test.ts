import {test} from 'node:test';
import assert from 'node:assert/strict';
import {layoutPdfPages,paintPdfPage} from '../lib/pdf-canvas';
import {exportRows,emptyWorkspace,journalLabel} from '../lib/domain';
import {testInvoices,testCategories} from './fixtures/invoices';
function context(){
 const painted:string[]=[];
 const ctx={measureText:(text:string)=>({width:Array.from(text).length*6}),fillText:(text:string)=>painted.push(text),scale(){},fillRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){}} as unknown as CanvasRenderingContext2D;
 return {ctx,painted};
}
test('PDF draws the exact five journal headers and both debits with empty credit and analytic cells',()=>{
 const {ctx,painted}=context(),pages=layoutPdfPages(ctx,exportRows(testInvoices,testCategories)),canvas={getContext:()=>ctx} as unknown as HTMLCanvasElement;
 paintPdfPage(canvas,pages[0],emptyWorkspace.preferences,1,pages.length,1);
 assert.equal(canvas.width,2244);assert.equal(canvas.height,1588);
 for(const value of ['Account','Lable','Analtic Account','Debit','Credit','TEST-1','1000.00','150.00'])assert.ok(painted.includes(value),value);
 assert.ok(!painted.includes('1150.00'));assert.ok(!painted.includes('—'));
 assert.ok(painted.some(value=>value.includes('قيمة مضافة')));
});
test('PDF paginates all records without blank pages and keeps normal invoice pairs together',()=>{
 const {ctx}=context(),rows=exportRows(Array.from({length:50},(_,n)=>({...testInvoices[0],id:String(n)})),testCategories),pages=layoutPdfPages(ctx,rows);
 assert.ok(pages.length>1);assert.equal(pages.flatMap(p=>p.rows).length,100);assert.ok(pages.every(p=>p.rows.length>0&&p.rows.length%2===0));
 assert.deepEqual(pages.flatMap(p=>p.rows.map(r=>r.index)),Array.from({length:100},(_,n)=>n));
});
test('ordinary complete labels stay in one line and retain all requested metadata',()=>{
 const {ctx}=context(),invoice={...testInvoices[0],supplier:'مؤسسة اي وان',number:'50',date:'2025-11-24'};
 const pages=layoutPdfPages(ctx,exportRows([invoice],testCategories));assert.equal(pages[0].rows[0].lines[1].length,1);
 assert.equal(pages[0].rows[0].lines[1][0],journalLabel(invoice,testCategories));
});
