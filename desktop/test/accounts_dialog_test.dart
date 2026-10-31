import 'dart:convert';
import 'dart:io';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:beyond_desktop/accounts_dialog.dart';
import 'package:beyond_desktop/api.dart';
import 'package:beyond_desktop/design.dart';
import 'package:beyond_desktop/models.dart';
import 'package:beyond_desktop/workspace.dart';

void main() {
  test('pasted account codes retain leading zeros and reject duplicates', () {
    expect(
      parseAccountLines('005101\tكهرباء\n005102 | سباكة').map((a) => a.code),
      ['005101', '005102'],
    );
    expect(() => parseAccountLines('001 | أ\n001 | ب'), throwsFormatException);
    expect(() => parseAccountLines('لا يوجد فاصل'), throwsFormatException);
  });
  testWidgets('accounts can be added from the redesigned desktop form', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(1440, 900);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    var writes = 0;
    final w =
        Workspace(
            automaticAccountSync: false,
            api: BeyondApi(
              RuntimeConfig(Uri.parse('https://beyond.test'), 'test-token'),
              client: MockClient((request) async {
                expect(request.method, 'POST');
                writes++;
                expect(jsonDecode(request.body), {
                  'action': 'add',
                  'categories': [
                    {'code': '005102', 'name': 'مواد سباكة'},
                  ],
                });
                return http.Response(
                  jsonEncode({
                    'categories': [
                      {'code': '005101', 'name': 'مواد كهرباء'},
                      {'code': '005102', 'name': 'مواد سباكة'},
                    ],
                  }),
                  200,
                  headers: {
                    'content-type': 'application/json; charset=utf-8',
                    'etag': '"new"',
                  },
                );
              }),
            ),
          )
          ..loading = false
          ..accounts = [const Account('005101', 'مواد كهرباء')];
    addTearDown(w.dispose);
    await tester.runAsync(() async {
      await (FontLoader(
        'MaterialIcons',
      )..addFont(rootBundle.load('fonts/MaterialIcons-Regular.otf'))).load();
      await (FontLoader(plex)
            ..addFont(
              rootBundle.load('assets/fonts/IBMPlexSansArabic-Regular.ttf'),
            )
            ..addFont(
              rootBundle.load('assets/fonts/IBMPlexSansArabic-Medium.ttf'),
            ))
          .load();
    });
    final key = GlobalKey();
    await tester.pumpWidget(
      RepaintBoundary(
        key: key,
        child: MaterialApp(
          debugShowCheckedModeBanner: false,
          theme: beyondTheme(),
          home: Directionality(
            textDirection: TextDirection.rtl,
            child: Scaffold(body: AccountsDialog(workspace: w)),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.enterText(
      find.byKey(const ValueKey('catalog-code')),
      '005102',
    );
    await tester.enterText(
      find.byKey(const ValueKey('catalog-name')),
      'مواد سباكة',
    );
    await tester.pumpAndSettle();
    await tester.runAsync(() async {
      final image =
          await (key.currentContext!.findRenderObject()!
                  as RenderRepaintBoundary)
              .toImage();
      final data = await image.toByteData(format: ui.ImageByteFormat.png);
      await Directory('work').create(recursive: true);
      await File(
        'work/accounts-preview.png',
      ).writeAsBytes(data!.buffer.asUint8List());
      image.dispose();
    });
    await tester.tap(find.text('إضافة الحساب'));
    await tester.pumpAndSettle();
    expect(writes, 1);
    expect(w.accounts.last.code, '005102');
    expect(find.text('تم الحفظ والمزامنة'), findsOneWidget);
    expect(w.pages, isEmpty);
    expect(tester.takeException(), isNull);
  });
  testWidgets('account validation remains usable in a compact window', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(900, 620);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final w = Workspace()..loading = false;
    addTearDown(w.dispose);
    await tester.pumpWidget(
      MaterialApp(
        theme: beyondTheme(),
        home: Directionality(
          textDirection: TextDirection.rtl,
          child: Scaffold(body: AccountsDialog(workspace: w)),
        ),
      ),
    );
    await tester.tap(find.text('إضافة الحساب'));
    await tester.pumpAndSettle();
    expect(find.text('أدخل كود الحساب'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
  testWidgets(
    'existing account codes and names can be edited and deletion is confirmed',
    (tester) async {
      tester.view.physicalSize = const Size(1200, 800);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      var writes = 0;
      final w =
          Workspace(
              automaticAccountSync: false,
              api: BeyondApi(
                RuntimeConfig(Uri.parse('https://beyond.test'), 'test-token'),
                client: MockClient((request) async {
                  final body = jsonDecode(request.body) as Map;
                  writes++;
                  if (writes == 1) {
                    expect(body, {
                      'action': 'update',
                      'previous': {'code': '001', 'name': 'قديم'},
                      'category': {'code': '002', 'name': 'جديد'},
                    });
                    return http.Response(
                      jsonEncode({
                        'categories': [
                          {'code': '002', 'name': 'جديد'},
                        ],
                      }),
                      200,
                      headers: {
                        'content-type': 'application/json; charset=utf-8',
                      },
                    );
                  }
                  expect(body, {
                    'action': 'delete',
                    'category': {'code': '002', 'name': 'جديد'},
                  });
                  return http.Response(
                    '{"categories":[]}',
                    200,
                    headers: {
                      'content-type': 'application/json; charset=utf-8',
                    },
                  );
                }),
              ),
            )
            ..loading = false
            ..accounts = [const Account('001', 'قديم')];
      addTearDown(w.dispose);
      await tester.pumpWidget(
        MaterialApp(
          theme: beyondTheme(),
          home: Directionality(
            textDirection: TextDirection.rtl,
            child: Scaffold(body: AccountsDialog(workspace: w)),
          ),
        ),
      );
      await tester.tap(find.text('قديم'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byKey(const ValueKey('catalog-code')), '002');
      await tester.enterText(
        find.byKey(const ValueKey('catalog-name')),
        'جديد',
      );
      await tester.tap(find.text('حفظ التعديل'));
      await tester.pumpAndSettle();
      expect(w.accounts.single.code, '002');
      await tester.tap(find.text('جديد').first);
      await tester.pumpAndSettle();
      await tester.tap(find.text('حذف الحساب'));
      await tester.pumpAndSettle();
      expect(find.byType(DeleteAccountDialog), findsOneWidget);
      expect(writes, 1);
      await tester.tap(find.text('حذف'));
      await tester.pumpAndSettle();
      expect(w.accounts, isEmpty);
      expect(writes, 2);
      expect(tester.takeException(), isNull);
    },
  );
}
