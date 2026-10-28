import 'dart:io';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:beyond_desktop/branding.dart';
import 'package:beyond_desktop/main.dart';
import 'package:beyond_desktop/workspace.dart';

void main() {
  testWidgets('branded splash animates into the blue account workspace', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(1440, 900);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.runAsync(() async {
      final font = File('C:/Windows/Fonts/segoeui.ttf');
      if (await font.exists()) {
        await (FontLoader(
              'Segoe UI',
            )..addFont(font.readAsBytes().then((b) => ByteData.sublistView(b))))
            .load();
      }
    });
    final key = GlobalKey();
    final workspace = Workspace()..loading = false;
    await tester.pumpWidget(
      RepaintBoundary(
        key: key,
        child: BeyondApp(workspace: workspace, showSplash: true),
      ),
    );
    expect(find.text('DEVELOPED FOR'), findsOneWidget);
    expect(find.text('BEYOND GROUP'), findsOneWidget);
    expect(find.byType(BrandHeader), findsNothing);
    await tester.pump(const Duration(milliseconds: 1500));
    await tester.runAsync(() async {
      final boundary =
          key.currentContext!.findRenderObject()! as RenderRepaintBoundary;
      final image = await boundary.toImage();
      final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
      await Directory('work').create(recursive: true);
      await File(
        'work/splash-preview.png',
      ).writeAsBytes(bytes!.buffer.asUint8List());
      image.dispose();
    });
    await tester.pump(const Duration(milliseconds: 800));
    await tester.pumpAndSettle();
    expect(find.byType(BrandSplash), findsNothing);
    expect(find.byType(BrandHeader), findsOneWidget);
    expect(find.byTooltip('مزامنة الحسابات والأكواد'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('reduced animations still complete the branded entrance', (
    tester,
  ) async {
    var finished = false;
    await tester.pumpWidget(
      MaterialApp(
        home: MediaQuery(
          data: const MediaQueryData(disableAnimations: true),
          child: BrandSplash(onComplete: () => finished = true),
        ),
      ),
    );
    await tester.pump(const Duration(milliseconds: 750));
    expect(finished, isTrue);
    expect(tester.takeException(), isNull);
  });
}
