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
  bool cancellingScan = false;
  int scannedPages = 0;
  String? error;
  String? selectedId;
  int _generation = 0;
  bool _disposed = false;
  final bool automaticAccountSync;
  final Duration accountSyncInterval, accountRetryInterval;
  Timer? _accountSyncTimer;
  String? _accountEtag;
  bool accountSyncing = false, initialized = false;
  String? accountSyncError;
  DateTime? lastAccountSync;
  Workspace({
    this.api,
    this.automaticAccountSync = true,
    this.accountSyncInterval = const Duration(seconds: 60),
    this.accountRetryInterval = const Duration(seconds: 15),
  });
  bool get busy => preparing || processing || scanning || exporting;
  List<Invoice> get invoices =>
      pages.where((p) => p.invoice != null).map((p) => p.invoice!).toList();
  InvoicePage? get selected =>
      pages.where((p) => p.id == selectedId).firstOrNull ?? pages.firstOrNull;
  void changed() {
    if (!_disposed) notifyListeners();
  }

  Future<void> initialize() => synchronizeAccounts();

  Future<void> synchronizeAccounts() async {
    if (_disposed || accountSyncing) return;
    initialized = true;
    _accountSyncTimer?.cancel();
    _accountSyncTimer = null;
    accountSyncing = true;
    changed();
    try {
      api ??= BeyondApi(await RuntimeConfig.load());
      final update = await api!.synchronizeAccounts(etag: _accountEtag);
      if (_disposed) return;
      if (update.accounts != null) {
        accounts = List.unmodifiable(update.accounts!);
      }
      _accountEtag = update.etag;
      lastAccountSync = DateTime.now();
      accountSyncError = null;
    } catch (e) {
      if (!_disposed) accountSyncError = friendly(e);
    } finally {
      accountSyncing = false;
      loading = false;
      changed();
      if (!_disposed && automaticAccountSync) {
        _accountSyncTimer = Timer(
          accountSyncError == null ? accountSyncInterval : accountRetryInterval,
          () {
            synchronizeAccounts();
          },
        );
      }
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

  Future<void> cancelScan() async {
    if (!scanning || cancellingScan) return;
    cancellingScan = true;
    changed();
    await cancelScanner();
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
    cancellingScan = false;
    scannedPages = 0;
    error = null;
    changed();
    try {
      final result = await acquireScan(
        maxPages: 50 - pages.length,
        onPage: (bytes, index) async {
          if (generation != _generation) {
            throw const ApiException('تم إيقاف جلسة المسح.');
          }
          final normalized = await compute(normalizeImage, bytes);
          if (generation != _generation) {
            throw const ApiException('تم إيقاف جلسة المسح.');
          }
          if (pages.length >= 50) {
            throw const ApiException('الحد الأقصى للدفعة 50 فاتورة أو صفحة.');
          }
          final page = InvoicePage(
            id: 'scan-${DateTime.now().microsecondsSinceEpoch}-$index',
            name: 'مسح ضوئي ${pages.length + 1}',
            bytes: normalized,
          );
          pages.add(page);
          selectedId = page.id;
          scannedPages++;
          changed();
        },
      );
      if (generation == _generation && result.warning.isNotEmpty) {
        error = result.warning;
      }
    } on PlatformException catch (e) {
      if (generation == _generation) {
        error = e.message ?? 'تعذر الاتصال بالماسح الضوئي.';
      }
    } catch (e) {
      if (generation == _generation) error = friendly(e);
    } finally {
      if (generation == _generation) {
        scanning = false;
        cancellingScan = false;
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
          if (page.invoice != null) error = page.error;
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
    exporting = true;
    error = null;
    changed();
    try {
      final location = await getSaveLocation(
        suggestedName:
            'Beyond-Journal-${DateTime.now().toIso8601String().substring(0, 10)}.$format',
        acceptedTypeGroups: [
          XTypeGroup(label: format.toUpperCase(), extensions: [format]),
        ],
      );
      if (location == null) return;
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
    _accountSyncTimer?.cancel();
    if (scanning) cancelScanner();
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
