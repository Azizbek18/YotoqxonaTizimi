import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';

enum AppButtonTier { primary, secondary, ghost, danger }

/// Matches the web app's Duolingo-inspired "shelf" button (app/talaba/layout.tsx):
/// a solid top-lit face sitting on a darker edge, which the face slides down
/// onto when pressed — instead of Material's flat ripple.
class AppButton extends StatefulWidget {
  const AppButton({
    super.key,
    required this.label,
    this.onPressed,
    this.tier = AppButtonTier.primary,
    this.icon,
    this.loading = false,
    this.expand = true,
  });

  final String label;
  final VoidCallback? onPressed;
  final AppButtonTier tier;
  final IconData? icon;
  final bool loading;
  final bool expand;

  @override
  State<AppButton> createState() => _AppButtonState();
}

class _AppButtonState extends State<AppButton> {
  bool _pressed = false;

  bool get _disabled => widget.onPressed == null || widget.loading;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final spec = _tierSpec(widget.tier, isDark, _disabled);

    final face = AnimatedContainer(
      duration: const Duration(milliseconds: 120),
      curve: Curves.easeOut,
      transform: Matrix4.translationValues(0, _pressed ? 3 : 0, 0),
      padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 20),
      decoration: BoxDecoration(
        gradient: spec.gradient,
        color: spec.gradient == null ? spec.face : null,
        borderRadius: BorderRadius.circular(14),
        border: spec.border != null ? Border.all(color: spec.border!) : null,
      ),
      child: Row(
        mainAxisSize: widget.expand ? MainAxisSize.max : MainAxisSize.min,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          if (widget.loading)
            SizedBox(
              height: 18,
              width: 18,
              child: CircularProgressIndicator(strokeWidth: 2.2, color: spec.text),
            )
          else ...[
            if (widget.icon != null) ...[
              Icon(widget.icon, size: 18, color: spec.text),
              const SizedBox(width: 8),
            ],
            Text(
              widget.label,
              style: TextStyle(
                color: spec.text,
                fontWeight: FontWeight.w800,
                fontSize: 13,
                letterSpacing: 0.4,
              ),
            ),
          ],
        ],
      ),
    );

    final button = Container(
      decoration: BoxDecoration(
        color: spec.edge,
        borderRadius: BorderRadius.circular(14),
      ),
      padding: EdgeInsets.only(bottom: spec.edge == Colors.transparent ? 0 : 4),
      child: face,
    );

    return GestureDetector(
      onTapDown: _disabled ? null : (_) => setState(() => _pressed = true),
      onTapCancel: () => setState(() => _pressed = false),
      onTapUp: (_) => setState(() => _pressed = false),
      onTap: _disabled ? null : widget.onPressed,
      child: Opacity(
        opacity: _disabled && !widget.loading ? 0.5 : 1,
        child: widget.expand ? button : IntrinsicWidth(child: button),
      ),
    );
  }
}

class _TierSpec {
  const _TierSpec({required this.face, required this.text, this.gradient, this.border, this.edge = Colors.transparent});
  final Color face;
  final Color text;
  final Gradient? gradient;
  final Color? border;
  final Color edge;
}

_TierSpec _tierSpec(AppButtonTier tier, bool isDark, bool disabled) {
  switch (tier) {
    case AppButtonTier.primary:
      return _TierSpec(
        face: AppColors.indigoBottom,
        text: Colors.white,
        gradient: const LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [AppColors.indigoTop, AppColors.indigoBottom],
        ),
        edge: disabled ? const Color(0xFF475569) : AppColors.indigoEdge,
      );
    case AppButtonTier.danger:
      return _TierSpec(
        face: AppColors.dangerBottom,
        text: Colors.white,
        gradient: const LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [AppColors.dangerTop, AppColors.dangerBottom],
        ),
        edge: disabled ? const Color(0xFF475569) : AppColors.dangerEdge,
      );
    case AppButtonTier.secondary:
      return _TierSpec(
        face: isDark ? AppColors.tonalBgDark : AppColors.tonalBgLight,
        text: isDark ? AppColors.tonalTextDark : AppColors.tonalTextLight,
        border: isDark ? AppColors.tonalEdgeDark : AppColors.tonalEdgeLight,
        edge: isDark ? AppColors.tonalEdgeDark : AppColors.tonalEdgeLight,
      );
    case AppButtonTier.ghost:
      return _TierSpec(
        face: Colors.transparent,
        text: isDark ? const Color(0xFF94A3B8) : const Color(0xFF475569),
      );
  }
}
