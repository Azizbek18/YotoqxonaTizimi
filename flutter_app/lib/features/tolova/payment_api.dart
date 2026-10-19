import 'dart:convert';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_client.dart';
import 'payment_models.dart';

final paymentApiProvider = Provider((ref) => PaymentApi(ref.watch(apiClientProvider)));

class PaymentApi {
  PaymentApi(this._dio);
  final Dio _dio;

  Future<PaymentSettings> fetchSettings() => guardApiCall(() async {
        final response = await _dio.get<Map<String, dynamic>>('/api/settings');
        return PaymentSettings.fromJson(response.data!);
      });

  Future<List<PaymentRecord>> fetchPayments() => guardApiCall(() async {
        final response = await _dio.get<Map<String, dynamic>>('/api/student/payments');
        return (response.data!['payments'] as List<dynamic>)
            .map((e) => PaymentRecord.fromJson(e as Map<String, dynamic>))
            .toList();
      });

  Future<AiCheckResult> precheckReceipt({
    required File file,
    required double amount,
  }) =>
      guardApiCall(() async {
        final form = FormData.fromMap({
          'file': await MultipartFile.fromFile(
            file.path,
            filename: file.path.split(Platform.pathSeparator).last,
          ),
          'amount': amount.toString(),
        });
        final response = await _dio.post<Map<String, dynamic>>(
          '/api/ai/tekshiruv',
          data: form,
        );
        return AiCheckResult.fromJson(response.data!);
      });

  Future<void> submitPayment({
    required File receipt,
    required double amount,
    required int academicYearStart,
    required List<String> months,
    String? validatedHash,
    String? transactionId,
  }) =>
      guardApiCall(() async {
        final form = FormData.fromMap({
          'file': await MultipartFile.fromFile(
            receipt.path,
            filename: receipt.path.split(Platform.pathSeparator).last,
          ),
          'amount': amount.toString(),
          'academicYearStart': academicYearStart.toString(),
          'months': jsonEncode(months),
          if (validatedHash != null && validatedHash.isNotEmpty) 'validatedHash': validatedHash,
          if (transactionId != null && transactionId.isNotEmpty) 'transactionId': transactionId,
        });
        final response = await _dio.post<Map<String, dynamic>>('/api/student/payments', data: form);
        final records = response.data?['records'] as List<dynamic>?;
        if (records != null && records.isNotEmpty) {
          final firstRecord = records.first as Map<String, dynamic>;
          final paymentId = firstRecord['id'] as String?;
          if (paymentId != null) {
            // Fire-and-forget background AI analysis trigger (mirrors the web app)
            try {
              await _dio.post('/api/ai/tahlil', data: {'paymentId': paymentId});
            } catch (_) {}
          }
        }
      });
}
