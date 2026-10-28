import 'dart:async';
import 'dart:io';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:image/image.dart' as img;
import 'package:beyond_desktop/api.dart';
import 'package:beyond_desktop/input.dart';
import 'package:beyond_desktop/main.dart';
import 'package:beyond_desktop/models.dart';
import 'package:beyond_desktop/workspace.dart';

const accounts = [
  Account('005101', 'مواد كهرباء'),
  Account('005102', 'مواد سباكة'),
];
Invoice fixture() => Invoice({
  'id': 'fixture',
  'supplier': 'مؤسسة اي وان',
  'number': '50',
  'date': '2025-11-24',
  'categoryCode': '005101',
  'netCents': 100000,
  'taxCents': 15000,
  'grossCents': 115000,
  'amountSource': 'printed_total',
  'description': 'مشتريات مواد كهرباء',
  'reportedSubtotalCents': 100000,
  'reportedTaxCents': 15000,
  'reportedTotalCents': 115000,
  'status': 'review',
  'createdAt': '2025-11-24T12:00:00Z',
  'sourceName': 'fixture.jpg',
  'sourceHash': '',
  'page': 1,
  'warnings': <String>[],
  'duplicateReason': '',
});
InvoicePage page() => InvoicePage(
  id: 'p1',
  name: 'invoice.jpg',
  bytes: Uint8List.fromList(img.encodeJpg(img.Image(width: 10, height: 10))),
);

class DeferredApi extends BeyondApi {
  final pending = Completer<({Invoice invoice, String handwritten})>();
  bool cancelled = false;
  DeferredApi()
    : super(RuntimeConfig(Uri.parse('https://beyond.test'), 'test-token'));
  @override
  Future<({Invoice invoice, String handwritten})> extract(InvoicePage page) =>
      pending.future;
  @override
  void cancelExtraction() {
    cancelled = true;
    super.cancelExtraction();
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  test('journal label and its VAT pair preserve complete Arabic metadata', () {
    final invoice = fixture();
    const label = 'مؤسسة اي وان فاتورة رقم 50 بتاريخ 24/11/2025 مواد كهرباء';
    expect(invoice.label(accounts), label);
    expect(invoice.label(accounts, vat: true), 'قيمة مضافة $label');
    expect(invoice.account, '005101');
  });
  test('manual net adds VAT once and manual VAT leaves net untouched', () {
    final invoice = fixture().amount(false, 200000);
    expect(invoice.net, 200000);
    expect(invoice.tax, 30000);
    final corrected = invoice.amount(true, 29999);
    expect(corrected.net, 200000);
    expect(corrected.data['grossCents'], 229999);
  });
  test(
    'amount parsing handles Arabic digits and rejects negatives and extra decimals',
    () {
      expect(parseCents('١٬١٥٠٫٢٥'), 115025);
      expect(parseCents('1,150.25'), 115025);
      expect(parseCents('-15'), isNull);
      expect(parseCents('1.555'), isNull);
    },
  );
  test('normalizing an image produces memory-only JPEG bytes', () {
    final bytes = Uint8List.fromList(
      img.encodePng(img.Image(width: 70, height: 100)),
    );
    final result = normalizeImage(bytes);
    expect(result[0], 0xff);
    expect(result[1], 0xd8);
    expect(img.decodeJpg(result)!.height, 100);
  });
  test(
    'clearing cancels requests and late results cannot recreate invoices',
    () async {
      final api = DeferredApi(), w = Workspace(api: DeferredApi());
      w.api!.close();
      w.api = api;
      w.loading = false;
      w.accounts = accounts;
      w.pages.add(page());
      final task = w.process();
      expect(w.processing, isTrue);
      w.clear();
      expect(api.cancelled, isTrue);
      api.pending.complete((invoice: fixture(), handwritten: ''));
      await task;
      expect(w.pages, isEmpty);
      expect(w.invoices, isEmpty);
      w.dispose();
    },
  );
  test(
    'native scanner bytes enter the session without a temporary file',
    () async {
      final bytes = page().bytes;
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(scanner, (call) async {
            expect(call.method, 'scan');
            return [bytes];
          });
      expect((await acquireScan()).single, bytes);
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(scanner, null);
    },
  );
  testWidgets(
    'empty workspace has only working controls and the journal columns',
    (tester) async {
      tester.view.physicalSize = const Size(1440, 900);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final w = Workspace()
        ..loading = false
        ..accounts = accounts;
      await tester.pumpWidget(BeyondApp(workspace: w));
      await tester.pumpAndSettle();
      for (final text in [
        'Account',
        'Lable',
        'Analtic Account',
        'Debit',
        'Credit',
        'إضافة ملفات',
        'مسح ضوئي',
        'Excel',
        'PDF',
      ]) {
        expect(find.text(text), findsOneWidget);
      }
      for (final text in [
        'الإعدادات',
        'تسجيل الدخول',
        'التقارير',
        'صاحب العهدة',
      ]) {
        expect(find.text(text), findsNothing);
      }
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets(
    'classification changes directly and bulk net edits update VAT on screen',
    (tester) async {
      tester.view.physicalSize = const Size(1440, 900);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final w = Workspace()
        ..loading = false
        ..accounts = accounts;
      final p = page()
        ..invoice = fixture()
        ..state = PageState.ready;
      w.pages.add(p);
      await tester.pumpWidget(BeyondApp(workspace: w));
      await tester.pumpAndSettle();
      await tester.tap(find.byType(DropdownButtonFormField<String>));
      await tester.pumpAndSettle();
      await tester.tap(find.text('005102 · مواد سباكة').last);
      await tester.pumpAndSettle();
      expect(p.invoice!.account, '005102');
      await tester.tap(find.text('تعديل جماعي'));
      await tester.pumpAndSettle();
      final net = find.descendant(
        of: find.byKey(const ValueKey('amount-p1-false')),
        matching: find.byType(TextFormField),
      );
      await tester.enterText(net, '2000');
      await tester.pumpAndSettle();
      expect(p.invoice!.tax, 30000);
      final vat = tester.widget<TextFormField>(
        find.descendant(
          of: find.byKey(const ValueKey('amount-p1-true')),
          matching: find.byType(TextFormField),
        ),
      );
      expect(vat.controller!.text, '300.00');
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets('desktop workspace renders an Arabic RTL preview', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(1440, 900);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.runAsync(() async {
      final icons = FontLoader('MaterialIcons')
        ..addFont(rootBundle.load('fonts/MaterialIcons-Regular.otf'));
      await icons.load();
      final font = File('C:/Windows/Fonts/segoeui.ttf');
      if (await font.exists()) {
        final loader = FontLoader('Segoe UI')
          ..addFont(font.readAsBytes().then((b) => ByteData.sublistView(b)));
        await loader.load();
      }
    });
    final w = Workspace()
      ..loading = false
      ..accounts = accounts;
    for (var n = 0; n < 4; n++) {
      final p = page();
      w.pages.add(
        InvoicePage(id: 'p$n', name: p.name, bytes: p.bytes)
          ..invoice = fixture().update({'id': 'i$n', 'number': '${50 + n}'})
          ..state = PageState.ready,
      );
    }
    final key = GlobalKey();
    await tester.pumpWidget(
      RepaintBoundary(
        key: key,
        child: BeyondApp(workspace: w),
      ),
    );
    await tester.pumpAndSettle();
    await tester.runAsync(() async {
      final boundary =
          key.currentContext!.findRenderObject()! as RenderRepaintBoundary;
      final image = await boundary.toImage();
      final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
      await Directory('work').create(recursive: true);
      await File(
        'work/desktop-preview.png',
      ).writeAsBytes(bytes!.buffer.asUint8List());
      image.dispose();
    });
    expect(tester.takeException(), isNull);
  });
}
