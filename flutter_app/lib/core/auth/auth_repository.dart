import 'package:dio/dio.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../config/app_config.dart';

/// Result of a successful sign-in + role resolution.
class ResolvedRole {
  const ResolvedRole({required this.ok, this.role, this.reason});

  final bool ok;
  final String? role;

  /// Set when [role] is null: 'email_not_verified' | 'awaiting_dean_approval' | 'no_role'.
  final String? reason;
}

/// Mirrors the web app's app/login/page.tsx sign-in sequence exactly:
/// 1. supabase sign-in with email/password.
/// 2. POST the fresh access token as Bearer to /api/auth/resolve-role,
///    retrying up to 3x ONLY on HTTP 401 (session-propagation lag right
///    after sign-in), with delays [0, 200, 500]ms.
/// 3. Caller decides what to do with the returned role.
class AuthRepository {
  AuthRepository() : _bootstrapDio = Dio(BaseOptions(baseUrl: AppConfig.apiBaseUrl));

  final Dio _bootstrapDio;

  SupabaseClient get _supabase => Supabase.instance.client;

  Session? get currentSession => _supabase.auth.currentSession;

  Stream<AuthState> get onAuthStateChange => _supabase.auth.onAuthStateChange;

  Future<ResolvedRole> signInAndResolveRole({
    required String email,
    required String password,
  }) async {
    final response = await _supabase.auth.signInWithPassword(
      email: email,
      password: password,
    );
    final accessToken = response.session?.accessToken;
    if (accessToken == null) {
      throw const AuthException('Kirishda xatolik yuz berdi');
    }
    return _resolveRoleWithRetry(accessToken);
  }

  /// Re-resolves the role for an already-active session (e.g. app relaunch).
  Future<ResolvedRole> resolveCurrentRole() async {
    final accessToken = currentSession?.accessToken;
    if (accessToken == null) {
      return const ResolvedRole(ok: false, reason: 'no_role');
    }
    return _resolveRoleWithRetry(accessToken);
  }

  Future<ResolvedRole> _resolveRoleWithRetry(String accessToken) async {
    const delays = [Duration.zero, Duration(milliseconds: 200), Duration(milliseconds: 500)];
    DioException? lastError;

    for (final delay in delays) {
      if (delay > Duration.zero) await Future.delayed(delay);
      try {
        final response = await _bootstrapDio.post<Map<String, dynamic>>(
          '/api/auth/resolve-role',
          options: Options(headers: {'Authorization': 'Bearer $accessToken'}),
        );
        final data = response.data ?? const {};
        return ResolvedRole(
          ok: data['ok'] == true,
          role: data['role'] as String?,
          reason: data['reason'] as String?,
        );
      } on DioException catch (error) {
        lastError = error;
        if (error.response?.statusCode != 401) rethrow;
        // else: fall through and retry (session-propagation lag)
      }
    }
    throw lastError ?? Exception('resolve-role failed');
  }

  Future<void> signOut() => _supabase.auth.signOut();
}
