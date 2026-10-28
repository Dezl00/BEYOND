import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

import 'models.dart';
import 'branding.dart';
import 'startup.dart';
import 'workspace.dart';
import 'design.dart';
import 'accounts_dialog.dart';
import 'account_picker.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const BeyondApp());
}

class BeyondApp extends StatelessWidget {
  final Workspace? workspace;
  final bool? showSplash;
  const BeyondApp({super.key, this.workspace, this.showSplash});
  @override
  Widget build(BuildContext context) => MaterialApp(
    debugShowCheckedModeBanner: false,
    title: 'BEYOND GROUP',
    locale: const Locale('ar'),
    supportedLocales: const [Locale('ar'), Locale('en')],
    localizationsDelegates: GlobalMaterialLocalizations.delegates,
    theme: beyondTheme(),
    home: (showSplash ?? workspace == null)
        ? BootScreen(workspace: workspace)
        : WorkspaceView(workspace: workspace),
  );
}

class BootScreen extends StatefulWidget {
  final Workspace? workspace;
  const BootScreen({super.key, this.workspace});
  @override
  State<BootScreen> createState() => _BootScreenState();
}

class _BootScreenState extends State<BootScreen> {
  late final Workspace workspace;
  bool splash = true;
  @override
  void initState() {
    super.initState();
    workspace = widget.workspace ?? Workspace();
    if (widget.workspace == null) workspace.initialize();
  }

  @override
  void dispose() {
    workspace.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AnimatedSwitcher(
    duration: const Duration(milliseconds: 380),
    switchInCurve: Curves.easeOutCubic,
    switchOutCurve: Curves.easeInCubic,
    child: splash
        ? BrandSplash(
            key: const ValueKey('brand-splash'),
            onComplete: () {
              if (mounted) setState(() => splash = false);
            },
          )
        : WorkspaceView(
            key: const ValueKey('workspace'),
            workspace: workspace,
            ownsWorkspace: false,
            notifyReady: true,
          ),
  );
}

class WorkspaceView extends StatefulWidget {
  final Workspace? workspace;
  final bool ownsWorkspace, notifyReady;
  const WorkspaceView({
    super.key,
    this.workspace,
    this.ownsWorkspace = true,
    this.notifyReady = false,
  });
  @override
  State<WorkspaceView> createState() => _WorkspaceViewState();
}

class _WorkspaceViewState extends State<WorkspaceView>
    with WidgetsBindingObserver {
  late final Workspace w;
  final horizontal = ScrollController();
  final vertical = ScrollController();
  final formKey = GlobalKey<FormState>();
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    w = widget.workspace ?? Workspace();
    if (widget.notifyReady) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        notifyNativeReady();
      });
    }
    if (widget.workspace == null) w.initialize();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && w.initialized) {
      w.synchronizeAccounts();
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    horizontal.dispose();
    vertical.dispose();
    if (widget.ownsWorkspace) w.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: w,
    builder: (context, _) => Scaffold(
      body: SafeArea(
        child: Form(
          key: formKey,
          child: Column(
            children: [
              BrandHeader(workspace: w),
              Padding(
                padding: const EdgeInsets.fromLTRB(28, 26, 28, 18),
                child: Row(
                  children: [
                    const Text(
                      'الفواتير',
                      style: TextStyle(
                        fontSize: 23,
                        fontWeight: FontWeight.w500,
                        color: navy,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 3,
                      ),
                      decoration: BoxDecoration(
                        color: field,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        '${w.pages.length}',
                        style: const TextStyle(fontSize: 12, color: muted),
                      ),
                    ),
                    const Spacer(),
                    Tooltip(
                      message:
                          w.accountSyncError ??
                          'مزامنة تلقائية للحسابات والأكواد',
                      child: Row(
                        children: [
                          if (w.accountSyncing)
                            const SizedBox(
                              width: 12,
                              height: 12,
                              child: CircularProgressIndicator(
                                strokeWidth: 1.5,
                              ),
                            )
                          else
                            Icon(
                              w.accountSyncError == null
                                  ? Icons.cloud_done_outlined
                                  : Icons.cloud_off_outlined,
                              size: 16,
                              color: muted,
                            ),
                          const SizedBox(width: 7),
                          Text(
                            w.accountSyncError != null
                                ? 'تعذّرت المزامنة'
                                : w.lastAccountSync == null
                                ? 'الحسابات'
                                : 'متزامن',
                            style: const TextStyle(fontSize: 11, color: muted),
                          ),
                        ],
                      ),
                    ),
                    QuietIcon(
                      tooltip: 'مزامنة الحسابات والأكواد',
                      icon: Icons.sync_rounded,
                      onPressed: w.accountSyncing || w.accountSaving
                          ? null
                          : w.synchronizeAccounts,
                    ),
                    const SizedBox(width: 12),
                    OutlinedButton.icon(
                      onPressed: w.api == null || w.loading
                          ? null
                          : () => showAccountsDialog(context, w),
                      icon: const Icon(Icons.account_tree_outlined, size: 17),
                      label: const Text('الحسابات'),
                    ),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(28, 0, 28, 20),
                child: LayoutBuilder(
                  builder: (context, c) => SizedBox(
                    width: c.maxWidth,
                    child: Wrap(
                      spacing: 10,
                      runSpacing: 12,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        FilledButton.icon(
                          onPressed: w.busy || w.loading ? null : w.chooseFiles,
                          icon: const Icon(Icons.add_rounded, size: 19),
                          label: const Text('إضافة ملفات'),
                        ),
                        OutlinedButton.icon(
                          onPressed: w.scanning
                              ? (w.cancellingScan ? null : w.cancelScan)
                              : (w.busy || w.loading ? null : w.scan),
                          icon: Icon(
                            w.scanning
                                ? Icons.stop_rounded
                                : Icons.scanner_outlined,
                            size: 18,
                          ),
                          label: Text(
                            w.scanning
                                ? (w.cancellingScan
                                      ? 'جارٍ الإيقاف'
                                      : 'إيقاف المسح · ${w.scannedPages}')
                                : 'مسح ضوئي',
                          ),
                        ),
                        if (w.processing)
                          OutlinedButton.icon(
                            onPressed: w.stop,
                            icon: const Icon(Icons.stop_rounded, size: 17),
                            label: const Text('إيقاف'),
                          )
                        else
                          FilledButton.tonalIcon(
                            onPressed:
                                w.busy ||
                                    w.pages.isEmpty ||
                                    w.api == null ||
                                    w.invoices.length == w.pages.length
                                ? null
                                : () => w.process(),
                            icon: const Icon(
                              Icons.auto_awesome_outlined,
                              size: 17,
                            ),
                            label: const Text('استخراج'),
                            style: FilledButton.styleFrom(
                              backgroundColor: pale,
                              foregroundColor: blue,
                            ),
                          ),
                        const SizedBox(width: 5),
                        Container(height: 26, width: 1, color: line),
                        const SizedBox(width: 5),
                        OutlinedButton.icon(
                          onPressed: w.busy || w.invoices.isEmpty
                              ? null
                              : () => setState(() => w.editing = !w.editing),
                          icon: Icon(
                            w.editing ? Icons.done_rounded : Icons.tune_rounded,
                            size: 17,
                          ),
                          label: Text(w.editing ? 'تم التعديل' : 'تعديل جماعي'),
                        ),
                        Container(
                          decoration: BoxDecoration(
                            color: field,
                            border: Border.all(color: line),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              TextButton.icon(
                                onPressed: w.busy || w.invoices.isEmpty
                                    ? null
                                    : () => _export('xlsx'),
                                icon: const Icon(
                                  Icons.table_chart_outlined,
                                  size: 16,
                                ),
                                label: const Text('Excel'),
                                style: TextButton.styleFrom(
                                  foregroundColor: navy,
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 16,
                                    vertical: 15,
                                  ),
                                ),
                              ),
                              Container(height: 20, width: 1, color: line),
                              TextButton.icon(
                                onPressed: w.busy || w.invoices.isEmpty
                                    ? null
                                    : () => _export('pdf'),
                                icon: const Icon(
                                  Icons.picture_as_pdf_outlined,
                                  size: 16,
                                ),
                                label: const Text('PDF'),
                                style: TextButton.styleFrom(
                                  foregroundColor: navy,
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 16,
                                    vertical: 15,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        QuietIcon(
                          tooltip: w.showPreview
                              ? 'إخفاء الصور'
                              : 'إظهار الصور',
                          icon: w.showPreview
                              ? Icons.hide_image_outlined
                              : Icons.image_outlined,
                          selected: w.showPreview,
                          onPressed: w.pages.isEmpty
                              ? null
                              : () => setState(
                                  () => w.showPreview = !w.showPreview,
                                ),
                        ),
                        QuietIcon(
                          tooltip: 'تفريغ مساحة العمل',
                          icon: Icons.delete_sweep_outlined,
                          onPressed:
                              w.pages.isEmpty || w.scanning || w.exporting
                              ? null
                              : w.clear,
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              if (w.error != null)
                Container(
                  margin: const EdgeInsets.fromLTRB(28, 0, 28, 14),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: 5,
                  ),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFFF4F3),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    children: [
                      const Icon(
                        Icons.error_outline_rounded,
                        size: 17,
                        color: Color(0xFFB45155),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          w.error!,
                          style: const TextStyle(
                            fontSize: 12,
                            color: Color(0xFFB45155),
                          ),
                        ),
                      ),
                      QuietIcon(
                        tooltip: 'إغلاق التنبيه',
                        icon: Icons.close_rounded,
                        onPressed: () => setState(() => w.error = null),
                      ),
                    ],
                  ),
                ),
              if (w.preparing || w.processing || w.exporting)
                const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 28),
                  child: LinearProgressIndicator(
                    minHeight: 2,
                    backgroundColor: pale,
                    color: blue,
                  ),
                ),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 28),
                  child: LayoutBuilder(
                    builder: (context, c) => Row(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Expanded(
                          child: DecoratedBox(
                            decoration: BoxDecoration(
                              color: Colors.white,
                              border: Border.all(color: line),
                              borderRadius: BorderRadius.circular(18),
                            ),
                            child: ClipRRect(
                              borderRadius: BorderRadius.circular(17),
                              child: _table(),
                            ),
                          ),
                        ),
                        if (w.showPreview &&
                            w.selected != null &&
                            c.maxWidth >= 900) ...[
                          const SizedBox(width: 18),
                          SizedBox(width: 300, child: _preview(w.selected!)),
                        ],
                      ],
                    ),
                  ),
                ),
              ),
              SizedBox(
                height: 42,
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 32),
                  child: Row(
                    children: [
                      Text(
                        '${w.pages.length} فاتورة',
                        style: const TextStyle(fontSize: 11, color: muted),
                      ),
                      const SizedBox(width: 18),
                      Text(
                        '${w.invoices.length * 2} صف',
                        style: const TextStyle(fontSize: 11, color: muted),
                      ),
                      const Spacer(),
                      if (w.exporting)
                        const Text(
                          'جارٍ التصدير',
                          style: TextStyle(fontSize: 11, color: muted),
                        ),
                      if (w.preparing)
                        const Text(
                          'جارٍ تجهيز الملفات',
                          style: TextStyle(fontSize: 11, color: muted),
                        ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    ),
  );

  Future<void> _export(String format) async {
    if (!(formKey.currentState?.validate() ?? true)) return;
    await w.export(format);
  }

  Widget _table() => LayoutBuilder(
    builder: (context, c) {
      final width = c.maxWidth < 1060 ? 1060.0 : c.maxWidth;
      return Scrollbar(
        controller: horizontal,
        thumbVisibility: c.maxWidth < 1060,
        notificationPredicate: (n) => n.metrics.axis == Axis.horizontal,
        child: SingleChildScrollView(
          controller: horizontal,
          scrollDirection: Axis.horizontal,
          child: SizedBox(
            width: width,
            child: Column(
              children: [
                Container(
                  height: 52,
                  color: field,
                  child: Row(
                    children: [
                      _header('Account', 2),
                      _header('Lable', 6),
                      _header('Analtic Account', 2),
                      _header('Debit', 2),
                      _header('Credit', 2),
                      const SizedBox(width: 38),
                    ],
                  ),
                ),
                const Divider(height: 1),
                Expanded(
                  child: w.pages.isEmpty
                      ? const Center(
                          child: Icon(
                            Icons.receipt_long_outlined,
                            size: 48,
                            color: Color(0xFFCAD3E2),
                          ),
                        )
                      : Scrollbar(
                          controller: vertical,
                          thumbVisibility: true,
                          child: ListView.builder(
                            controller: vertical,
                            itemCount: w.pages.length,
                            itemBuilder: (context, index) =>
                                _invoice(w.pages[index], index),
                          ),
                        ),
                ),
              ],
            ),
          ),
        ),
      );
    },
  );
  Widget _header(String title, int flex) => Expanded(
    flex: flex,
    child: Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12),
      child: Text(
        title,
        textDirection: TextDirection.ltr,
        textAlign: TextAlign.center,
        style: const TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w500,
          color: navy,
        ),
      ),
    ),
  );
  Widget _invoice(InvoicePage page, int index) {
    final invoice = page.invoice;
    final selected = w.selectedId == page.id;
    if (invoice == null) {
      return Container(
        height: 108,
        decoration: const BoxDecoration(
          border: Border(bottom: BorderSide(color: line)),
        ),
        padding: const EdgeInsets.symmetric(horizontal: 18),
        child: Row(
          children: [
            SizedBox(
              width: 42,
              height: 62,
              child: Image.memory(
                page.bytes,
                fit: BoxFit.cover,
                cacheWidth: 100,
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '${page.name}${page.page > 1 ? ' · ${page.page}' : ''}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 13, color: navy),
                  ),
                  const SizedBox(height: 5),
                  Text(
                    page.error ??
                        (page.state == PageState.extracting
                            ? 'جارٍ الاستخراج'
                            : 'بانتظار الاستخراج'),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 12,
                      color: page.error == null
                          ? const Color(0xFF788398)
                          : const Color(0xFFB33D31),
                    ),
                  ),
                ],
              ),
            ),
            if (page.state == PageState.extracting)
              const SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(strokeWidth: 2),
              )
            else if (page.state == PageState.failed)
              IconButton(
                tooltip: 'إعادة المحاولة',
                onPressed: w.busy ? null : () => w.process(only: page),
                icon: const Icon(Icons.refresh_rounded, color: blue),
              ),
            IconButton(
              tooltip: 'حذف',
              onPressed: w.busy ? null : () => w.remove(page),
              icon: const Icon(
                Icons.close_rounded,
                size: 18,
                color: Color(0xFF8993A3),
              ),
            ),
          ],
        ),
      );
    }
    return Container(
      decoration: BoxDecoration(
        color: selected && w.showPreview ? pale : Colors.white,
        border: const Border(bottom: BorderSide(color: line)),
      ),
      child: Column(
        children: [_entry(page, invoice, false), _entry(page, invoice, true)],
      ),
    );
  }

  Widget _entry(InvoicePage page, Invoice invoice, bool vat) {
    return InkWell(
      onTap: () => setState(() => w.selectedId = page.id),
      child: Container(
        height: vat
            ? 54
            : w.editing
            ? 104
            : 76,
        decoration: BoxDecoration(
          color: vat ? const Color(0xFFFBFCFE) : null,
          border: vat
              ? null
              : const Border(bottom: BorderSide(color: Color(0xFFF0F2F5))),
        ),
        child: Row(
          children: [
            Expanded(
              flex: 2,
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 10),
                child: vat
                    ? Text(
                        invoice.account,
                        textAlign: TextAlign.center,
                        textDirection: TextDirection.ltr,
                        style: const TextStyle(
                          fontSize: 13,
                          color: Color(0xFF718098),
                        ),
                      )
                    : _account(page, invoice),
              ),
            ),
            Expanded(
              flex: 6,
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                child: w.editing && !vat
                    ? Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          _edit(
                            'supplier-${page.id}',
                            invoice.supplier,
                            'المورد',
                            (v) => w.update(
                              page,
                              page.invoice!.update({'supplier': v}),
                            ),
                          ),
                          const SizedBox(height: 6),
                          Row(
                            children: [
                              Expanded(
                                child: _edit(
                                  'number-${page.id}',
                                  invoice.number,
                                  'رقم الفاتورة',
                                  (v) => w.update(
                                    page,
                                    page.invoice!.update({'number': v}),
                                  ),
                                  ltr: true,
                                ),
                              ),
                              const SizedBox(width: 6),
                              Expanded(
                                child: _edit(
                                  'date-${page.id}',
                                  invoice.date,
                                  'YYYY-MM-DD',
                                  (v) => w.update(
                                    page,
                                    page.invoice!.update({'date': v}),
                                  ),
                                  ltr: true,
                                ),
                              ),
                            ],
                          ),
                        ],
                      )
                    : Tooltip(
                        message: invoice.label(w.accounts, vat: vat),
                        child: Text(
                          invoice.label(w.accounts, vat: vat),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: 13,
                            color: vat ? const Color(0xFF6C7686) : navy,
                          ),
                        ),
                      ),
              ),
            ),
            const Expanded(flex: 2, child: SizedBox()),
            Expanded(
              flex: 2,
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                child: w.editing
                    ? AmountField(
                        key: ValueKey('amount-${page.id}-$vat'),
                        cents: vat ? invoice.tax : invoice.net,
                        onChanged: (cents) =>
                            w.update(page, page.invoice!.amount(vat, cents)),
                      )
                    : Text(
                        money(vat ? invoice.tax : invoice.net),
                        textDirection: TextDirection.ltr,
                        textAlign: TextAlign.left,
                        style: TextStyle(
                          fontSize: 14,
                          color: vat ? const Color(0xFF6C7686) : navy,
                          fontWeight: vat ? FontWeight.w400 : FontWeight.w500,
                          fontFeatures: const [FontFeature.tabularFigures()],
                        ),
                      ),
              ),
            ),
            const Expanded(flex: 2, child: SizedBox()),
            SizedBox(
              width: 38,
              child: vat
                  ? const SizedBox()
                  : PopupMenuButton<String>(
                      tooltip: 'الفاتورة',
                      elevation: 0,
                      icon: const Icon(
                        Icons.more_horiz,
                        size: 20,
                        color: Color(0xFF8B96A7),
                      ),
                      onSelected: (action) {
                        if (action == 'delete') w.remove(page);
                        if (action == 'preview') {
                          setState(() {
                            w.selectedId = page.id;
                            w.showPreview = true;
                          });
                        }
                        if (action == 'retry') w.process(only: page);
                      },
                      itemBuilder: (context) => [
                        const PopupMenuItem(
                          value: 'preview',
                          child: Text('عرض الصورة'),
                        ),
                        if (!w.busy)
                          const PopupMenuItem(
                            value: 'retry',
                            child: Text('إعادة الاستخراج'),
                          ),
                        if (!w.busy)
                          const PopupMenuItem(
                            value: 'delete',
                            child: Text('حذف'),
                          ),
                      ],
                    ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _edit(
    String key,
    String value,
    String hint,
    ValueChanged<String> onChanged, {
    bool ltr = false,
  }) => TextFormField(
    key: ValueKey(key),
    initialValue: value,
    onChanged: onChanged,
    textDirection: ltr ? TextDirection.ltr : TextDirection.rtl,
    style: const TextStyle(fontSize: 12),
    decoration: InputDecoration(
      hintText: hint,
      contentPadding: const EdgeInsets.symmetric(horizontal: 8, vertical: 9),
    ),
  );
  Widget _account(InvoicePage page, Invoice invoice) => Tooltip(
    message: page.handwritten.isNotEmpty
        ? 'التصنيف المقروء: ${page.handwritten}'
        : 'التصنيف',
    child: AccountPicker(
      key: ValueKey('account-${page.id}'),
      accounts: w.accounts,
      value: invoice.account,
      onChanged: w.busy
          ? null
          : (v) => w.update(page, page.invoice!.update({'categoryCode': v})),
      onCreate: () => showAccountsDialog(context, w),
    ),
  );
  Widget _preview(InvoicePage page) => Container(
    decoration: BoxDecoration(
      color: field,
      border: Border.all(color: line),
      borderRadius: BorderRadius.circular(16),
    ),
    child: Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 6, 4, 6),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  page.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 12, color: navy),
                ),
              ),
              IconButton(
                tooltip: 'إخفاء الصور',
                onPressed: () => setState(() => w.showPreview = false),
                icon: const Icon(Icons.close_rounded, size: 18),
              ),
            ],
          ),
        ),
        Expanded(
          child: ClipRect(
            child: InteractiveViewer(
              minScale: .5,
              maxScale: 6,
              child: Center(
                child: Image.memory(page.bytes, fit: BoxFit.contain),
              ),
            ),
          ),
        ),
        const SizedBox(height: 10),
      ],
    ),
  );
}

class AmountField extends StatefulWidget {
  final int cents;
  final ValueChanged<int> onChanged;
  const AmountField({super.key, required this.cents, required this.onChanged});
  @override
  State<AmountField> createState() => _AmountFieldState();
}

class _AmountFieldState extends State<AmountField> {
  late final TextEditingController controller;
  final focus = FocusNode();
  @override
  void initState() {
    super.initState();
    controller = TextEditingController(text: money(widget.cents));
  }

  @override
  void didUpdateWidget(covariant AmountField oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!focus.hasFocus && oldWidget.cents != widget.cents) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted && !focus.hasFocus) {
          controller.text = money(widget.cents);
        }
      });
    }
  }

  @override
  void dispose() {
    controller.dispose();
    focus.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => TextFormField(
    controller: controller,
    focusNode: focus,
    textDirection: TextDirection.ltr,
    textAlign: TextAlign.left,
    style: const TextStyle(
      fontSize: 13,
      fontFeatures: [FontFeature.tabularFigures()],
    ),
    inputFormatters: [
      FilteringTextInputFormatter.allow(RegExp('[0-9٠-٩.,٫٬]')),
    ],
    autovalidateMode: AutovalidateMode.onUserInteraction,
    validator: (v) => parseCents(v ?? '') == null ? 'مبلغ غير صالح' : null,
    onChanged: (v) {
      final cents = parseCents(v);
      if (cents != null) widget.onChanged(cents);
    },
    decoration: const InputDecoration(contentPadding: EdgeInsets.all(10)),
  );
}
