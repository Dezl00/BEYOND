import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'design.dart';

class InvoicePreview extends StatefulWidget {
  final Uint8List bytes;
  final String name;
  final VoidCallback onClose;
  final bool expanded;
  const InvoicePreview({
    super.key,
    required this.bytes,
    required this.name,
    required this.onClose,
    this.expanded = false,
  });
  @override
  State<InvoicePreview> createState() => _InvoicePreviewState();
}

class _InvoicePreviewState extends State<InvoicePreview> {
  final transform = TransformationController();
  Size viewport = Size.zero;
  double get scale => transform.value.getMaxScaleOnAxis();
  @override
  void initState() {
    super.initState();
    transform.addListener(refresh);
  }

  void refresh() {
    if (mounted) setState(() {});
  }

  @override
  void didUpdateWidget(covariant InvoicePreview oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!identical(oldWidget.bytes, widget.bytes)) {
      transform.value = Matrix4.identity();
    }
  }

  @override
  void dispose() {
    transform.removeListener(refresh);
    transform.dispose();
    super.dispose();
  }

  void zoom(double factor) {
    final old = scale;
    final next = (old * factor).clamp(.5, 8.0);
    final ratio = next / old;
    final matrix = transform.value;
    final result = Matrix4.identity();
    result.setEntry(0, 0, next);
    result.setEntry(1, 1, next);
    result.setEntry(
      0,
      3,
      viewport.width / 2 - (viewport.width / 2 - matrix.entry(0, 3)) * ratio,
    );
    result.setEntry(
      1,
      3,
      viewport.height / 2 - (viewport.height / 2 - matrix.entry(1, 3)) * ratio,
    );
    transform.value = result;
  }

  void expand() => showDialog<void>(
    context: context,
    barrierColor: navy.withValues(alpha: .48),
    builder: (context) => Dialog(
      insetPadding: const EdgeInsets.all(24),
      child: InvoicePreview(
        bytes: widget.bytes,
        name: widget.name,
        expanded: true,
        onClose: () => Navigator.pop(context),
      ),
    ),
  );
  @override
  Widget build(BuildContext context) => Container(
    decoration: BoxDecoration(
      color: field,
      border: Border.all(color: line),
      borderRadius: BorderRadius.circular(16),
    ),
    child: Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 6, 6, 6),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  widget.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 12, color: navy),
                ),
              ),
              if (!widget.expanded)
                QuietIcon(
                  tooltip: 'عرض مكبر',
                  icon: Icons.open_in_full_rounded,
                  onPressed: expand,
                ),
              QuietIcon(
                tooltip: widget.expanded ? 'إغلاق العرض المكبر' : 'إخفاء الصور',
                icon: Icons.close_rounded,
                onPressed: widget.onClose,
              ),
            ],
          ),
        ),
        Expanded(
          child: ClipRect(
            child: LayoutBuilder(
              builder: (context, constraints) {
                viewport = constraints.biggest;
                return InteractiveViewer(
                  transformationController: transform,
                  minScale: .5,
                  maxScale: 8,
                  boundaryMargin: const EdgeInsets.all(100),
                  child: SizedBox(
                    width: viewport.width,
                    height: viewport.height,
                    child: Image.memory(
                      widget.bytes,
                      fit: BoxFit.contain,
                      gaplessPlayback: true,
                      errorBuilder: (_, error, stack) => const Center(
                        child: Icon(Icons.broken_image_outlined, color: muted),
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
        ),
        SizedBox(
          height: 48,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            textDirection: TextDirection.ltr,
            children: [
              QuietIcon(
                tooltip: 'تصغير الصورة',
                icon: Icons.remove_rounded,
                onPressed: scale > .5 ? () => zoom(1 / 1.25) : null,
              ),
              SizedBox(
                width: 60,
                child: Text(
                  '${(scale * 100).round()}%',
                  textAlign: TextAlign.center,
                  style: const TextStyle(fontSize: 12, color: navy),
                ),
              ),
              QuietIcon(
                tooltip: 'تكبير الصورة',
                icon: Icons.add_rounded,
                onPressed: scale < 8 ? () => zoom(1.25) : null,
              ),
              const SizedBox(width: 12),
              QuietIcon(
                tooltip: 'ملاءمة الصورة',
                icon: Icons.fit_screen_rounded,
                onPressed: () => transform.value = Matrix4.identity(),
              ),
            ],
          ),
        ),
      ],
    ),
  );
}
