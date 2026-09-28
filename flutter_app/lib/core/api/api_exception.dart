import 'package:dio/dio.dart';

/// Wraps the `{ error: string }` / `{ ok: false, error: string }` JSON shape
/// used across the web app's API routes into a typed exception.
class ApiException implements Exception {
  ApiException(this.message, {this.statusCode});

  factory ApiException.fromDioError(DioException error) {
    final status = error.response?.statusCode;
    final data = error.response?.data;
    String message = error.message ?? 'Tarmoq xatosi';
    if (data is Map && data['error'] is String) {
      message = data['error'] as String;
    }
    return ApiException(message, statusCode: status);
  }

  final String message;
  final int? statusCode;

  bool get isUnauthorized => statusCode == 401;
  bool get isForbidden => statusCode == 403;

  @override
  String toString() => message;
}
