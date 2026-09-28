import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'core/config/app_config.dart';
import 'core/push/fcm_service.dart';
import 'core/router/app_router.dart';
import 'core/theme/app_theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  if (!AppConfig.isConfigured) {
    runApp(const _MissingConfigApp());
    return;
  }

  await Supabase.initialize(
    url: AppConfig.supabaseUrl,
    publishableKey: AppConfig.supabaseAnonKey,
  );

  // Optional until a Firebase project exists — see app_config.dart.
  if (AppConfig.isFirebaseConfigured) {
    await initializeFirebase();
  }

  runApp(const ProviderScope(child: MTalabaApp()));
}

class MTalabaApp extends ConsumerWidget {
  const MTalabaApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(appRouterProvider);

    return MaterialApp.router(
      title: 'MTalaba',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light(),
      darkTheme: AppTheme.dark(),
      routerConfig: router,
    );
  }
}

/// Shown when SUPABASE_URL/SUPABASE_ANON_KEY weren't passed via --dart-define
/// (see lib/core/config/app_config.dart for the exact flags).
class _MissingConfigApp extends StatelessWidget {
  const _MissingConfigApp();

  @override
  Widget build(BuildContext context) {
    return const MaterialApp(
      debugShowCheckedModeBanner: false,
      home: Scaffold(
        body: Center(
          child: Padding(
            padding: EdgeInsets.all(24),
            child: Text(
              'SUPABASE_URL va SUPABASE_ANON_KEY --dart-define orqali berilmagan.\n'
              'lib/core/config/app_config.dart faylidagi izohga qarang.',
              textAlign: TextAlign.center,
            ),
          ),
        ),
      ),
    );
  }
}
