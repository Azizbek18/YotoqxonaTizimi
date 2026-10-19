import 'package:flutter_test/flutter_test.dart';

import 'package:mtalaba_student/core/config/app_config.dart';
import 'package:mtalaba_student/core/push/fcm_service.dart';
import 'package:mtalaba_student/features/arizalar/application_models.dart';
import 'package:mtalaba_student/features/tolova/payment_models.dart';

void main() {
  group('AppConfig', () {
    test('exposes a default API base URL', () {
      expect(AppConfig.apiBaseUrl, isNotEmpty);
    });
  });

  group('FCM Route Mapping', () {
    test('maps notification URLs to student routes', () {
      expect(mapNotificationUrlToRoute('/talaba/dashboard'), '/dashboard');
      expect(mapNotificationUrlToRoute('/talaba/yoqlama'), '/yoqlama');
      expect(mapNotificationUrlToRoute('/talaba/tolova'), '/tolova');
      expect(mapNotificationUrlToRoute('/talaba/arizalar'), '/arizalar');
      expect(mapNotificationUrlToRoute('/talaba/navbat'), '/navbat');
      expect(mapNotificationUrlToRoute('/talaba/hujjatlarim'), '/hujjatlarim');
      expect(mapNotificationUrlToRoute('/unknown'), '/dashboard');
      expect(mapNotificationUrlToRoute(null), '/dashboard');
    });
  });

  group('Payment Models', () {
    test('parses PaymentSettings correctly', () {
      final json = {'monthlyFee': 400000, 'yearlyContractFee': 4000000};
      final settings = PaymentSettings.fromJson(json);
      expect(settings.monthlyFee, 400000.0);
      expect(settings.yearlyContractFee, 4000000.0);
    });

    test('parses AiCheckResult correctly with valid claim', () {
      final json = {
        'valid': true,
        'aiSkipped': false,
        'confidence': 9,
        'extracted_amount': 350000,
        'transaction_id': 'TX123456',
        'claim': 'hmac-signed-claim',
        'is_duplicate': false,
        'is_suspicious_id': false,
      };
      final result = AiCheckResult.fromJson(json);
      expect(result.valid, isTrue);
      expect(result.aiSkipped, isFalse);
      expect(result.confidence, 9);
      expect(result.extractedAmount, 350000.0);
      expect(result.transactionId, 'TX123456');
      expect(result.claim, 'hmac-signed-claim');
      expect(result.isDuplicate, isFalse);
    });

    test('labels payment statuses properly', () {
      expect(paymentStatusLabel('paid'), "To'landi");
      expect(paymentStatusLabel('approved'), "To'landi");
      expect(paymentStatusLabel('rejected'), 'Rad etildi');
      expect(paymentStatusLabel('waiting'), 'Tekshirilmoqda');
      expect(paymentStatusLabel('other'), 'Kutilmoqda');
    });
  });

  group('Application Models', () {
    test('labels application statuses properly', () {
      expect(applicationStatusLabel('draft'), 'Qoralama');
      expect(applicationStatusLabel('submitted'), 'Yuborilgan');
      expect(applicationStatusLabel('pending'), 'Yuborilgan');
      expect(applicationStatusLabel('answered'), 'Javob berilgan');
      expect(applicationStatusLabel('rejected'), 'Rad etilgan');
      expect(applicationStatusLabel('unknown'), 'unknown');
    });
  });
}
