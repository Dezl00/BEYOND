import 'package:flutter/material.dart';
import 'startup.dart';

const navy = Color(0xFF243754),
    blue = Color(0xFF346BDA),
    pale = Color(0xFFEDF3FF),
    line = Color(0xFFE9EDF4),
    field = Color(0xFFF6F8FB),
    muted = Color(0xFF718096);
const plex = 'IBM Plex Sans Arabic';
ThemeData beyondTheme() {
  final shape = RoundedRectangleBorder(borderRadius: BorderRadius.circular(12));
  return ThemeData(
    useMaterial3: true,
    fontFamily: plex,
    scaffoldBackgroundColor: Colors.white,
    colorScheme: ColorScheme.fromSeed(seedColor: blue, surface: Colors.white),
    splashFactory: NoSplash.splashFactory,
    dividerColor: line,
    textTheme: const TextTheme(
      bodyMedium: TextStyle(fontSize: 13, color: navy, height: 1.5),
      bodySmall: TextStyle(fontSize: 12, color: muted),
      titleMedium: TextStyle(
        fontSize: 16,
        fontWeight: FontWeight.w500,
        color: navy,
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: blue,
        foregroundColor: Colors.white,
        elevation: 0,
        minimumSize: const Size(0, 44),
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
        textStyle: const TextStyle(
          fontFamily: plex,
          fontSize: 13,
          fontWeight: FontWeight.w500,
        ),
        shape: shape,
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: navy,
        side: const BorderSide(color: line),
        minimumSize: const Size(0, 44),
        padding: const EdgeInsets.symmetric(horizontal: 17, vertical: 14),
        textStyle: const TextStyle(
          fontFamily: plex,
          fontSize: 13,
          fontWeight: FontWeight.w400,
        ),
        shape: shape,
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: blue,
        textStyle: const TextStyle(
          fontFamily: plex,
          fontSize: 13,
          fontWeight: FontWeight.w500,
        ),
        shape: shape,
      ),
    ),
    iconButtonTheme: IconButtonThemeData(
      style: IconButton.styleFrom(
        foregroundColor: muted,
        hoverColor: pale,
        shape: shape,
        padding: const EdgeInsets.all(12),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: field,
      isDense: true,
      hintStyle: const TextStyle(fontSize: 12, color: muted),
      labelStyle: const TextStyle(fontSize: 12, color: muted),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: line),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: line),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: blue),
      ),
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 15),
    ),
    dialogTheme: DialogThemeData(
      backgroundColor: Colors.white,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(24),
        side: const BorderSide(color: line),
      ),
    ),
    popupMenuTheme: PopupMenuThemeData(
      color: Colors.white,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: line),
      ),
      textStyle: const TextStyle(fontFamily: plex, fontSize: 13, color: navy),
    ),
    menuTheme: MenuThemeData(
      style: MenuStyle(
        backgroundColor: const WidgetStatePropertyAll(Colors.white),
        surfaceTintColor: const WidgetStatePropertyAll(Colors.transparent),
        elevation: const WidgetStatePropertyAll(0),
        side: const WidgetStatePropertyAll(BorderSide(color: line)),
        shape: WidgetStatePropertyAll(
          RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        ),
        padding: const WidgetStatePropertyAll(EdgeInsets.all(8)),
      ),
    ),
    menuButtonTheme: MenuButtonThemeData(
      style: ButtonStyle(
        textStyle: const WidgetStatePropertyAll(
          TextStyle(fontFamily: plex, fontSize: 13),
        ),
        foregroundColor: const WidgetStatePropertyAll(navy),
        shape: WidgetStatePropertyAll(shape),
        padding: const WidgetStatePropertyAll(
          EdgeInsets.symmetric(horizontal: 12, vertical: 12),
        ),
      ),
    ),
    scrollbarTheme: ScrollbarThemeData(
      thickness: const WidgetStatePropertyAll(5),
      radius: const Radius.circular(8),
      thumbColor: WidgetStatePropertyAll(muted.withValues(alpha: .28)),
    ),
    tooltipTheme: TooltipThemeData(
      waitDuration: const Duration(milliseconds: 450),
      decoration: BoxDecoration(
        color: navy,
        borderRadius: BorderRadius.circular(8),
      ),
      textStyle: const TextStyle(
        fontFamily: plex,
        fontSize: 11,
        color: Colors.white,
      ),
    ),
  );
}

Future<void> windowAction(String action) async {
  try {
    await startupChannel.invokeMethod<void>(action);
  } catch (_) {
    /* No native host in widget previews. */
  }
}

class WindowControls extends StatelessWidget {
  const WindowControls({super.key});
  @override
  Widget build(BuildContext context) => Directionality(
    textDirection: TextDirection.ltr,
    child: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        _WindowDot(
          'إغلاق',
          const Color(0xFFFF817E),
          Icons.close_rounded,
          () => windowAction('close'),
        ),
        const SizedBox(width: 10),
        _WindowDot(
          'تصغير',
          const Color(0xFFF2C96D),
          Icons.remove_rounded,
          () => windowAction('minimize'),
        ),
        const SizedBox(width: 10),
        _WindowDot(
          'تكبير / استعادة',
          const Color(0xFF7ACDA8),
          Icons.open_in_full_rounded,
          () => windowAction('toggleMaximize'),
        ),
      ],
    ),
  );
}

class _WindowDot extends StatefulWidget {
  final String tooltip;
  final Color color;
  final IconData icon;
  final VoidCallback onTap;
  const _WindowDot(this.tooltip, this.color, this.icon, this.onTap);
  @override
  State<_WindowDot> createState() => _WindowDotState();
}

class _WindowDotState extends State<_WindowDot> {
  bool hover = false;
  @override
  Widget build(BuildContext context) => Tooltip(
    message: widget.tooltip,
    child: MouseRegion(
      cursor: SystemMouseCursors.click,
      onEnter: (_) => setState(() => hover = true),
      onExit: (_) => setState(() => hover = false),
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: widget.onTap,
        child: SizedBox(
          width: 20,
          height: 32,
          child: Center(
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 140),
              width: 12,
              height: 12,
              decoration: BoxDecoration(
                color: widget.color,
                shape: BoxShape.circle,
              ),
              child: hover ? Icon(widget.icon, size: 9, color: navy) : null,
            ),
          ),
        ),
      ),
    ),
  );
}

class QuietIcon extends StatelessWidget {
  final String tooltip;
  final IconData icon;
  final VoidCallback? onPressed;
  final bool selected;
  const QuietIcon({
    super.key,
    required this.tooltip,
    required this.icon,
    this.onPressed,
    this.selected = false,
  });
  @override
  Widget build(BuildContext context) => Tooltip(
    message: tooltip,
    child: Material(
      color: selected ? pale : Colors.transparent,
      borderRadius: BorderRadius.circular(11),
      child: IconButton(
        onPressed: onPressed,
        icon: Icon(icon, size: 19, color: selected ? blue : null),
      ),
    ),
  );
}
