import 'package:flutter/material.dart';
import 'design.dart';
import 'models.dart';
import 'workspace.dart';
import 'account_picker.dart';

List<Account> parseAccountLines(String text) {
  final result = <Account>[];
  for (final line in text.split(RegExp(r'\r?\n'))) {
    if (line.trim().isEmpty) continue;
    final parts = line.split(RegExp(r'\t|\||;'));
    if (parts.length != 2 || parts.any((p) => p.trim().isEmpty)) {
      throw const FormatException(
        'كل سطر يحتاج كودًا واسمًا يفصل بينهما Tab أو |.',
      );
    }
    result.add(Account(parts[0].trim(), parts[1].trim()));
  }
  if (result.isEmpty || result.length > 100) {
    throw const FormatException('أدخل من حساب واحد إلى 100 حساب في الدفعة.');
  }
  if (result.any((a) => a.code.length > 80 || a.name.length > 180)) {
    throw const FormatException('كود أو اسم الحساب أطول من الحد المسموح.');
  }
  if (result.map((a) => a.code).toSet().length != result.length) {
    throw const FormatException('توجد أكواد مكررة في القائمة.');
  }
  return result;
}

Future<void> showAccountsDialog(BuildContext context, Workspace workspace) =>
    showDialog<void>(
      context: context,
      barrierColor: navy.withValues(alpha: .16),
      builder: (_) => AccountsDialog(workspace: workspace),
    );

class AccountsDialog extends StatefulWidget {
  final Workspace workspace;
  const AccountsDialog({super.key, required this.workspace});
  @override
  State<AccountsDialog> createState() => _AccountsDialogState();
}

class _AccountsDialogState extends State<AccountsDialog> {
  final code = TextEditingController(),
      name = TextEditingController(),
      bulk = TextEditingController(),
      search = TextEditingController();
  final form = GlobalKey<FormState>();
  Account? selected;
  bool batch = false;
  String query = '';
  String? error;
  bool saved = false;
  Workspace get w => widget.workspace;
  @override
  void dispose() {
    code.dispose();
    name.dispose();
    bulk.dispose();
    search.dispose();
    super.dispose();
  }

  void reset() {
    setState(() {
      selected = null;
      batch = false;
      code.clear();
      name.clear();
      bulk.clear();
      error = null;
      saved = false;
    });
  }

  Future<void> save() async {
    if (w.accountSaving) return;
    setState(() {
      error = null;
      saved = false;
    });
    try {
      final changes = batch ? parseAccountLines(bulk.text) : <Account>[];
      if (!batch) {
        if (!(form.currentState?.validate() ?? false)) return;
        changes.add(Account(code.text.trim(), name.text.trim()));
      }
      await w.saveAccountChanges(changes, previous: selected);
      if (!mounted) return;
      reset();
      setState(() => saved = true);
    } catch (e) {
      if (mounted) {
        setState(() => error = e is FormatException ? e.message : friendly(e));
      }
    }
  }

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: w,
    builder: (context, _) => PopScope(
      canPop: !w.accountSaving,
      child: Dialog(
        insetPadding: const EdgeInsets.all(30),
        child: SizedBox(
          width: 960,
          height: 630,
          child: Padding(
            padding: const EdgeInsets.all(26),
            child: Column(
              children: [
                Row(
                  children: [
                    Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        color: pale,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Icon(
                        Icons.account_tree_outlined,
                        color: blue,
                        size: 20,
                      ),
                    ),
                    const SizedBox(width: 13),
                    const Text(
                      'الحسابات',
                      style: TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.w500,
                        color: navy,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Text(
                      '${w.accounts.length}',
                      style: const TextStyle(fontSize: 13, color: muted),
                    ),
                    const Spacer(),
                    QuietIcon(
                      tooltip: 'إغلاق الحسابات',
                      icon: Icons.close_rounded,
                      onPressed: w.accountSaving
                          ? null
                          : () => Navigator.pop(context),
                    ),
                  ],
                ),
                const SizedBox(height: 24),
                Expanded(
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Expanded(
                        flex: 6,
                        child: Column(
                          children: [
                            TextField(
                              controller: search,
                              onChanged: (v) => setState(() => query = v),
                              decoration: const InputDecoration(
                                hintText: 'بحث بالاسم أو الكود',
                                prefixIcon: Icon(
                                  Icons.search_rounded,
                                  size: 19,
                                ),
                              ),
                            ),
                            const SizedBox(height: 12),
                            Expanded(
                              child: Builder(
                                builder: (context) {
                                  final matches = w.accounts
                                      .where(
                                        (a) => '${a.code} ${a.name}'
                                            .toLowerCase()
                                            .contains(query.toLowerCase()),
                                      )
                                      .toList();
                                  if (matches.isEmpty) {
                                    return const Center(
                                      child: Icon(
                                        Icons.account_tree_outlined,
                                        size: 38,
                                        color: muted,
                                      ),
                                    );
                                  }
                                  return ListView.separated(
                                    primary: false,
                                    itemCount: matches.length,
                                    separatorBuilder: (_, index) =>
                                        const SizedBox(height: 5),
                                    itemBuilder: (context, index) {
                                      final a = matches[index];
                                      final active = selected?.code == a.code;
                                      return Material(
                                        color: active ? pale : Colors.white,
                                        borderRadius: BorderRadius.circular(12),
                                        child: InkWell(
                                          borderRadius: BorderRadius.circular(
                                            12,
                                          ),
                                          onTap: w.accountSaving
                                              ? null
                                              : () => setState(() {
                                                  selected = a;
                                                  batch = false;
                                                  code.text = a.code;
                                                  name.text = a.name;
                                                  error = null;
                                                  saved = false;
                                                }),
                                          child: Container(
                                            padding: const EdgeInsets.symmetric(
                                              horizontal: 14,
                                              vertical: 14,
                                            ),
                                            decoration: BoxDecoration(
                                              border: Border.all(
                                                color: active
                                                    ? const Color(0xFFCADBFC)
                                                    : line,
                                              ),
                                              borderRadius:
                                                  BorderRadius.circular(12),
                                            ),
                                            child: Row(
                                              children: [
                                                Expanded(
                                                  child: Text(
                                                    a.name,
                                                    maxLines: 1,
                                                    overflow:
                                                        TextOverflow.ellipsis,
                                                    style: const TextStyle(
                                                      fontSize: 13,
                                                    ),
                                                  ),
                                                ),
                                                const SizedBox(width: 10),
                                                Container(
                                                  padding:
                                                      const EdgeInsets.symmetric(
                                                        horizontal: 9,
                                                        vertical: 4,
                                                      ),
                                                  decoration: BoxDecoration(
                                                    color: active
                                                        ? Colors.white
                                                        : field,
                                                    borderRadius:
                                                        BorderRadius.circular(
                                                          7,
                                                        ),
                                                  ),
                                                  child: Text(
                                                    a.code,
                                                    textDirection:
                                                        TextDirection.ltr,
                                                    style: const TextStyle(
                                                      fontSize: 12,
                                                      color: blue,
                                                    ),
                                                  ),
                                                ),
                                                const SizedBox(width: 10),
                                                const Icon(
                                                  Icons.edit_outlined,
                                                  size: 15,
                                                  color: muted,
                                                ),
                                              ],
                                            ),
                                          ),
                                        ),
                                      );
                                    },
                                  );
                                },
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 24),
                      Expanded(
                        flex: 4,
                        child: Container(
                          padding: const EdgeInsets.all(22),
                          decoration: BoxDecoration(
                            color: field,
                            borderRadius: BorderRadius.circular(18),
                          ),
                          child: Form(
                            key: form,
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                Row(
                                  children: [
                                    Expanded(
                                      child: Text(
                                        selected == null
                                            ? 'حساب جديد'
                                            : 'تعديل الحساب',
                                        style: const TextStyle(
                                          fontSize: 16,
                                          fontWeight: FontWeight.w500,
                                        ),
                                      ),
                                    ),
                                    if (selected != null)
                                      TextButton(
                                        onPressed: w.accountSaving
                                            ? null
                                            : reset,
                                        child: const Text('جديد'),
                                      ),
                                  ],
                                ),
                                const SizedBox(height: 18),
                                if (selected == null)
                                  Row(
                                    children: [
                                      Expanded(
                                        child: _mode(
                                          'حساب واحد',
                                          !batch,
                                          () => setState(() => batch = false),
                                        ),
                                      ),
                                      const SizedBox(width: 6),
                                      Expanded(
                                        child: _mode(
                                          'إدخال جماعي',
                                          batch,
                                          () => setState(() => batch = true),
                                        ),
                                      ),
                                    ],
                                  ),
                                const SizedBox(height: 20),
                                Expanded(
                                  child: SingleChildScrollView(
                                    primary: false,
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.stretch,
                                      children: [
                                        if (batch)
                                          SizedBox(
                                            height: 240,
                                            child: TextFormField(
                                              controller: bulk,
                                              enabled: !w.accountSaving,
                                              maxLines: null,
                                              expands: true,
                                              textAlignVertical:
                                                  TextAlignVertical.top,
                                              style: const TextStyle(
                                                fontSize: 12,
                                              ),
                                              decoration: const InputDecoration(
                                                hintText:
                                                    'الكود | اسم الحساب\n005101 | مواد كهرباء',
                                                fillColor: Colors.white,
                                              ),
                                            ),
                                          )
                                        else ...[
                                          const Text(
                                            'كود الحساب',
                                            style: TextStyle(
                                              fontSize: 12,
                                              color: muted,
                                            ),
                                          ),
                                          const SizedBox(height: 8),
                                          TextFormField(
                                            key: const ValueKey('catalog-code'),
                                            controller: code,
                                            enabled: !w.accountSaving,
                                            textDirection: TextDirection.ltr,
                                            maxLength: 80,
                                            style: const TextStyle(
                                              fontSize: 13,
                                            ),
                                            decoration: const InputDecoration(
                                              counterText: '',
                                              fillColor: Colors.white,
                                            ),
                                            validator: (v) =>
                                                v == null || v.trim().isEmpty
                                                ? 'أدخل كود الحساب'
                                                : null,
                                          ),
                                          const SizedBox(height: 20),
                                          const Text(
                                            'اسم الحساب',
                                            style: TextStyle(
                                              fontSize: 12,
                                              color: muted,
                                            ),
                                          ),
                                          const SizedBox(height: 8),
                                          TextFormField(
                                            key: const ValueKey('catalog-name'),
                                            controller: name,
                                            enabled: !w.accountSaving,
                                            maxLength: 180,
                                            style: const TextStyle(
                                              fontSize: 13,
                                            ),
                                            decoration: const InputDecoration(
                                              counterText: '',
                                              fillColor: Colors.white,
                                            ),
                                            validator: (v) =>
                                                v == null || v.trim().isEmpty
                                                ? 'أدخل اسم الحساب'
                                                : null,
                                          ),
                                        ],
                                      ],
                                    ),
                                  ),
                                ),
                                if (error != null) ...[
                                  const SizedBox(height: 12),
                                  Text(
                                    error!,
                                    style: const TextStyle(
                                      fontSize: 12,
                                      color: Color(0xFFB45155),
                                    ),
                                  ),
                                ],
                                if (saved) ...[
                                  const SizedBox(height: 12),
                                  const Text(
                                    'تم الحفظ والمزامنة',
                                    style: TextStyle(
                                      fontSize: 12,
                                      color: Color(0xFF338569),
                                    ),
                                  ),
                                ],
                                const SizedBox(height: 18),
                                FilledButton.icon(
                                  onPressed: w.accountSaving ? null : save,
                                  icon: w.accountSaving
                                      ? const SizedBox(
                                          width: 15,
                                          height: 15,
                                          child: CircularProgressIndicator(
                                            strokeWidth: 1.5,
                                            color: Colors.white,
                                          ),
                                        )
                                      : const Icon(Icons.add_rounded, size: 18),
                                  label: Text(
                                    w.accountSaving
                                        ? 'جارٍ الحفظ'
                                        : selected == null
                                        ? 'إضافة الحساب'
                                        : 'حفظ التعديل',
                                  ),
                                ),
                                if (selected != null) ...[
                                  const SizedBox(height: 8),
                                  TextButton.icon(
                                    onPressed: w.accountSaving
                                        ? null
                                        : () async {
                                            final removed =
                                                await showDialog<bool>(
                                                  context: context,
                                                  builder: (_) =>
                                                      DeleteAccountDialog(
                                                        workspace: w,
                                                        account: selected!,
                                                      ),
                                                );
                                            if (removed == true && mounted) {
                                              reset();
                                            }
                                          },
                                    style: TextButton.styleFrom(
                                      foregroundColor: const Color(0xFFB45155),
                                    ),
                                    icon: const Icon(
                                      Icons.delete_outline_rounded,
                                      size: 17,
                                    ),
                                    label: const Text('حذف الحساب'),
                                  ),
                                ],
                              ],
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    ),
  );
  Widget _mode(String label, bool active, VoidCallback press) => Material(
    color: active ? Colors.white : Colors.transparent,
    borderRadius: BorderRadius.circular(9),
    child: InkWell(
      onTap: w.accountSaving ? null : press,
      borderRadius: BorderRadius.circular(9),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 10),
        child: Text(
          label,
          textAlign: TextAlign.center,
          style: TextStyle(fontSize: 12, color: active ? blue : muted),
        ),
      ),
    ),
  );
}

class DeleteAccountDialog extends StatefulWidget {
  final Workspace workspace;
  final Account account;
  const DeleteAccountDialog({
    super.key,
    required this.workspace,
    required this.account,
  });
  @override
  State<DeleteAccountDialog> createState() => _DeleteAccountDialogState();
}

class _DeleteAccountDialogState extends State<DeleteAccountDialog> {
  String? replacement, error;
  bool saving = false;
  @override
  Widget build(BuildContext context) => PopScope(
    canPop: !saving,
    child: Dialog(
      child: SizedBox(
        width: 440,
        child: Padding(
          padding: const EdgeInsets.all(26),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text(
                'حذف الحساب',
                style: TextStyle(fontSize: 19, fontWeight: FontWeight.w500),
              ),
              const SizedBox(height: 16),
              Text(widget.account.name),
              Text(
                widget.account.code,
                textDirection: TextDirection.ltr,
                style: const TextStyle(color: muted, fontSize: 12),
              ),
              const SizedBox(height: 20),
              const Text(
                'الحساب البديل للفواتير المرتبطة',
                style: TextStyle(color: muted, fontSize: 12),
              ),
              const SizedBox(height: 8),
              AccountPicker(
                accounts: widget.workspace.accounts
                    .where((a) => a.code != widget.account.code)
                    .toList(),
                value: replacement ?? '',
                onChanged: saving
                    ? null
                    : (v) => setState(() => replacement = v),
              ),
              if (error != null) ...[
                const SizedBox(height: 14),
                Text(
                  error!,
                  style: const TextStyle(
                    fontSize: 12,
                    color: Color(0xFFB45155),
                  ),
                ),
              ],
              const SizedBox(height: 24),
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  TextButton(
                    onPressed: saving
                        ? null
                        : () => Navigator.pop(context, false),
                    child: const Text('إلغاء'),
                  ),
                  const SizedBox(width: 10),
                  FilledButton(
                    onPressed: saving
                        ? null
                        : () async {
                            setState(() {
                              saving = true;
                              error = null;
                            });
                            try {
                              await widget.workspace.deleteAccount(
                                widget.account,
                                replacementCode: replacement,
                              );
                              if (context.mounted) Navigator.pop(context, true);
                            } catch (e) {
                              if (mounted) {
                                setState(() {
                                  saving = false;
                                  error = friendly(e);
                                });
                              }
                            }
                          },
                    style: FilledButton.styleFrom(
                      backgroundColor: const Color(0xFFB45155),
                    ),
                    child: Text(saving ? 'جارٍ الحذف' : 'حذف'),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    ),
  );
}
