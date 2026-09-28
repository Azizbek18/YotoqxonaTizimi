/// Build-time configuration, supplied via --dart-define at build/run time.
///
/// Example (local dev against `npm run dev`, Android emulator):
///   flutter run \
///     --dart-define=API_BASE_URL=http://10.0.2.2:3000 \
///     --dart-define=SUPABASE_URL=https://your-project.supabase.co \
///     --dart-define=SUPABASE_ANON_KEY=your-anon-key
///
/// Example (production):
///   flutter build apk \
///     --dart-define=API_BASE_URL=https://www.meningyotoqxonam.uz \
///     --dart-define=SUPABASE_URL=https://your-project.supabase.co \
///     --dart-define=SUPABASE_ANON_KEY=your-anon-key
///
/// SUPABASE_URL / SUPABASE_ANON_KEY are the same public values already
/// shipped in the web app's client bundle (see .env.example's
/// NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY) — safe to embed.
class AppConfig {
  const AppConfig._();

  static const apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://www.meningyotoqxonam.uz',
  );

  static const supabaseUrl = String.fromEnvironment('SUPABASE_URL');

  static const supabaseAnonKey = String.fromEnvironment('SUPABASE_ANON_KEY');

  static bool get isConfigured => supabaseUrl.isNotEmpty && supabaseAnonKey.isNotEmpty;

  /// FCM push — the "mtalaba-student" Firebase project's Android app config
  /// (console.firebase.google.com/project/mtalaba-student). These are public
  /// client identifiers (same trust level as the Supabase anon key above),
  /// safe to default in source; override via --dart-define if a different
  /// Firebase project/app is ever needed.
  static const firebaseApiKey = String.fromEnvironment(
    'FIREBASE_API_KEY',
    defaultValue: 'AIzaSyC1jsZXMyXsUvt8R5t1fID8m54XSt3jCCc',
  );
  static const firebaseAppId = String.fromEnvironment(
    'FIREBASE_APP_ID',
    defaultValue: '1:182240385449:android:d45542c86ad3f98fb1ccb8',
  );
  static const firebaseMessagingSenderId = String.fromEnvironment(
    'FIREBASE_MESSAGING_SENDER_ID',
    defaultValue: '182240385449',
  );
  static const firebaseProjectId = String.fromEnvironment(
    'FIREBASE_PROJECT_ID',
    defaultValue: 'mtalaba-student',
  );

  static bool get isFirebaseConfigured =>
      firebaseApiKey.isNotEmpty &&
      firebaseAppId.isNotEmpty &&
      firebaseMessagingSenderId.isNotEmpty &&
      firebaseProjectId.isNotEmpty;
}
