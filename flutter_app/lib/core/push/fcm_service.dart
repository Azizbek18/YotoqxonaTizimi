import 'package:dio/dio.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:go_router/go_router.dart';

import '../config/app_config.dart';

/// The backend's notification `url` values are the *web* paths (see
/// lib/notify-student.ts's 7 call sites) — map them to this app's routes.
/// An unrecognized or permit-anchored web-only path (e.g.
/// /ruxsatnoma-tekshirish, sent before the applicant has an account and thus
/// never actually reaches this app) falls back to the dashboard.
String mapNotificationUrlToRoute(String? url) {
  switch (url) {
    case '/talaba/dashboard':
      return '/dashboard';
    case '/talaba/yoqlama':
      return '/yoqlama';
    case '/talaba/hujjatlarim':
      return '/hujjatlarim';
    case '/talaba/tolova':
      return '/tolova';
    case '/talaba/arizalar':
      return '/arizalar';
    case '/talaba/navbat':
      return '/navbat';
    default:
      return '/dashboard';
  }
}

@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  // All 7 backend call sites send a plain title/body/tag/url notification —
  // the OS renders it from `notification`, nothing to do here beyond making
  // sure Firebase is initialized in this isolate.
  if (Firebase.apps.isEmpty && AppConfig.isFirebaseConfigured) {
    await Firebase.initializeApp(options: _firebaseOptions());
  }
}

FirebaseOptions _firebaseOptions() => FirebaseOptions(
      apiKey: AppConfig.firebaseApiKey,
      appId: AppConfig.firebaseAppId,
      messagingSenderId: AppConfig.firebaseMessagingSenderId,
      projectId: AppConfig.firebaseProjectId,
    );

/// Call once at startup, before runApp(), only when
/// AppConfig.isFirebaseConfigured.
Future<void> initializeFirebase() async {
  await Firebase.initializeApp(options: _firebaseOptions());
  FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);
}

class FcmService {
  FcmService(this._dio, this._router);

  final Dio _dio;
  final GoRouter _router;
  final _localNotifications = FlutterLocalNotificationsPlugin();
  bool _initialized = false;

  static const _channel = AndroidNotificationChannel(
    'default_channel',
    'Bildirishnomalar',
    description: "MTalaba ilovasining asosiy bildirishnoma kanali",
    importance: Importance.high,
  );

  Future<void> _ensureInitialized() async {
    if (_initialized) return;
    _initialized = true;

    await _localNotifications.initialize(
      const InitializationSettings(
        android: AndroidInitializationSettings('@mipmap/ic_launcher'),
      ),
      onDidReceiveNotificationResponse: (response) {
        _handleRouteFromPayload(response.payload);
      },
    );
    await _localNotifications
        .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()
        ?.createNotificationChannel(_channel);

    FirebaseMessaging.onMessage.listen(_showForegroundNotification);
    FirebaseMessaging.onMessageOpenedApp.listen((message) => _handleRoute(message.data['url'] as String?));

    final initialMessage = await FirebaseMessaging.instance.getInitialMessage();
    if (initialMessage != null) _handleRoute(initialMessage.data['url'] as String?);

    FirebaseMessaging.instance.onTokenRefresh.listen(_registerToken);
  }

  Future<void> _showForegroundNotification(RemoteMessage message) async {
    final notification = message.notification;
    if (notification == null) return;
    await _localNotifications.show(
      message.hashCode,
      notification.title,
      notification.body,
      NotificationDetails(
        android: AndroidNotificationDetails(_channel.id, _channel.name, channelDescription: _channel.description),
      ),
      payload: message.data['url'] as String?,
    );
  }

  void _handleRouteFromPayload(String? payload) => _handleRoute(payload);

  void _handleRoute(String? url) {
    if (!_router.canPop()) {
      _router.go(mapNotificationUrlToRoute(url));
    } else {
      _router.push(mapNotificationUrlToRoute(url));
    }
  }

  /// Called after a confirmed `talaba` login. Requests permission, gets the
  /// current token, and registers it with the backend.
  Future<void> registerForCurrentUser() async {
    if (!AppConfig.isFirebaseConfigured) return;
    await _ensureInitialized();

    final settings = await FirebaseMessaging.instance.requestPermission();
    if (settings.authorizationStatus == AuthorizationStatus.denied) return;

    final token = await FirebaseMessaging.instance.getToken();
    if (token != null) await _registerToken(token);
  }

  Future<void> _registerToken(String token) async {
    try {
      await _dio.post('/api/push/fcm-subscribe', data: {
        'token': token,
        'platform': defaultTargetPlatform == TargetPlatform.iOS ? 'ios' : 'android',
      });
    } catch (error) {
      debugPrint('FCM token registration failed: $error');
    }
  }

  /// Called on sign-out so a logged-out device stops receiving this
  /// account's notifications.
  Future<void> unregister() async {
    if (!AppConfig.isFirebaseConfigured) return;
    try {
      final token = await FirebaseMessaging.instance.getToken();
      if (token != null) {
        await _dio.delete('/api/push/fcm-subscribe', queryParameters: {'token': token});
      }
    } catch (error) {
      debugPrint('FCM token unregister failed: $error');
    }
  }
}
