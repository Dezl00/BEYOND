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
  Future<List<Account>> categories() async {
    final response = await _client
        .get(endpoint('categories'), headers: headers)
        .timeout(const Duration(seconds: 30));
    _check(response);
    return (jsonDecode(utf8.decode(response.bodyBytes))['categories'] as List)
        .map((e) => Account.fromJson(e as Map<String, dynamic>))
        .toList();
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
