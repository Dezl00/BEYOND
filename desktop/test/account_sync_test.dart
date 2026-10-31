import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:beyond_desktop/api.dart';
import 'package:beyond_desktop/models.dart';
import 'package:beyond_desktop/workspace.dart';

final config = RuntimeConfig(Uri.parse('https://beyond.test'), 'test-token');
http.Response catalog(String code, String name, String etag) => http.Response(
  jsonEncode({
    'categories': [
      {'code': code, 'name': name},
    ],
  }),
  200,
  headers: {'etag': etag, 'content-type': 'application/json; charset=utf-8'},
);
void main() {
  test(
    'account synchronization sends a conditional authenticated request and handles 304',
    () async {
      var calls = 0;
      final api = BeyondApi(
        config,
        client: MockClient((request) async {
          calls++;
          expect(request.headers['Authorization'], 'Bearer test-token');
          if (calls == 1) return catalog('005101', 'مواد كهرباء', '"v1"');
          expect(request.headers['If-None-Match'], '"v1"');
          return http.Response('', 304, headers: {'etag': '"v1"'});
        }),
      );
      final first = await api.synchronizeAccounts();
      expect(first.accounts!.single.code, '005101');
      final second = await api.synchronizeAccounts(etag: first.etag);
      expect(second.accounts, isNull);
      api.close();
    },
  );
  test(
    'refreshing accounts preserves the current invoice and user edits',
    () async {
      var calls = 0;
      final w = Workspace(
        automaticAccountSync: false,
        api: BeyondApi(
          config,
          client: MockClient((request) async {
            calls++;
            return calls == 1
                ? catalog('005101', 'مواد كهرباء', '"a"')
                : catalog('005102', 'مواد سباكة', '"b"');
          }),
        ),
      );
      w.pages.add(
        InvoicePage(id: 'invoice', name: 'source', bytes: Uint8List(0))
          ..invoice = Invoice({
            'id': 'invoice',
            'number': '0050',
            'supplier': 'المورد',
            'categoryCode': '005101',
            'netCents': 10000,
            'taxCents': 1500,
          }),
      );
      await w.initialize();
      await w.synchronizeAccounts();
      expect(w.accounts.single.code, '005102');
      expect(w.pages.single.invoice!.number, '0050');
      expect(w.pages.single.invoice!.account, '005101');
      expect(w.lastAccountSync, isNotNull);
      expect(w.accountSyncError, isNull);
      w.dispose();
    },
  );
  test(
    'a connection failure retains the current catalog and reconnecting replaces it',
    () async {
      var calls = 0;
      final w = Workspace(
        automaticAccountSync: false,
        api: BeyondApi(
          config,
          client: MockClient((request) async {
            calls++;
            if (calls == 1) return catalog('01', 'الأول', '"1"');
            if (calls == 2) throw http.ClientException('offline');
            return catalog('02', 'الثاني', '"2"');
          }),
        ),
      );
      await w.initialize();
      await w.synchronizeAccounts();
      expect(w.accounts.single.code, '01');
      expect(w.accountSyncError, isNotNull);
      await w.synchronizeAccounts();
      expect(w.accounts.single.code, '02');
      expect(w.accountSyncError, isNull);
      w.dispose();
    },
  );
  test('automatic retry synchronizes after the connection returns', () async {
    var calls = 0;
    final restored = Completer<void>();
    final w = Workspace(
      accountRetryInterval: Duration.zero,
      accountSyncInterval: const Duration(hours: 1),
      api: BeyondApi(
        config,
        client: MockClient((request) async {
          calls++;
          if (calls == 1) throw http.ClientException('offline');
          restored.complete();
          return catalog('001', 'متزامن', '"new"');
        }),
      ),
    );
    await w.initialize();
    await restored.future.timeout(const Duration(seconds: 3));
    while (w.accountSyncing) {
      await Future<void>.delayed(Duration.zero);
    }
    expect(w.accounts.single.code, '001');
    expect(w.accountSyncError, isNull);
    w.dispose();
  });
  test(
    'overlapping synchronization requests cannot overwrite a newer catalog',
    () async {
      var calls = 0;
      final response = Completer<http.Response>();
      final w = Workspace(
        automaticAccountSync: false,
        api: BeyondApi(
          config,
          client: MockClient((request) {
            calls++;
            return response.future;
          }),
        ),
      );
      final first = w.initialize();
      await Future<void>.delayed(Duration.zero);
      await w.synchronizeAccounts();
      expect(calls, 1);
      response.complete(catalog('001', 'الحساب', '"1"'));
      await first;
      expect(w.accounts.single.code, '001');
      w.dispose();
    },
  );
  test(
    'a delayed refresh cannot replace accounts just saved by the user',
    () async {
      final delayed = Completer<http.Response>();
      final w = Workspace(
        automaticAccountSync: false,
        api: BeyondApi(
          config,
          client: MockClient((request) async {
            if (request.method == 'GET') return delayed.future;
            return catalog('007', 'تمت الإضافة', '"new"');
          }),
        ),
      );
      final pending = w.initialize();
      await Future<void>.delayed(Duration.zero);
      await w.saveAccountChanges([const Account('007', 'تمت الإضافة')]);
      delayed.complete(catalog('001', 'قديم', '"old"'));
      await pending;
      expect(w.accounts.single.code, '007');
      w.dispose();
    },
  );
  test(
    'editing an account sends its previous identity and remaps preview references without changing amounts',
    () async {
      final w = Workspace(
        automaticAccountSync: false,
        api: BeyondApi(
          config,
          client: MockClient((request) async {
            expect(jsonDecode(request.body), {
              'action': 'update',
              'previous': {'code': '001', 'name': 'قديم'},
              'category': {'code': '002', 'name': 'جديد'},
            });
            return catalog('002', 'جديد', '"new"');
          }),
        ),
      )..accounts = [const Account('001', 'قديم')];
      w.pages.add(
        InvoicePage(id: 'p', name: 'invoice', bytes: Uint8List(0))
          ..invoice = Invoice({
            'id': 'i',
            'categoryCode': '001',
            'netCents': 11500,
            'taxCents': 0,
            'grossCents': 11500,
            'companyTaxIdPresent': false,
            'supplier': 'المورد',
          }),
      );
      final before = Map<String, dynamic>.of(w.pages.single.invoice!.data);
      await w.saveAccountChanges([
        const Account('002', 'جديد'),
      ], previous: const Account('001', 'قديم'));
      expect(w.pages.single.invoice!.data, {...before, 'categoryCode': '002'});
      expect(w.accounts.single.code, '002');
      w.dispose();
    },
  );
  test(
    'deleting a preview account requires a replacement and synchronizes that remapping',
    () async {
      var writes = 0;
      final w =
          Workspace(
              automaticAccountSync: false,
              api: BeyondApi(
                config,
                client: MockClient((request) async {
                  writes++;
                  expect(jsonDecode(request.body), {
                    'action': 'delete',
                    'category': {'code': '001', 'name': 'قديم'},
                    'replacementCode': '002',
                  });
                  return catalog('002', 'بديل', '"new"');
                }),
              ),
            )
            ..accounts = [
              const Account('001', 'قديم'),
              const Account('002', 'بديل'),
            ];
      w.pages.add(
        InvoicePage(id: 'p', name: 'invoice', bytes: Uint8List(0))
          ..invoice = Invoice({
            'id': 'i',
            'categoryCode': '001',
            'netCents': 10000,
            'taxCents': 1500,
            'grossCents': 11500,
          }),
      );
      await expectLater(
        w.deleteAccount(const Account('001', 'قديم')),
        throwsA(isA<ApiException>()),
      );
      expect(writes, 0);
      await w.deleteAccount(
        const Account('001', 'قديم'),
        replacementCode: '002',
      );
      expect(writes, 1);
      expect(w.pages.single.invoice!.account, '002');
      expect(w.pages.single.invoice!.gross, 11500);
      expect(w.pages.single.invoice!.tax, 1500);
      w.dispose();
    },
  );
}
