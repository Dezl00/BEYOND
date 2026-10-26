import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import Review from '../components/review';
import {emptyWorkspace} from '../lib/domain';
import {testInvoices,testCategories} from './fixtures/invoices';

const render=(manual=false)=>renderToStaticMarkup(createElement(Review,{
 initial:[{...testInvoices[0],sourceName:manual?'إدخال يدوي':'invoice.pdf',warnings:['hidden extraction note']}],
 categories:testCategories,preferences:emptyWorkspace.preferences,existing:[],onClose:()=>{},onSave:async()=>{}
}));
test('category is editable immediately while bulk editing is closed',()=>{
 const html=render();
 const selector=html.match(/<select[^>]*aria-label="تصنيف الفاتورة TEST-001 قبل الضريبة"[^>]*>/)?.[0];
 assert.ok(selector,'Invoice category selector must be present');
 assert.ok(!selector.includes('disabled'));
 assert.ok(/readonly=""/i.test(html),'Other fields can stay in preview mode');
});
test('review starts with the full-width table and optional images are collapsed',()=>{
 const html=render();
 assert.ok(html.includes('review-body table-only'));
 assert.ok(html.includes('aria-expanded="false"'));
 assert.ok(html.includes('إظهار صور الفواتير'));
 assert.ok(!html.includes('<aside'));
 assert.ok(!html.includes('<img'));
});
test('preview contains only requested invoice columns without lower panels or totals',()=>{
 const html=render();
 const headings=[...html.matchAll(/<th(?:\s[^>]*)?>(.*?)<\/th>/g)].map(m=>m[1]);
 assert.ok(headings.includes('رقم الفاتورة'));
 assert.ok(headings.includes('التاريخ'));
 assert.ok(headings.includes('التصنيف / الكود'));
 for(const removed of ['حفظ للمراجعة','الإجمالي النهائي','الرقم الضريبي','المبالغ المقروءة من الأصل','إعادة الحساب من هذه القيم','يحتاج انتباهك','hidden extraction note','review-footer','review-totals','حقل «قبل الضريبة»'])assert.ok(!html.includes(removed),removed);
});
test('manual entry opens editable invoice fields and an enabled category selector',()=>{
 const html=render(true);
 assert.ok(!/readonly=""/i.test(html));
 assert.ok(html.includes('إنهاء التعديل'));
 assert.ok(!html.match(/<select[^>]*disabled/));
});

test('preview repeats invoice metadata in two rows and displays a single amount header',()=>{
 const html=render();
 assert.equal((html.match(/data-invoice-id="test-invoice"/g)||[]).length,2);
 assert.equal((html.match(/<th>المبلغ<\/th>/g)||[]).length,1);
 assert.ok(html.includes('data-entry-type="net"'));assert.ok(html.includes('data-entry-type="tax"'));
 assert.ok(html.includes('1000.00'));assert.ok(html.includes('150.00'));assert.ok(!html.includes('1150.00'));
 assert.ok(html.includes('استيراد كل الفواتير (1)'));assert.ok(!html.includes('حفظ للمراجعة'));
});

test('review includes supplier in both rows and direct Excel/PDF export without column selection',()=>{
 const html=render();assert.ok(html.includes('اسم المورد'));assert.ok(html.includes('مؤسسة الاختبار للتوريدات'));
 assert.ok(html.includes('Excel'));assert.ok(html.includes('PDF'));assert.ok(html.includes('تصدير مباشر'));
 assert.ok(!html.includes('الأعمدة وترتيبها'));assert.ok(!html.includes('اختيار الكل'));
});
