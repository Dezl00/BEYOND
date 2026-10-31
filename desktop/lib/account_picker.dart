import 'package:flutter/material.dart';
import 'design.dart';
import 'models.dart';

class AccountPicker extends StatefulWidget {
  final List<Account> accounts;
  final String value;
  final ValueChanged<String>? onChanged;
  final VoidCallback? onCreate;
  const AccountPicker({
    super.key,
    required this.accounts,
    required this.value,
    this.onChanged,
    this.onCreate,
  });
  @override
  State<AccountPicker> createState() => _AccountPickerState();
}

class _AccountPickerState extends State<AccountPicker> {
  final menu = MenuController();
  final search = TextEditingController();
  String query = '';
  @override
  void dispose() {
    search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final selected = widget.accounts
        .where((a) => a.code == widget.value)
        .firstOrNull;
    final matches = widget.accounts
        .where(
          (a) => ('${a.name} ${a.code}').toLowerCase().contains(
            query.toLowerCase(),
          ),
        )
        .toList();
    return MenuAnchor(
      controller: menu,
      onClose: () {
        search.clear();
        if (mounted) setState(() => query = '');
      },
      alignmentOffset: const Offset(0, 8),
      menuChildren: [
        SizedBox(
          width: 334,
          child: Padding(
            padding: const EdgeInsets.all(8),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: search,
                  autofocus: true,
                  onChanged: (v) => setState(() => query = v),
                  style: const TextStyle(fontSize: 13),
                  decoration: const InputDecoration(
                    hintText: 'بحث بالاسم أو الكود',
                    prefixIcon: Icon(Icons.search_rounded, size: 18),
                  ),
                ),
                const SizedBox(height: 8),
                SizedBox(
                  height: matches.length > 5
                      ? 282
                      : (matches.isEmpty ? 64 : matches.length * 54),
                  child: matches.isEmpty
                      ? const Center(
                          child: Text(
                            'لا توجد حسابات',
                            style: TextStyle(color: muted),
                          ),
                        )
                      : ListView.builder(
                          primary: false,
                          shrinkWrap: true,
                          itemCount: matches.length,
                          itemBuilder: (context, index) {
                            final a = matches[index];
                            return Padding(
                              padding: const EdgeInsets.only(bottom: 3),
                              child: Material(
                                color: a.code == widget.value
                                    ? pale
                                    : Colors.white,
                                borderRadius: BorderRadius.circular(10),
                                child: InkWell(
                                  borderRadius: BorderRadius.circular(10),
                                  onTap: () {
                                    menu.close();
                                    widget.onChanged?.call(a.code);
                                  },
                                  child: Padding(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 10,
                                      vertical: 12,
                                    ),
                                    child: Row(
                                      children: [
                                        Expanded(
                                          child: Text(
                                            a.name,
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                            style: const TextStyle(
                                              fontSize: 13,
                                            ),
                                          ),
                                        ),
                                        const SizedBox(width: 12),
                                        Text(
                                          a.code,
                                          textDirection: TextDirection.ltr,
                                          style: const TextStyle(
                                            fontSize: 12,
                                            color: blue,
                                          ),
                                        ),
                                        if (a.code == widget.value) ...[
                                          const SizedBox(width: 8),
                                          const Icon(
                                            Icons.check_rounded,
                                            size: 16,
                                            color: blue,
                                          ),
                                        ],
                                      ],
                                    ),
                                  ),
                                ),
                              ),
                            );
                          },
                        ),
                ),
                if (widget.onCreate != null) ...[
                  const Divider(height: 16),
                  TextButton.icon(
                    onPressed: () {
                      menu.close();
                      widget.onCreate?.call();
                    },
                    icon: const Icon(Icons.add_rounded, size: 16),
                    label: const Text('إضافة حساب'),
                  ),
                ],
              ],
            ),
          ),
        ),
      ],
      builder: (context, controller, child) => Material(
        color: selected == null ? pale : field,
        borderRadius: BorderRadius.circular(11),
        child: InkWell(
          onTap: widget.onChanged == null
              ? null
              : () {
                  controller.isOpen ? controller.close() : controller.open();
                },
          borderRadius: BorderRadius.circular(11),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        selected?.code ?? 'اختيار الحساب',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        textDirection: selected == null
                            ? TextDirection.rtl
                            : TextDirection.ltr,
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w500,
                          color: selected == null ? blue : navy,
                        ),
                      ),
                      if (selected != null)
                        Text(
                          selected.name,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 10,
                            color: muted,
                            height: 1.5,
                          ),
                        ),
                    ],
                  ),
                ),
                const Icon(Icons.unfold_more_rounded, size: 15, color: muted),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
