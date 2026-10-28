import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

import 'models.dart';
import 'startup.dart';
import 'workspace.dart';

const navy = Color(0xFF173569),
    blue = Color(0xFF2463EB),
    pale = Color(0xFFEDF3FF),
    line = Color(0xFFE5E8ED),
    field = Color(0xFFF5F6F8);
void main() {
  final binding = WidgetsFlutterBinding.ensureInitialized();
  binding.addPostFrameCallback((_) {
    notifyNativeReady();
  });
  runApp(const BeyondApp());
}

class BeyondApp extends StatelessWidget {
  final Workspace? workspace;
  const BeyondApp({super.key, this.workspace});
  @override
  Widget build(BuildContext context) => MaterialApp(
    debugShowCheckedModeBanner: false,
    title: 'Beyond',
    locale: const Locale('ar'),
    supportedLocales: const [Locale('ar'), Locale('en')],
    localizationsDelegates: GlobalMaterialLocalizations.delegates,
    theme: ThemeData(
      useMaterial3: true,
      fontFamily: 'Segoe UI',
      scaffoldBackgroundColor: Colors.white,
      colorScheme: ColorScheme.fromSeed(seedColor: blue, surface: Colors.white),
      splashFactory: NoSplash.splashFactory,
      dividerColor: line,
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: blue,
          foregroundColor: Colors.white,
          elevation: 0,
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 18),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: navy,
          side: const BorderSide(color: line),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 18),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: field,
        isDense: true,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(6),
          borderSide: BorderSide.none,
        ),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 10,
          vertical: 12,
        ),
      ),
      tooltipTheme: const TooltipThemeData(
        waitDuration: Duration(milliseconds: 450),
      ),
    ),
    home: WorkspaceView(workspace: workspace),
  );
}

class WorkspaceView extends StatefulWidget {
  final Workspace? workspace;
  const WorkspaceView({super.key, this.workspace});
  @override
  State<WorkspaceView> createState() => _WorkspaceViewState();
}

class _WorkspaceViewState extends State<WorkspaceView> {
  late final Workspace w;
  final horizontal = ScrollController();
  final vertical = ScrollController();
  final formKey = GlobalKey<FormState>();
  @override
  void initState() {
    super.initState();
    w = widget.workspace ?? Workspace();
    if (widget.workspace == null) w.initialize();
  }

  @override
  void dispose() {
    horizontal.dispose();
    vertical.dispose();
    w.dispose();
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
              Container(
                height: 80,
                padding: const EdgeInsets.symmetric(horizontal: 28),
                decoration: const BoxDecoration(
                  border: Border(bottom: BorderSide(color: line)),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 38,
                      height: 38,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: navy,
                        borderRadius: BorderRadius.circular(9),
                      ),
                      child: const Text(
                        'B',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 24,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    const Text(
                      'BEYOND',
                      style: TextStyle(
                        color: navy,
                        fontSize: 21,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 2,
                      ),
                    ),
                    const SizedBox(width: 24),
                    const Text(
                      'الفواتير',
                      style: TextStyle(fontSize: 15, color: Color(0xFF606A7B)),
                    ),
                    const Spacer(),
                    if (w.loading)
                      const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    else
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 7,
                        ),
                        decoration: BoxDecoration(
                          color: pale,
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          '${w.accounts.length} حساب',
                          style: const TextStyle(color: navy, fontSize: 12),
                        ),
                      ),
                    IconButton(
                      tooltip: 'تحديث التصنيفات',
                      onPressed: w.busy || w.loading ? null : w.initialize,
                      icon: const Icon(
                        Icons.sync_rounded,
                        size: 20,
                        color: navy,
                      ),
                    ),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(24, 20, 24, 18),
                child: LayoutBuilder(
                  builder: (context, c) => SizedBox(
                    width: c.maxWidth,
                    child: Wrap(
                      spacing: 10,
                      runSpacing: 10,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        FilledButton.icon(
                          onPressed: w.busy || w.loading ? null : w.chooseFiles,
                          icon: const Icon(Icons.add_rounded, size: 21),
                          label: const Text('إضافة ملفات'),
                        ),
                        OutlinedButton.icon(
                          onPressed: w.busy || w.loading ? null : w.scan,
                          icon: const Icon(Icons.scanner_outlined, size: 19),
                          label: Text(w.scanning ? 'جارٍ المسح' : 'مسح ضوئي'),
                        ),
                        if (w.processing)
                          OutlinedButton.icon(
                            onPressed: w.stop,
                            icon: const Icon(Icons.stop_rounded, size: 18),
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
                              size: 18,
                            ),
                            label: const Text('استخراج'),
                          ),
                        const SizedBox(width: 8),
                        OutlinedButton.icon(
                          onPressed: w.busy || w.invoices.isEmpty
                              ? null
                              : () => setState(() => w.editing = !w.editing),
                          icon: Icon(
                            w.editing
                                ? Icons.done_rounded
                                : Icons.edit_note_rounded,
                            size: 20,
                          ),
                          label: Text(w.editing ? 'تم التعديل' : 'تعديل جماعي'),
                        ),
                        OutlinedButton.icon(
                          onPressed: w.busy || w.invoices.isEmpty
                              ? null
                              : () => _export('xlsx'),
                          icon: const Icon(
                            Icons.table_chart_outlined,
                            size: 18,
                          ),
                          label: const Text('Excel'),
                        ),
                        OutlinedButton.icon(
                          onPressed: w.busy || w.invoices.isEmpty
                              ? null
                              : () => _export('pdf'),
                          icon: const Icon(
                            Icons.picture_as_pdf_outlined,
                            size: 18,
                          ),
                          label: const Text('PDF'),
                        ),
                        IconButton(
                          tooltip: w.showPreview
                              ? 'إخفاء الصور'
                              : 'إظهار الصور',
                          onPressed: w.pages.isEmpty
                              ? null
                              : () => setState(
                                  () => w.showPreview = !w.showPreview,
                                ),
                          icon: Icon(
                            w.showPreview
                                ? Icons.hide_image_outlined
                                : Icons.image_outlined,
                            color: navy,
                          ),
                        ),
                        IconButton(
                          tooltip: 'تفريغ مساحة العمل',
                          onPressed:
                              w.pages.isEmpty || w.scanning || w.exporting
                              ? null
                              : w.clear,
                          icon: const Icon(
                            Icons.delete_sweep_outlined,
                            color: navy,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              if (w.error != null)
                Container(
                  margin: const EdgeInsets.fromLTRB(24, 0, 24, 14),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 6,
                  ),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFFF3F2),
                    borderRadius: BorderRadius.circular(7),
                  ),
                  child: Row(
                    children: [
                      const Icon(
                        Icons.error_outline,
                        size: 18,
                        color: Color(0xFFB33D31),
                      ),
                      const SizedBox(width: 9),
                      Expanded(
                        child: Text(
                          w.error!,
                          style: const TextStyle(
                            fontSize: 13,
                            color: Color(0xFF8A3028),
                          ),
                        ),
                      ),
                      IconButton(
                        onPressed: () => setState(() => w.error = null),
                        icon: const Icon(Icons.close, size: 17),
                      ),
                    ],
                  ),
                ),
              if (w.preparing || w.processing || w.exporting)
                const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 24),
                  child: LinearProgressIndicator(
                    minHeight: 2,
                    backgroundColor: pale,
                    color: blue,
                  ),
                ),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(24, 0, 24, 0),
                  child: LayoutBuilder(
                    builder: (context, c) => Row(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Expanded(
                          child: DecoratedBox(
                            decoration: BoxDecoration(
                              border: Border.all(color: line),
                              borderRadius: BorderRadius.circular(9),
                            ),
                            child: ClipRRect(
                              borderRadius: BorderRadius.circular(8),
                              child: _table(),
                            ),
                          ),
                        ),
                        if (w.showPreview &&
                            w.selected != null &&
                            c.maxWidth >= 900) ...[
                          const SizedBox(width: 16),
                          SizedBox(width: 300, child: _preview(w.selected!)),
                        ],
                      ],
                    ),
                  ),
                ),
              ),
              Container(
                height: 44,
                padding: const EdgeInsets.symmetric(horizontal: 28),
                child: Row(
                  children: [
                    Text(
                      '${w.pages.length} فاتورة',
                      style: const TextStyle(
                        fontSize: 12,
                        color: Color(0xFF6C7686),
                      ),
                    ),
                    const SizedBox(width: 16),
                    Text(
                      '${w.invoices.length * 2} صف',
                      style: const TextStyle(
                        fontSize: 12,
                        color: Color(0xFF6C7686),
                      ),
                    ),
                    const Spacer(),
                    if (w.exporting)
                      const Text(
                        'جارٍ التصدير',
                        style: TextStyle(fontSize: 12, color: navy),
                      ),
                    if (w.preparing)
                      const Text(
                        'جارٍ تجهيز الملفات',
                        style: TextStyle(fontSize: 12, color: navy),
                      ),
                  ],
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
                  height: 50,
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
                            size: 46,
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
          fontWeight: FontWeight.w600,
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
            ? 62
            : w.editing
            ? 104
            : 70,
        decoration: BoxDecoration(
          color: vat ? const Color(0xFFFAFBFD) : null,
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
                          fontWeight: vat ? FontWeight.w400 : FontWeight.w600,
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
    child: DropdownButtonFormField<String>(
      key: ValueKey('account-${page.id}-${invoice.account}'),
      initialValue: w.accounts.any((a) => a.code == invoice.account)
          ? invoice.account
          : null,
      isExpanded: true,
      menuMaxHeight: 360,
      icon: const Icon(
        Icons.keyboard_arrow_down_rounded,
        size: 16,
        color: blue,
      ),
      style: const TextStyle(fontFamily: 'Segoe UI', fontSize: 12, color: navy),
      hint: const Text('التصنيف', style: TextStyle(fontSize: 12, color: blue)),
      selectedItemBuilder: (context) => w.accounts
          .map(
            (a) => Align(
              alignment: Alignment.centerRight,
              child: Text(
                a.code,
                textDirection: TextDirection.ltr,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: navy,
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          )
          .toList(),
      items: w.accounts
          .map(
            (a) => DropdownMenuItem(
              value: a.code,
              child: Text(
                '${a.code} · ${a.name}',
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          )
          .toList(),
      onChanged: w.busy
          ? null
          : (v) {
              if (v != null) {
                w.update(page, page.invoice!.update({'categoryCode': v}));
              }
            },
      decoration: InputDecoration(
        fillColor: invoice.account.isEmpty ? pale : field,
        contentPadding: const EdgeInsets.symmetric(horizontal: 9, vertical: 11),
      ),
    ),
  );
  Widget _preview(InvoicePage page) => Container(
    decoration: BoxDecoration(
      color: field,
      border: Border.all(color: line),
      borderRadius: BorderRadius.circular(9),
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
