import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme/app_colors.dart';

const _tabs = [
  ('/dashboard', Icons.home_outlined, Icons.home_rounded, 'Asosiy'),
  ('/elonlar', Icons.campaign_outlined, Icons.campaign_rounded, "E'lonlar"),
  ('/navbat', Icons.groups_outlined, Icons.groups_rounded, 'Navbat'),
  ('/tolova', Icons.credit_card_outlined, Icons.credit_card_rounded, "To'lov"),
  ('/arizalar', Icons.description_outlined, Icons.description_rounded, 'Arizalar'),
];

/// Mirrors the web app's floating pill-shaped bottom nav (app/talaba/layout.tsx):
/// rounded, inset from the screen edges with a soft shadow, five destinations.
class AppBottomNav extends StatelessWidget {
  const AppBottomNav({super.key, required this.currentPath});

  final String currentPath;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final index = _tabs.indexWhere((t) => t.$1 == currentPath).clamp(0, _tabs.length - 1);
    final bottomInset = MediaQuery.of(context).padding.bottom;

    return Padding(
      padding: EdgeInsets.fromLTRB(12, 0, 12, 8 + bottomInset),
      child: Container(
        height: 66,
        decoration: BoxDecoration(
          color: isDark ? const Color(0xF2020617) : Colors.white.withValues(alpha: 0.97),
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: isDark ? Colors.white.withValues(alpha: 0.08) : const Color(0xFFE2E8F0)),
          boxShadow: [
            BoxShadow(
              color: isDark ? Colors.black.withValues(alpha: 0.5) : Colors.black.withValues(alpha: 0.08),
              blurRadius: 24,
              offset: const Offset(0, 10),
            ),
          ],
        ),
        clipBehavior: Clip.antiAlias,
        child: Row(
          children: [
            for (var i = 0; i < _tabs.length; i++)
              Expanded(
                child: _NavItem(
                  outlineIcon: _tabs[i].$2,
                  filledIcon: _tabs[i].$3,
                  label: _tabs[i].$4,
                  active: i == index,
                  isDark: isDark,
                  onTap: () {
                    if (_tabs[i].$1 != currentPath) context.go(_tabs[i].$1);
                  },
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _NavItem extends StatelessWidget {
  const _NavItem({
    required this.outlineIcon,
    required this.filledIcon,
    required this.label,
    required this.active,
    required this.isDark,
    required this.onTap,
  });

  final IconData outlineIcon;
  final IconData filledIcon;
  final String label;
  final bool active;
  final bool isDark;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final activeColor = isDark ? const Color(0xFFA5B4FC) : AppColors.indigoBottom;
    final inactiveColor = isDark ? const Color(0xFF64748B) : const Color(0xFF94A3B8);
    final color = active ? activeColor : inactiveColor;

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(18),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            AnimatedContainer(
              duration: const Duration(milliseconds: 180),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 5),
              decoration: BoxDecoration(
                color: active ? (isDark ? AppColors.indigoTop.withValues(alpha: 0.15) : const Color(0xFFEEF2FF)) : null,
                borderRadius: BorderRadius.circular(14),
              ),
              child: Icon(active ? filledIcon : outlineIcon, size: 21, color: color),
            ),
            const SizedBox(height: 4),
            Text(
              label,
              style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: color, letterSpacing: 0.1),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }
}
