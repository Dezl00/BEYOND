import 'dart:typed_data';

class Account {
  final String code, name;
  const Account(this.code, this.name);
  factory Account.fromJson(Map<String, dynamic> json) =>
      Account(json['code'] as String, json['name'] as String);
}

class Invoice {
  final Map<String, dynamic> data;
  Invoice(Map<String, dynamic> data) : data = Map.of(data);
  String get id => data['id'] as String;
  String get number => data['number'] as String? ?? '';
  String get date => data['date'] as String? ?? '';
  String get supplier => data['supplier'] as String? ?? '';
  String get account => data['categoryCode'] as String? ?? '';
  int get net => data['netCents'] as int? ?? 0;
  bool get splitTax => data['companyTaxIdPresent'] != false;
  int get gross => data['grossCents'] as int? ?? net + tax;
  int get rowCount => splitTax ? 2 : 1;
  int get mainAmount => splitTax ? net : gross;
  int get tax => data['taxCents'] as int? ?? 0;
  List<String> get warnings =>
      List<String>.from(data['warnings'] as List? ?? []);
  Invoice update(Map<String, dynamic> values) => Invoice({...data, ...values});
  Invoice amount(bool vat, int cents) {
    if (!splitTax) {
      return update({
        'netCents': cents,
        'taxCents': 0,
        'grossCents': cents,
        'amountSource': 'manual',
      });
    }
    final n = vat ? net : cents, t = vat ? cents : (cents * 15 / 100).round();
    return update({
      'netCents': n,
      'taxCents': t,
      'grossCents': n + t,
      'amountSource': 'manual',
    });
  }

  String label(List<Account> accounts, {bool vat = false}) {
    final category =
        accounts.where((a) => a.code == account).firstOrNull?.name ?? '';
    final match = RegExp(r'^(\d{4})-(\d{2})-(\d{2})$').firstMatch(date);
    final d = match == null ? date : '${match[3]}/${match[2]}/${match[1]}';
    return [
          if (vat) 'قيمة مضافة',
          supplier,
          if (number.isNotEmpty) 'فاتورة رقم $number',
          if (d.isNotEmpty) 'بتاريخ $d',
          category,
        ]
        .where((s) => s.isNotEmpty)
        .join(' ')
        .replaceAll(RegExp(r'\s+'), ' ')
        .trim();
  }
}

enum PageState { pending, extracting, ready, failed }

class InvoicePage {
  final String id, name;
  final int page;
  final Uint8List bytes;
  PageState state = PageState.pending;
  Invoice? invoice;
  String? error;
  String handwritten = '';
  InvoicePage({
    required this.id,
    required this.name,
    required this.bytes,
    this.page = 1,
  });
}

String money(int cents) => (cents / 100).toStringAsFixed(2);
int? parseCents(String text) {
  final normalized = text
      .replaceAllMapped(
        RegExp('[٠-٩]'),
        (m) => (m[0]!.codeUnitAt(0) - 1632).toString(),
      )
      .replaceAll(',', '')
      .replaceAll('٬', '')
      .replaceAll('٫', '.')
      .trim();
  if (!RegExp(r'^\d{1,10}(\.\d{0,2})?$').hasMatch(normalized)) return null;
  final amount = double.tryParse(normalized);
  if (amount == null || amount < 0 || amount > 1000000000) return null;
  return (amount * 100).round();
}
