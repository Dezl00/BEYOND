import 'dart:math' as math;

import 'package:file_selector/file_selector.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:image/image.dart' as img;
import 'package:pdfx/pdfx.dart';

import 'api.dart';
import 'models.dart';

const invoiceTypes = XTypeGroup(
  label: 'الفواتير',
  extensions: ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'tif', 'tiff', 'pdf'],
);
const scanner = MethodChannel('com.beyond/scanner');
Uint8List normalizeImage(Uint8List bytes) {
  final decoder = img.findDecoderForData(bytes);
  final info = decoder?.startDecode(bytes);
  if (info == null || info.width * info.height > 60000000) {
    throw const ApiException('الصورة غير صالحة أو أبعادها كبيرة جدًا.');
  }
  var image = decoder!.decodeFrame(0);
  if (image == null) throw const ApiException('تعذر قراءة الصورة.');
  image = img.bakeOrientation(image);
  if (math.max(image.width, image.height) > 2500) {
    image = img.copyResize(
      image,
      width: image.width >= image.height ? 2500 : null,
      height: image.height > image.width ? 2500 : null,
      interpolation: img.Interpolation.average,
    );
  }
  var result = Uint8List.fromList(img.encodeJpg(image, quality: 88));
  if (result.length > 3900000) {
    result = Uint8List.fromList(
      img.encodeJpg(
        img.copyResize(
          image,
          width: (image.width * .8).round(),
          height: (image.height * .8).round(),
        ),
        quality: 76,
      ),
    );
  }
  if (result.length > 3900000) {
    throw const ApiException('تعذر ضغط الصورة للحجم المسموح.');
  }
  return result;
}

Future<List<InvoicePage>> prepareFile(XFile file, int remaining) async {
  if (await file.length() > 25 * 1024 * 1024) {
    throw ApiException('الملف ${file.name} يتجاوز 25 ميجابايت.');
  }
  final bytes = await file.readAsBytes();
  final name = file.name.length > 280 ? file.name.substring(0, 280) : file.name;
  final id = DateTime.now().microsecondsSinceEpoch.toString();
  if (!name.toLowerCase().endsWith('.pdf')) {
    return [
      InvoicePage(
        id: id,
        name: name,
        bytes: await compute(normalizeImage, bytes),
      ),
    ];
  }
  final document = await PdfDocument.openData(bytes);
  try {
    if (document.pagesCount > remaining) {
      throw const ApiException('الحد الأقصى للدفعة 50 فاتورة أو صفحة.');
    }
    final pages = <InvoicePage>[];
    for (var n = 1; n <= document.pagesCount; n++) {
      final page = await document.getPage(n);
      try {
        final ratio = 2400 / math.max(page.width, page.height);
        final render = await page.render(
          width: page.width * ratio,
          height: page.height * ratio,
          format: PdfPageImageFormat.jpeg,
          backgroundColor: '#FFFFFF',
        );
        if (render == null) {
          throw const ApiException('تعذر قراءة إحدى صفحات PDF.');
        }
        pages.add(
          InvoicePage(
            id: '$id-$n',
            name: name,
            page: n,
            bytes: await compute(normalizeImage, render.bytes),
          ),
        );
      } finally {
        await page.close();
      }
    }
    return pages;
  } finally {
    await document.close();
  }
}

class ScanResult {
  final bool cancelled;
  final String warning;
  final bool feeder;
  const ScanResult({
    this.cancelled = false,
    this.warning = '',
    this.feeder = false,
  });
}

String? _activeScannerSession;
int _scannerSerial = 0;
Future<void> cancelScanner() async {
  final id = _activeScannerSession;
  if (id == null) return;
  try {
    await scanner.invokeMethod<void>('cancel', {'sessionId': id});
  } on MissingPluginException {
    // The native bridge may already have closed with the app window.
  } on PlatformException {
    // The transfer callback also observes native cancellation.
  }
}

Future<ScanResult> acquireScan({
  required int maxPages,
  required Future<void> Function(Uint8List bytes, int index) onPage,
}) async {
  if (maxPages < 1 || maxPages > 50) {
    throw const ApiException('الحد الأقصى للدفعة 50 فاتورة أو صفحة.');
  }
  if (_activeScannerSession != null) {
    throw const ApiException('جلسة المسح ما زالت تعمل.');
  }
  final id = '${DateTime.now().microsecondsSinceEpoch}-${++_scannerSerial}';
  _activeScannerSession = id;
  var accepted = 0;
  Object? pageError;
  Future<void> processing = Future.value();
  scanner.setMethodCallHandler((call) async {
    if (call.method != 'page') return false;
    final value = call.arguments;
    if (value is! Map ||
        value['sessionId'] != id ||
        _activeScannerSession != id) {
      return false;
    }
    try {
      final index = value['index'], bytes = value['bytes'];
      if (index is! int ||
          index != accepted + 1 ||
          index > maxPages ||
          bytes is! Uint8List ||
          bytes.isEmpty ||
          bytes.length > 25 * 1024 * 1024) {
        throw const ApiException('صفحة المسح غير مكتملة.');
      }
      processing = processing.then((_) => onPage(bytes, index));
      await processing;
      accepted++;
      return true;
    } catch (error) {
      pageError ??= error;
      throw PlatformException(
        code: 'SCAN_PAGE',
        message: 'تعذر تجهيز صفحة المسح.',
      );
    }
  });
  try {
    final result = await scanner.invokeMapMethod<String, dynamic>('scan', {
      'sessionId': id,
      'maxPages': maxPages,
    });
    try {
      await processing;
    } catch (error) {
      pageError ??= error;
    }
    if (pageError != null) throw pageError!;
    return ScanResult(
      cancelled: result?['cancelled'] == true,
      warning: result?['warning'] as String? ?? '',
      feeder: result?['feeder'] == true,
    );
  } finally {
    try {
      await processing;
    } catch (_) {
      /* Completed pages remain in the workspace. */
    }
    if (_activeScannerSession == id) {
      scanner.setMethodCallHandler(null);
      _activeScannerSession = null;
    }
  }
}
