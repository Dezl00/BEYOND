import 'dart:async';
import 'dart:convert';

import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';

import 'models.dart';

class ApiException implements Exception {
  final String message;
  final int? status;
  const ApiException(this.message, [this.status]);
  @override
  String toString() => message;
}

class RuntimeConfig {
  final Uri base;
  final String token;
  const RuntimeConfig(this.base, this.token);
  static Future<RuntimeConfig> load() async {
    final json =
        jsonDecode(await rootBundle.loadString('assets/runtime.json'))
            as Map<String, dynamic>;
    final base = Uri.tryParse(json['baseUrl'] as String? ?? '');
    final token = json['desktopToken'] as String? ?? '';
    if (base == null ||
        base.scheme != 'https' ||
        base.host.isEmpty ||
        base.userInfo.isNotEmpty ||
        token.isEmpty) {
      throw const ApiException('نسخة البرنامج غير مرتبطة بالخادم.');
    }
    return RuntimeConfig(base, token);
  }
}

class BeyondApi {
  final RuntimeConfig config;
  final http.Client _client;
  final Set<http.Client> _active = {};
  BeyondApi(this.config, {http.Client? client})
    : _client = client ?? http.Client();
  Map<String, String> get headers => {
    'Authorization': 'Bearer ${config.token}',
    'Cache-Control': 'no-store',
  };
  Uri endpoint(String path) => config.base.resolve('/api/desktop/$path');
  Future<List<Account>> categories() async =>
      (await synchronizeAccounts()).accounts!;
  Future<AccountCatalogUpdate> synchronizeAccounts({String? etag}) async {
    final response = await _client
        .get(
          endpoint('categories'),
          headers: {...headers, 'If-None-Match': ?etag},
        )
        .timeout(const Duration(seconds: 12));
    if (response.statusCode == 304 && etag != null) {
      return AccountCatalogUpdate(etag: response.headers['etag'] ?? etag);
    }
    return _accountCatalog(response);
  }

  AccountCatalogUpdate _accountCatalog(http.Response response) {
    _check(response);
    final body =
        jsonDecode(utf8.decode(response.bodyBytes)) as Map<String, dynamic>;
    final values = body['categories'];
    if (values is! List || values.length > 1000) {
      throw const ApiException('قائمة الحسابات غير صالحة.', 502);
    }
    final accounts = values
        .map((e) => Account.fromJson(e as Map<String, dynamic>))
        .toList();
    if (accounts.any((a) => a.code.isEmpty || a.name.isEmpty) ||
        accounts.map((a) => a.code).toSet().length != accounts.length) {
      throw const ApiException('قائمة الحسابات غير مكتملة.', 502);
    }
    return AccountCatalogUpdate(
      accounts: accounts,
      etag: response.headers['etag'],
    );
  }

  Future<AccountCatalogUpdate> saveAccounts(
    List<Account> accounts, {
    Account? previous,
  }) async {
    final response = await _client
        .post(
          endpoint('categories'),
          headers: {...headers, 'Content-Type': 'application/json'},
          body: jsonEncode(
            previous == null
                ? {
                    'action': 'add',
                    'categories': accounts
                        .map((a) => {'code': a.code, 'name': a.name})
                        .toList(),
                  }
                : {
                    'action': 'rename',
                    'code': previous.code,
                    'previousName': previous.name,
                    'name': accounts.single.name,
                  },
          ),
        )
        .timeout(const Duration(seconds: 20));
    return _accountCatalog(response);
  }

  Future<({Invoice invoice, String handwritten})> extract(
    InvoicePage page,
  ) async {
    final client = http.Client();
    _active.add(client);
    try {
      final request = http.MultipartRequest('POST', endpoint('extract'))
        ..headers.addAll(headers)
        ..files.add(
          http.MultipartFile.fromBytes(
            'file',
            page.bytes,
            filename: 'invoice.jpg',
            contentType: MediaType('image', 'jpeg'),
          ),
        );
      final response = await http.Response.fromStream(
        await client.send(request),
      ).timeout(const Duration(seconds: 280));
      _check(response);
      final body =
          jsonDecode(utf8.decode(response.bodyBytes)) as Map<String, dynamic>;
      final invoice = Invoice(
        body['invoice'] as Map<String, dynamic>,
      ).update({'sourceName': page.name, 'page': page.page});
      return (
        invoice: invoice,
        handwritten: body['handwrittenCategory'] as String? ?? '',
      );
    } on TimeoutException {
      throw const ApiException('انتهت مهلة الاستخراج. أعد المحاولة.');
    } finally {
      _active.remove(client);
      client.close();
    }
  }

  Future<Uint8List> export(List<Invoice> invoices, String format) async {
    final response = await _client
        .post(
          endpoint('export/$format'),
          headers: {...headers, 'Content-Type': 'application/json'},
          body: jsonEncode({'invoices': invoices.map((i) => i.data).toList()}),
        )
        .timeout(const Duration(seconds: 90));
    _check(response);
    final expected = format == 'pdf'
        ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    if (!(response.headers['content-type'] ?? '').startsWith(expected) ||
        response.bodyBytes.isEmpty) {
      throw const ApiException('تعذر تجهيز ملف التصدير.');
    }
    return response.bodyBytes;
  }

  void _check(http.Response response) {
    if (response.statusCode >= 200 && response.statusCode < 300) return;
    String message = 'تعذر الاتصال بالخادم. أعد المحاولة.';
    try {
      message =
          (jsonDecode(utf8.decode(response.bodyBytes)) as Map)['error']
              as String? ??
          message;
    } catch (_) {}
    throw ApiException(message, response.statusCode);
  }

  void cancelExtraction() {
    for (final client in _active.toList()) {
      client.close();
    }
    _active.clear();
  }

  void close() {
    cancelExtraction();
    _client.close();
  }
}

class AccountCatalogUpdate {
  final List<Account>? accounts;
  final String? etag;
  const AccountCatalogUpdate({this.accounts, this.etag});
}
