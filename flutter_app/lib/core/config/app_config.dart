/// Build-time configuration, supplied via --dart-define at build/run time.
/// Every value below has a working default (the production web app's own
/// public config), so a plain `flutter build apk` / `flutter run` already
/// points at the real backend. Override via --dart-define only to point at
/// a local dev server instead:
///
///   flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3000
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

  static const supabaseUrl = String.fromEnvironment(
    'SUPABASE_URL',
    defaultValue: 'https://qgnjhkvmuywlfdnjfpqg.supabase.co',
  );

  static const supabaseAnonKey = String.fromEnvironment(
    'SUPABASE_ANON_KEY',
    defaultValue: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnbmpoa3ZtdXl3bGZkbmpmcHFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5MzU1ODgsImV4cCI6MjA4OTUxMTU4OH0.i48iTJcv-NJhoNw_2JwuJr9LJIvBJ6qG0MylLR9qzNU',
  );

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
