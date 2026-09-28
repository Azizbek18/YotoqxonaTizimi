import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/api_client.dart';
import '../router/app_router.dart';
import 'fcm_service.dart';

final fcmServiceProvider = Provider<FcmService>((ref) {
  return FcmService(ref.watch(apiClientProvider), ref.watch(appRouterProvider));
});
