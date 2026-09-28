import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../auth/auth_controller.dart';
import '../auth/auth_state.dart';
import '../../features/auth/login_screen.dart';
import '../../features/auth/role_rejected_screen.dart';
import '../../features/auth/splash_screen.dart';
import '../../features/arizalar/arizalar_screen.dart';
import '../../features/dashboard/dashboard_screen.dart';
import '../../features/hujjatlarim/hujjatlarim_screen.dart';
import '../../features/navbat/navbat_screen.dart';
import '../../features/profile/profile_screen.dart';
import '../../features/tolova/tolova_screen.dart';
import '../../features/yoqlama/yoqlama_screen.dart';

class _AuthRefreshNotifier extends ChangeNotifier {
  void ping() => notifyListeners();
}

final appRouterProvider = Provider<GoRouter>((ref) {
  final refresh = _AuthRefreshNotifier();
  ref.listen(authControllerProvider, (_, _) => refresh.ping());
  ref.onDispose(refresh.dispose);

  return GoRouter(
    initialLocation: '/',
    refreshListenable: refresh,
    redirect: (context, state) {
      final auth = ref.read(authControllerProvider);
      final path = state.matchedLocation;

      if (auth is AuthAuthenticating) {
        return path == '/' ? null : '/';
      }
      if (auth is AuthUnauthenticated) {
        return path == '/login' ? null : '/login';
      }
      if (auth is AuthRoleRejected) {
        return path == '/role-rejected' ? null : '/role-rejected';
      }
      // AuthAuthenticated
      if (path == '/' || path == '/login' || path == '/role-rejected') {
        return '/dashboard';
      }
      return null;
    },
    routes: [
      GoRoute(path: '/', builder: (context, state) => const SplashScreen()),
      GoRoute(path: '/login', builder: (context, state) => const LoginScreen()),
      GoRoute(path: '/role-rejected', builder: (context, state) => const RoleRejectedScreen()),
      GoRoute(path: '/dashboard', builder: (context, state) => const DashboardScreen()),
      GoRoute(path: '/arizalar', builder: (context, state) => const ArizalarScreen()),
      GoRoute(path: '/tolova', builder: (context, state) => const TolovaScreen()),
      GoRoute(path: '/navbat', builder: (context, state) => const NavbatScreen()),
      GoRoute(path: '/profil', builder: (context, state) => const ProfileScreen()),
      GoRoute(path: '/yoqlama', builder: (context, state) => const YoqlamaScreen()),
      GoRoute(path: '/hujjatlarim', builder: (context, state) => const HujjatlarimScreen()),
    ],
  );
});
