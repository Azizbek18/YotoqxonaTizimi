import 'package:flutter/material.dart';

/// MTalaba brand seed — matches the web app's indigo-on-slate accent
/// (see memory: talaba/dekan/admin design systems all use one indigo hue).
class AppTheme {
  const AppTheme._();

  static const seed = Color(0xFF4F46E5); // indigo-600

  static ThemeData light() {
    return ThemeData(
      useMaterial3: true,
      colorScheme: ColorScheme.fromSeed(seedColor: seed, brightness: Brightness.light),
      appBarTheme: const AppBarTheme(centerTitle: true, elevation: 0),
      inputDecorationTheme: const InputDecorationTheme(border: OutlineInputBorder()),
    );
  }

  static ThemeData dark() {
    return ThemeData(
      useMaterial3: true,
      colorScheme: ColorScheme.fromSeed(seedColor: seed, brightness: Brightness.dark),
      appBarTheme: const AppBarTheme(centerTitle: true, elevation: 0),
      inputDecorationTheme: const InputDecorationTheme(border: OutlineInputBorder()),
    );
  }
}
