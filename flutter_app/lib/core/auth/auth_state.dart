/// Talaba (student) role resolved from /api/auth/resolve-role.
///
/// The Flutter app is student-only (see the plan) — any other resolved role,
/// or a null role with a reason, means "not for this app".
sealed class AuthStatus {
  const AuthStatus();
}

class AuthUnauthenticated extends AuthStatus {
  const AuthUnauthenticated();
}

class AuthAuthenticating extends AuthStatus {
  const AuthAuthenticating();
}

/// Signed in, but resolve-role didn't return `talaba` — e.g. staff account,
/// unverified email, or awaiting dean approval. [reason] is the raw code
/// from the API (`email_not_verified` | `awaiting_dean_approval` | `no_role`)
/// or the non-talaba role name, for a friendly message in the UI.
class AuthRoleRejected extends AuthStatus {
  const AuthRoleRejected(this.reason);
  final String reason;
}

class AuthAuthenticated extends AuthStatus {
  const AuthAuthenticated();
}
