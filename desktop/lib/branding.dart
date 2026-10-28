import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'workspace.dart';
import 'design.dart';

const brandBlue = Color(0xFF173F80);

class BrandLogo extends StatelessWidget {
  final double width;
  const BrandLogo({super.key, this.width = 180});
  @override
  Widget build(BuildContext context) => SvgPicture.asset(
    'assets/branding/beyond-logo.svg',
    width: width,
    height: width * 54 / 161.85,
    fit: BoxFit.contain,
    semanticsLabel: 'Beyond company logo',
  );
}

class BrandHeader extends StatelessWidget {
  final Workspace workspace;
  const BrandHeader({super.key, required this.workspace});
  @override
  Widget build(BuildContext context) => Container(
    height: 74,
    color: brandBlue,
    padding: const EdgeInsets.symmetric(horizontal: 27),
    child: Row(
      children: [
        Expanded(
          child: GestureDetector(
            behavior: HitTestBehavior.opaque,
            onPanStart: (_) => windowAction('drag'),
            onDoubleTap: () => windowAction('toggleMaximize'),
            child: const Row(
              children: [
                BrandLogo(width: 146),
                SizedBox(width: 24),
                SizedBox(
                  height: 24,
                  child: VerticalDivider(color: Color(0xFF416198), width: 1),
                ),
                SizedBox(width: 20),
                Text(
                  'BEYOND GROUP',
                  textDirection: TextDirection.ltr,
                  style: TextStyle(
                    fontSize: 10,
                    letterSpacing: 1.8,
                    color: Color(0xFFB8CAE7),
                    fontWeight: FontWeight.w400,
                  ),
                ),
              ],
            ),
          ),
        ),
        const WindowControls(),
      ],
    ),
  );
}

class BrandSplash extends StatefulWidget {
  final VoidCallback onComplete;
  const BrandSplash({super.key, required this.onComplete});
  @override
  State<BrandSplash> createState() => _BrandSplashState();
}

class _BrandSplashState extends State<BrandSplash>
    with SingleTickerProviderStateMixin {
  late final AnimationController controller;
  bool started = false;
  @override
  void initState() {
    super.initState();
    controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2200),
    );
    controller.addStatusListener((status) {
      if (status == AnimationStatus.completed) widget.onComplete();
    });
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!started) {
      started = true;
      if (MediaQuery.disableAnimationsOf(context)) {
        controller.duration = const Duration(milliseconds: 700);
      }
      controller.forward();
    }
  }

  @override
  void dispose() {
    controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Material(
    color: brandBlue,
    child: AnimatedBuilder(
      animation: controller,
      builder: (context, _) {
        final t = controller.value;
        final entrance = Curves.easeOutCubic.transform((t / .58).clamp(0, 1));
        final text = Curves.easeOut.transform(((t - .18) / .45).clamp(0, 1));
        return Stack(
          children: [
            Positioned.fill(
              child: RepaintBoundary(
                child: CustomPaint(
                  painter: _BrandArt(
                    t: MediaQuery.disableAnimationsOf(context) ? 1 : t,
                  ),
                ),
              ),
            ),
            Center(
              child: Opacity(
                opacity: entrance,
                child: Transform.translate(
                  offset: Offset(0, 18 * (1 - entrance)),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const BrandLogo(width: 310),
                      const SizedBox(height: 42),
                      Opacity(
                        opacity: text,
                        child: const Column(
                          children: [
                            Text(
                              'DEVELOPED FOR',
                              textDirection: TextDirection.ltr,
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w400,
                                letterSpacing: 3.4,
                                color: Color(0xFFBDD2F2),
                              ),
                            ),
                            SizedBox(height: 10),
                            Text(
                              'BEYOND GROUP',
                              textDirection: TextDirection.ltr,
                              style: TextStyle(
                                fontSize: 30,
                                fontWeight: FontWeight.w500,
                                letterSpacing: 4.2,
                                color: Colors.white,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 34),
                      SizedBox(
                        width: 152,
                        height: 2,
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(2),
                          child: LinearProgressIndicator(
                            value: t,
                            backgroundColor: Colors.white12,
                            color: const Color(0xFF77D5F4),
                            minHeight: 2,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        );
      },
    ),
  );
}

class _BrandArt extends CustomPainter {
  final double t;
  _BrandArt({required this.t});
  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final scale = (size.shortestSide / 900).clamp(.65, 1.25);
    final stroke = Paint()
      ..color = Colors.white.withValues(alpha: .09)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1;
    final dot = Paint()..color = const Color(0xFF78D7F6).withValues(alpha: .55);
    final drift = math.sin(t * math.pi * 2) * 7;
    for (var i = 0; i < 3; i++) {
      final radius = (230 + i * 86) * scale;
      final oval = Rect.fromCenter(
        center: center + Offset(0, -24),
        width: radius * 2.6,
        height: radius * 1.65,
      );
      canvas.drawOval(oval, stroke);
      final angle = t * math.pi * .8 + i * 2.05;
      canvas.drawCircle(
        Offset(
          oval.center.dx + oval.width / 2 * math.cos(angle),
          oval.center.dy + oval.height / 2 * math.sin(angle),
        ),
        i == 1 ? 3 : 2,
        dot,
      );
    }
    void ledger(Offset position, double angle, double opacity) {
      canvas.save();
      canvas.translate(position.dx, position.dy);
      canvas.rotate(angle);
      canvas.scale(scale);
      final paint = Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.4
        ..color = Colors.white.withValues(alpha: opacity);
      final card = Path()
        ..moveTo(-42, -58)
        ..lineTo(24, -58)
        ..lineTo(42, -40)
        ..lineTo(42, 58)
        ..lineTo(-42, 58)
        ..close();
      canvas.drawPath(card, paint);
      canvas.drawPath(
        Path()
          ..moveTo(24, -58)
          ..lineTo(24, -40)
          ..lineTo(42, -40),
        paint,
      );
      for (var i = 0; i < 4; i++) {
        canvas.drawLine(
          Offset(-25, -21 + i * 16),
          Offset(i == 3 ? 7 : 25, -21 + i * 16),
          paint,
        );
      }
      canvas.drawCircle(
        const Offset(29, 48),
        14,
        Paint()
          ..style = PaintingStyle.fill
          ..color = brandBlue,
      );
      canvas.drawCircle(const Offset(29, 48), 14, paint);
      canvas.drawPath(
        Path()
          ..moveTo(23, 48)
          ..lineTo(28, 53)
          ..lineTo(36, 43),
        paint,
      );
      canvas.restore();
    }

    ledger(center + Offset(-390 * scale, drift - 100 * scale), -.12, .22);
    ledger(center + Offset(385 * scale, -drift + 85 * scale), .11, .15);
    final connector = Paint()
      ..color = const Color(0xFF7DCCED).withValues(alpha: .13)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.2;
    for (var i = 0; i < 2; i++) {
      final sign = i == 0 ? -1.0 : 1.0;
      final path = Path()
        ..moveTo(center.dx + sign * 450 * scale, center.dy + 160 * scale)
        ..cubicTo(
          center.dx + sign * 330 * scale,
          center.dy + 210 * scale,
          center.dx + sign * 270 * scale,
          center.dy + 70 * scale,
          center.dx + sign * 180 * scale,
          center.dy + 160 * scale,
        );
      canvas.drawPath(path, connector);
      final metric = path.computeMetrics().first;
      final point = metric.getTangentForOffset(
        metric.length * ((t * .8 + i * .35) % 1),
      );
      if (point != null) canvas.drawCircle(point.position, 2.5, dot);
    }
  }

  @override
  bool shouldRepaint(covariant _BrandArt oldDelegate) => oldDelegate.t != t;
}
