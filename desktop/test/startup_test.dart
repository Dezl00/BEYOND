import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:beyond_desktop/startup.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  tearDown(
    () => TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(startupChannel, null),
  );
  test(
    'native startup handshake sends readiness without invoice data',
    () async {
      var calls = 0;
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(startupChannel, (call) async {
            calls++;
            expect(call.method, 'ready');
            expect(call.arguments, isNull);
            return null;
          });
      expect(await notifyNativeReady(), isTrue);
      expect(calls, 1);
    },
  );
  test('a missing native host does not crash the Flutter workspace', () async {
    expect(await notifyNativeReady(), isFalse);
  });
  test('a native startup error is contained', () async {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(startupChannel, (call) async {
          throw PlatformException(code: 'unavailable');
        });
    expect(await notifyNativeReady(), isFalse);
  });
}
