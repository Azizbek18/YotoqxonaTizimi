import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../auth/auth_controller.dart';
import '../config/app_config.dart';
import 'api_exception.dart';

/// Shared Dio instance for all authenticated calls to the web app's
/// /api/* routes. Every request gets the current Supabase access token
/// attached; a 401 response forces the user back to the login screen
/// (403 — inactive/blacklisted student — is left for the calling screen
/// to handle, since the JWT is still valid there).
final apiClientProvider = Provider<Dio>((ref) {
  final dio = Dio(BaseOptions(baseUrl: AppConfig.apiBaseUrl));

  dio.interceptors.add(
    InterceptorsWrapper(
      onRequest: (options, handler) {
        final token = Supabase.instance.client.auth.currentSession?.accessToken;
        if (token != null) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        handler.next(options);
      },
      onError: (error, handler) {
        if (error.response?.statusCode == 401) {
          ref.read(authControllerProvider.notifier).forceSignOut();
        }
        handler.next(error);
      },
    ),
  );

  return dio;
});

/// Convenience wrapper: runs [call], mapping any DioException to [ApiException].
Future<T> guardApiCall<T>(Future<T> Function() call) async {
  try {
    return await call();
  } on DioException catch (error) {
    throw ApiException.fromDioError(error);
  }
}
