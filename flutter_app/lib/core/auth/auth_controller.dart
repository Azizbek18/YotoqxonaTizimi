import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../push/fcm_provider.dart';
import 'auth_repository.dart';
import 'auth_state.dart';

final authRepositoryProvider = Provider<AuthRepository>((ref) => AuthRepository());

final authControllerProvider = NotifierProvider<AuthController, AuthStatus>(AuthController.new);

class AuthController extends Notifier<AuthStatus> {
  late AuthRepository _repository;

  @override
  AuthStatus build() {
    _repository = ref.watch(authRepositoryProvider);
    // Resume an existing session (e.g. app relaunch with a persisted token)
    // rather than always starting from the login screen.
    if (_repository.currentSession != null) {
      Future.microtask(_resumeSession);
      return const AuthAuthenticating();
    }
    return const AuthUnauthenticated();
  }

  Future<void> _resumeSession() async {
    try {
      final resolved = await _repository.resolveCurrentRole();
      _applyResolvedRole(resolved);
    } catch (_) {
      state = const AuthUnauthenticated();
    }
  }

  Future<void> signIn({required String email, required String password}) async {
    state = const AuthAuthenticating();
    try {
      final resolved = await _repository.signInAndResolveRole(email: email, password: password);
      _applyResolvedRole(resolved);
    } catch (error) {
      await _repository.signOut().catchError((_) {});
      state = AuthRoleRejected(_describeError(error));
    }
  }

  void _applyResolvedRole(ResolvedRole resolved) {
    if (resolved.ok && resolved.role == 'talaba') {
      state = const AuthAuthenticated();
      // Fire-and-forget: a push-registration hiccup must never block login.
      ref.read(fcmServiceProvider).registerForCurrentUser().catchError((_) {});
      return;
    }
    // Wrong role or unresolved — this app is student-only.
    _repository.signOut().catchError((_) {});
    state = AuthRoleRejected(resolved.role ?? resolved.reason ?? 'no_role');
  }

  String _describeError(Object error) {
    final message = error.toString();
    return message.contains('Invalid login credentials') ? 'invalid_credentials' : 'sign_in_failed';
  }

  /// Called by the shared API client's 401 interceptor: the access token is
  /// no longer valid (expired/revoked) — force back to the login screen.
  Future<void> forceSignOut() async {
    await _repository.signOut().catchError((_) {});
    state = const AuthUnauthenticated();
  }

  Future<void> signOut() async {
    // Unregister the push token before the session goes away — the request
    // needs the still-valid access token to authenticate.
    await ref.read(fcmServiceProvider).unregister().catchError((_) {});
    await _repository.signOut();
    state = const AuthUnauthenticated();
  }

  /// Called from the role-rejected screen's "back to login" action. The
  /// underlying Supabase session was already signed out when the rejection
  /// happened; this just resets the local state so the router lets the user
  /// back onto /login instead of bouncing them straight back here.
  void resetToLogin() {
    state = const AuthUnauthenticated();
  }
}
