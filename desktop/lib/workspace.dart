import 'dart:async';
import 'dart:io';

import 'package:file_selector/file_selector.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter/painting.dart';

import 'api.dart';
import 'input.dart';
import 'models.dart';

class Workspace extends ChangeNotifier {
  BeyondApi? api;
  List<Account> accounts = [];
  final List<InvoicePage> pages = [];
  bool loading = true,
      preparing = false,
      processing = false,
      exporting = false,
      scanning = false;
  bool editing = false, showPreview = false;
  String? error;
  String? selectedId;
  int _generation = 0;
  bool _disposed = false;
  Workspace({this.api});
  bool get busy => preparing || processing || scanning || exporting;
  List<Invoice> get invoices =>
      pages.where((p) => p.invoice != null).map((p) => p.invoice!).toList();
  InvoicePage? get selected =>
      pages.where((p) => p.id == selectedId).firstOrNull ?? pages.firstOrNull;
  void changed() {
    if (!_disposed) notifyListeners();
  }

  Future<void> initialize() async {
    loading = true;
    error = null;
    changed();
    try {
      api ??= BeyondApi(await RuntimeConfig.load());
      accounts = await api!.categories();
    } catch (e) {
      error = friendly(e);
    } finally {
      loading = false;
      changed();
    }
  }

  Future<void> chooseFiles() async {
    if (busy || loading) return;
    try {
      final files = await openFiles(acceptedTypeGroups: [invoiceTypes]);
      if (files.isNotEmpty) await addFiles(files);
    } catch (e) {
      error = friendly(e);
      changed();
    }
  }

  Future<void> addFiles(List<XFile> files) async {
    final generation = _generation;
    preparing = true;
    error = null;
    changed();
    try {
      for (final file in files) {
        if (generation != _generation) return;
        if (pages.length >= 50) {
          throw const ApiException('الحد الأقصى للدفعة 50 فاتورة أو صفحة.');
        }
        final prepared = await prepareFile(file, 50 - pages.length);
        if (generation != _generation) return;
        pages.addAll(prepared);
        selectedId ??= pages.firstOrNull?.id;
        changed();
      }
    } catch (e) {
      if (generation == _generation) error = friendly(e);
    } finally {
      if (generation == _generation) {
        preparing = false;
        changed();
      }
    }
  }

  Future<void> scan() async {
    if (busy || loading) return;
    if (pages.length >= 50) {
      error = 'الحد الأقصى للدفعة 50 فاتورة أو صفحة.';
      changed();
      return;
    }
    final generation = _generation;
    scanning = true;
    error = null;
    changed();
    try {
      final images = await acquireScan();
      for (final bytes in images) {
        if (generation != _generation) return;
        if (pages.length >= 50) {
          throw const ApiException('الحد الأقصى للدفعة 50 فاتورة أو صفحة.');
        }
        final normalized = await compute(normalizeImage, bytes);
        if (generation != _generation) return;
        final page = InvoicePage(
          id: 'scan-${DateTime.now().microsecondsSinceEpoch}',
          name: 'مسح ضوئي ${pages.length + 1}',
          bytes: normalized,
        );
        pages.add(page);
        selectedId = page.id;
        changed();
      }
    } on PlatformException catch (e) {
      error = e.message ?? 'تعذر الاتصال بالماسح الضوئي.';
    } catch (e) {
      error = friendly(e);
    } finally {
      if (generation == _generation) {
        scanning = false;
        changed();
      }
    }
  }

  Future<void> process({InvoicePage? only}) async {
    if (busy || api == null) return;
    final targets = only == null
        ? pages.where((p) => p.invoice == null).toList()
        : [only];
    if (targets.isEmpty) return;
    final generation = _generation;
    processing = true;
    error = null;
    changed();
    var cursor = 0;
    Future<void> worker() async {
      while (cursor < targets.length && generation == _generation) {
        final page = targets[cursor++];
        page.state = PageState.extracting;
        page.error = null;
        changed();
        try {
          final result = await api!.extract(page);
          if (generation != _generation) return;
          page.invoice = result.invoice;
          page.handwritten = result.handwritten;
          page.state = PageState.ready;
        } catch (e) {
          if (generation != _generation) return;
          page.state = PageState.failed;
          page.error = friendly(e);
        }
        changed();
      }
    }

    await Future.wait([worker(), worker()]);
    if (generation == _generation) {
      processing = false;
      changed();
    }
  }

  void stop() {
    _generation++;
    api?.cancelExtraction();
    for (final p in pages) {
      if (p.state == PageState.extracting) p.state = PageState.pending;
    }
    processing = false;
    changed();
  }

  void update(InvoicePage page, Invoice invoice) {
    page.invoice = invoice;
    changed();
  }

  void remove(InvoicePage page) {
    if (busy) return;
    pages.remove(page);
    if (selectedId == page.id) selectedId = pages.firstOrNull?.id;
    changed();
  }

  void clear() {
    if (scanning || exporting) return;
    stop();
    pages.clear();
    selectedId = null;
    error = null;
    editing = false;
    preparing = false;
    PaintingBinding.instance.imageCache.clear();
    PaintingBinding.instance.imageCache.clearLiveImages();
    changed();
  }

  Future<void> export(String format) async {
    if (busy || invoices.isEmpty || api == null) return;
    if (invoices.length != pages.length) {
      error =
          'استكمل استخراج الفواتير أو احذف الصفحات غير المكتملة قبل التصدير.';
      changed();
      return;
    }
    if (invoices.any((i) => !accounts.any((a) => a.code == i.account))) {
      error = 'اختر تصنيفًا لكل فاتورة قبل التصدير.';
      changed();
      return;
    }
    final location = await getSaveLocation(
      suggestedName:
          'Beyond-Journal-${DateTime.now().toIso8601String().substring(0, 10)}.$format',
      acceptedTypeGroups: [
        XTypeGroup(label: format.toUpperCase(), extensions: [format]),
      ],
    );
    if (location == null) return;
    exporting = true;
    error = null;
    changed();
    try {
      final bytes = await api!.export(invoices, format);
      await File(location.path).writeAsBytes(bytes, flush: true);
    } catch (e) {
      error = friendly(e);
    } finally {
      exporting = false;
      changed();
    }
  }

  @override
  void dispose() {
    _disposed = true;
    _generation++;
    api?.close();
    pages.clear();
    super.dispose();
  }
}

String friendly(Object e) => e is ApiException
    ? e.message
    : e is SocketException
    ? 'تعذر الاتصال بالإنترنت.'
    : e is TimeoutException
    ? 'انتهت مهلة الاتصال. أعد المحاولة.'
    : 'تعذر إتمام العملية. أعد المحاولة.';
