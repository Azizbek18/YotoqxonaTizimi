import 'package:flutter/material.dart';

/// Colors lifted directly from the web app's talaba design system
/// (app/talaba/layout.tsx's `body.talaba-ui` block) so the Flutter app reads
/// as the same product, not a generic Material app.
class AppColors {
  const AppColors._();

  // Brand — one indigo hue, top-lit for the "shelf" button effect.
  static const indigoTop = Color(0xFF6366F1);
  static const indigoBottom = Color(0xFF4F46E5);
  static const indigoEdge = Color(0xFF3730A3);
  static const indigoShadow = Color(0x474F46E5); // rgba(79,70,229,0.28)

  static const dangerTop = Color(0xFFF43F5E);
  static const dangerBottom = Color(0xFFE11D48);
  static const dangerEdge = Color(0xFF9F1239);
  static const dangerShadow = Color(0x47E11D48);

  static const amber = Color(0xFFF59E0B);
  static const emerald = Color(0xFF10B981);
  static const rose = Color(0xFFF43F5E);
  static const blue = Color(0xFF3B82F6);

  // Dark theme surfaces (web: #02040a background, white/5 borders).
  static const darkBg = Color(0xFF02040A);
  static const darkSurface = Color(0xFF0B101D);
  static const darkBorder = Color(0x0DFFFFFF); // white/5
  static const darkCard = Color(0x05FFFFFF); // white/[0.02-0.05]

  // Light theme surfaces (web: slate-50/100 gradient).
  static const lightBg = Color(0xFFF8FAFC);
  static const lightSurface = Color(0xFFFFFFFF);
  static const lightBorder = Color(0xFFE2E8F0); // slate-200
  static const lightCard = Color(0xFFF8FAFC); // slate-50

  // Tonal (secondary button) tint.
  static const tonalBgLight = Color(0xFFEEF2FF);
  static const tonalEdgeLight = Color(0xFFC7D2FE);
  static const tonalTextLight = Color(0xFF4338CA);
  static const tonalBgDark = Color(0x28818CF6); // rgba(99,102,241,0.16)
  static const tonalEdgeDark = Color(0x4D818CF6);
  static const tonalTextDark = Color(0xFFC7D2FE);
}
