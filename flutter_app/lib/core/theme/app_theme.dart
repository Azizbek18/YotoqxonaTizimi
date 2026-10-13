import 'package:flutter/material.dart';

import 'app_colors.dart';

/// Matches the web app's talaba design system: one indigo hue, dark theme
/// reading near-black (#02040a) rather than default Material dark grey,
/// bold/uppercase micro-labels, and 16px-rounded cards.
class AppTheme {
  const AppTheme._();

  static ThemeData light() {
    const scheme = ColorScheme.light(
      primary: AppColors.indigoBottom,
      onPrimary: Colors.white,
      secondary: AppColors.indigoTop,
      surface: AppColors.lightSurface,
      onSurface: Color(0xFF0F172A),
      error: AppColors.dangerBottom,
    );
    return _base(
      scheme,
      AppColors.lightBg,
      AppColors.lightCard,
      AppColors.lightBorder,
      Brightness.light,
    );
  }

  static ThemeData dark() {
    const scheme = ColorScheme.dark(
      primary: AppColors.indigoTop,
      onPrimary: Colors.white,
      secondary: AppColors.indigoTop,
      surface: AppColors.darkSurface,
      onSurface: Colors.white,
      error: AppColors.dangerTop,
    );
    return _base(
      scheme,
      AppColors.darkBg,
      AppColors.darkCard,
      AppColors.darkBorder,
      Brightness.dark,
    );
  }

  static ThemeData _base(
    ColorScheme scheme,
    Color scaffoldBg,
    Color cardColor,
    Color borderColor,
    Brightness brightness,
  ) {
    final isDark = brightness == Brightness.dark;
    return ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      scaffoldBackgroundColor: scaffoldBg,
      fontFamily: 'Roboto',
      appBarTheme: AppBarTheme(
        centerTitle: false,
        elevation: 0,
        backgroundColor: scaffoldBg,
        foregroundColor: scheme.onSurface,
        surfaceTintColor: Colors.transparent,
        scrolledUnderElevation: 0,
        titleSpacing: 20,
        titleTextStyle: TextStyle(
          color: scheme.onSurface,
          fontWeight: FontWeight.w800,
          fontSize: 17,
          letterSpacing: 0.2,
        ),
      ),
      cardTheme: CardThemeData(
        color: cardColor,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(18),
          side: BorderSide(color: borderColor),
        ),
        margin: EdgeInsets.zero,
      ),
      bottomSheetTheme: BottomSheetThemeData(
        backgroundColor: isDark
            ? AppColors.darkSurface
            : AppColors.lightSurface,
        surfaceTintColor: Colors.transparent,
        modalBackgroundColor: isDark
            ? AppColors.darkSurface
            : AppColors.lightSurface,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
        ),
        showDragHandle: true,
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: isDark
            ? AppColors.darkSurface
            : AppColors.lightSurface,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        titleTextStyle: TextStyle(
          color: scheme.onSurface,
          fontSize: 20,
          fontWeight: FontWeight.w800,
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size.fromHeight(50),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
          textStyle: const TextStyle(fontWeight: FontWeight.w800),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          minimumSize: const Size.fromHeight(50),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
          side: BorderSide(color: borderColor),
          textStyle: const TextStyle(fontWeight: FontWeight.w800),
        ),
      ),
      floatingActionButtonTheme: FloatingActionButtonThemeData(
        backgroundColor: scheme.primary,
        foregroundColor: scheme.onPrimary,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
      ),
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        backgroundColor: isDark
            ? const Color(0xFF1E293B)
            : const Color(0xFF0F172A),
        contentTextStyle: const TextStyle(
          color: Colors.white,
          fontWeight: FontWeight.w600,
        ),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: isDark
            ? AppColors.tonalBgDark
            : AppColors.tonalBgLight,
        labelStyle: TextStyle(
          color: isDark ? AppColors.tonalTextDark : AppColors.tonalTextLight,
          fontWeight: FontWeight.w800,
          fontSize: 11,
        ),
        side: BorderSide.none,
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: isDark
            ? Colors.white.withValues(alpha: 0.03)
            : const Color(0xFFF8FAFC),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 16,
          vertical: 14,
        ),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(color: borderColor),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(color: borderColor),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: AppColors.indigoTop, width: 1.6),
        ),
        labelStyle: TextStyle(
          color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B),
        ),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: isDark
            ? const Color(0xF2020617)
            : Colors.white.withValues(alpha: 0.97),
        indicatorColor: isDark
            ? AppColors.indigoTop.withValues(alpha: 0.15)
            : const Color(0xFFEEF2FF),
        elevation: 0,
        height: 68,
        labelTextStyle: WidgetStateProperty.resolveWith((states) {
          final active = states.contains(WidgetState.selected);
          return TextStyle(
            fontSize: 10,
            fontWeight: FontWeight.w800,
            letterSpacing: 0.1,
            color: active
                ? (isDark ? const Color(0xFFA5B4FC) : AppColors.indigoBottom)
                : (isDark ? const Color(0xFF64748B) : const Color(0xFF94A3B8)),
          );
        }),
        iconTheme: WidgetStateProperty.resolveWith((states) {
          final active = states.contains(WidgetState.selected);
          return IconThemeData(
            color: active
                ? (isDark ? const Color(0xFFA5B4FC) : AppColors.indigoBottom)
                : (isDark ? const Color(0xFF64748B) : const Color(0xFF94A3B8)),
          );
        }),
      ),
      textTheme: TextTheme(
        headlineMedium: TextStyle(
          fontWeight: FontWeight.w900,
          color: scheme.onSurface,
          letterSpacing: -0.5,
        ),
        titleLarge: TextStyle(
          fontWeight: FontWeight.w800,
          color: scheme.onSurface,
          letterSpacing: -0.2,
        ),
        titleMedium: TextStyle(
          fontWeight: FontWeight.w800,
          color: scheme.onSurface,
          fontSize: 14,
        ),
        bodyMedium: TextStyle(
          color: scheme.onSurface,
          fontSize: 13.5,
          height: 1.4,
        ),
        labelSmall: TextStyle(
          fontWeight: FontWeight.w800,
          fontSize: 10,
          letterSpacing: 0.6,
          color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B),
        ),
      ),
      dividerColor: borderColor,
    );
  }
}
