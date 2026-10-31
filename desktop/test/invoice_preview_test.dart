import 'dart:io';
import 'dart:typed_data';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:beyond_desktop/invoice_preview.dart';
import 'package:beyond_desktop/design.dart';

void main() {
  testWidgets(
    'invoice images zoom, reset, expand and retain their in-memory source',
    (tester) async {
      tester.view.physicalSize = const Size(1200, 800);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      late final Uint8List bytes;
      await tester.runAsync(() async {
        await (FontLoader(
          'MaterialIcons',
        )..addFont(rootBundle.load('fonts/MaterialIcons-Regular.otf'))).load();
        final recorder = ui.PictureRecorder();
        final canvas = Canvas(recorder);
        canvas.drawRect(
          const Rect.fromLTWH(0, 0, 500, 700),
          Paint()..color = Colors.white,
        );
        canvas.drawRect(
          const Rect.fromLTWH(36, 36, 150, 35),
          Paint()..color = blue,
        );
        for (var y = 110; y < 620; y += 40) {
          canvas.drawRect(
            Rect.fromLTWH(36, y.toDouble(), 428, 2),
            Paint()..color = line,
          );
        }
        final picture = recorder.endRecording();
        final source = await picture.toImage(500, 700);
        picture.dispose();
        final data = await source.toByteData(format: ui.ImageByteFormat.png);
        bytes = data!.buffer.asUint8List();
        source.dispose();
      });
      final key = GlobalKey();
      await tester.pumpWidget(
        RepaintBoundary(
          key: key,
          child: MaterialApp(
            theme: beyondTheme(),
            debugShowCheckedModeBanner: false,
            home: Directionality(
              textDirection: TextDirection.rtl,
              child: Scaffold(
                body: Center(
                  child: SizedBox(
                    width: 360,
                    height: 700,
                    child: InvoicePreview(
                      bytes: bytes,
                      name: 'invoice-050.jpg',
                      onClose: () {},
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('100%'), findsOneWidget);
      await tester.tap(find.byTooltip('تكبير الصورة'));
      await tester.pumpAndSettle();
      expect(find.text('125%'), findsOneWidget);
      await tester.tap(find.byTooltip('ملاءمة الصورة'));
      await tester.pumpAndSettle();
      expect(find.text('100%'), findsOneWidget);
      await tester.tap(find.byTooltip('عرض مكبر'));
      await tester.pumpAndSettle();
      expect(find.byType(Dialog), findsOneWidget);
      await tester.tap(find.byTooltip('تكبير الصورة').last);
      await tester.pumpAndSettle();
      await tester.runAsync(() async {
        final image =
            await (key.currentContext!.findRenderObject()!
                    as RenderRepaintBoundary)
                .toImage();
        final png = await image.toByteData(format: ui.ImageByteFormat.png);
        await Directory('work').create(recursive: true);
        await File(
          'work/invoice-zoom-preview.png',
        ).writeAsBytes(png!.buffer.asUint8List());
        image.dispose();
      });
      await tester.tap(find.byTooltip('إغلاق العرض المكبر'));
      await tester.pumpAndSettle();
      expect(find.byType(Dialog), findsNothing);
      expect(find.text('100%'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );
}
