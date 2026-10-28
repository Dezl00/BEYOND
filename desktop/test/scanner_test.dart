import 'dart:async';
import 'dart:ui' as ui;
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:image/image.dart' as img;
import 'package:beyond_desktop/input.dart';
import 'package:beyond_desktop/models.dart';
import 'package:beyond_desktop/workspace.dart';

const codec = StandardMethodCodec();
final bytes = Uint8List.fromList(
  img.encodeJpg(img.Image(width: 20, height: 30)),
);
Future<bool> deliver(String id, int index, {String? overrideId}) async {
  final reply = Completer<ByteData?>();
  ui.channelBuffers.push(
    'com.beyond/scanner',
    codec.encodeMethodCall(
      MethodCall('page', {
        'sessionId': overrideId ?? id,
        'index': index,
        'bytes': bytes,
      }),
    ),
    reply.complete,
  );
  final response = await reply.future;
  return response != null && codec.decodeEnvelope(response) == true;
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  tearDown(
    () => TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(scanner, null),
  );
  test(
    'one feeder session receives every page in order and acknowledges each page',
    () async {
      final received = <int>[];
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(scanner, (call) async {
            expect(call.method, 'scan');
            final args = call.arguments as Map;
            expect(args['maxPages'], 50);
            for (var n = 1; n <= 4; n++) {
              expect(await deliver(args['sessionId'] as String, n), isTrue);
              expect(received.last, n);
            }
            return {
              'pages': 4,
              'feeder': true,
              'warning': '',
              'cancelled': false,
            };
          });
      final result = await acquireScan(
        maxPages: 50,
        onPage: (page, index) async {
          expect(page, bytes);
          received.add(index);
        },
      );
      expect(received, [1, 2, 3, 4]);
      expect(result.feeder, isTrue);
      expect(result.warning, isEmpty);
    },
  );
  test('late pages from another session cannot enter the workspace', () async {
    var added = 0;
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(scanner, (call) async {
          final args = call.arguments as Map;
          expect(
            await deliver(
              args['sessionId'] as String,
              1,
              overrideId: 'expired-session',
            ),
            isFalse,
          );
          return {'cancelled': true};
        });
    await acquireScan(
      maxPages: 50,
      onPage: (page, index) async {
        added++;
      },
    );
    expect(added, 0);
  });
  test(
    'workspace keeps all scanned pages when the feeder reports a paper jam',
    () async {
      final w = Workspace()..loading = false;
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(scanner, (call) async {
            final id = (call.arguments as Map)['sessionId'] as String;
            expect(await deliver(id, 1), isTrue);
            expect(await deliver(id, 2), isTrue);
            return {
              'pages': 2,
              'feeder': true,
              'warning': 'انحشار ورق',
              'cancelled': false,
            };
          });
      await w.scan();
      expect(w.pages.length, 2);
      expect(w.pages.map((p) => p.name), ['مسح ضوئي 1', 'مسح ضوئي 2']);
      expect(w.error, 'انحشار ورق');
      expect(w.scanning, isFalse);
      w.dispose();
    },
  );
  test('remaining batch capacity is passed before scanning begins', () async {
    final w = Workspace()..loading = false;
    for (var n = 0; n < 49; n++) {
      w.pages.add(InvoicePage(id: 'old-$n', name: 'old', bytes: bytes));
    }
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(scanner, (call) async {
          final args = call.arguments as Map;
          expect(args['maxPages'], 1);
          expect(await deliver(args['sessionId'] as String, 1), isTrue);
          return {
            'pages': 1,
            'feeder': true,
            'warning': 'وصلت الدفعة إلى 50 فاتورة.',
          };
        });
    await w.scan();
    expect(w.pages.length, 50);
    expect(w.error, contains('50'));
    w.dispose();
  });
  test(
    'Stop cancels the active native session and preserves completed pages',
    () async {
      final first = Completer<void>(), stopped = Completer<void>();
      final w = Workspace()..loading = false;
      String? active;
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(scanner, (call) async {
            final args = call.arguments as Map;
            if (call.method == 'cancel') {
              expect(args['sessionId'], active);
              stopped.complete();
              return null;
            }
            active = args['sessionId'] as String;
            expect(await deliver(active!, 1), isTrue);
            first.complete();
            await stopped.future;
            return {'pages': 1, 'feeder': true, 'cancelled': true};
          });
      final task = w.scan();
      await first.future;
      expect(w.pages.length, 1);
      await w.cancelScan();
      await task;
      expect(w.pages.length, 1);
      expect(w.scanning, isFalse);
      expect(w.error, isNull);
      w.dispose();
    },
  );
  test(
    'a result arriving while a page is being prepared waits for that page',
    () async {
      final started = Completer<void>(), finish = Completer<void>();
      var complete = false;
      Future<bool>? pending;
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(scanner, (call) async {
            pending = deliver(
              (call.arguments as Map)['sessionId'] as String,
              1,
            );
            await started.future;
            return {'pages': 1, 'cancelled': true};
          });
      final task = acquireScan(
        maxPages: 50,
        onPage: (page, index) async {
          started.complete();
          await finish.future;
          complete = true;
        },
      );
      await started.future;
      await Future<void>.delayed(Duration.zero);
      expect(complete, isFalse);
      finish.complete();
      await task;
      expect(complete, isTrue);
      expect(await pending, isTrue);
    },
  );
  test('cancelling scanner selection leaves the workspace empty', () async {
    final w = Workspace()..loading = false;
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
          scanner,
          (call) async => {'pages': 0, 'cancelled': true},
        );
    await w.scan();
    expect(w.pages, isEmpty);
    expect(w.error, isNull);
    expect(w.scanning, isFalse);
    w.dispose();
  });
}
