import 'dart:convert';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_client.dart';
import '../../core/api/api_exception.dart';
import 'payment_models.dart';

final paymentApiProvider = Provider(
  (ref) => PaymentApi(ref.watch(apiClientProvider)),
);

class PaymentCheckResult {
  const PaymentCheckResult({
    required this.valid,
    this.claim,
    this.transactionId,
    this.analysis,
    this.confidence,
  });

  factory PaymentCheckResult.fromJson(Map<String, dynamic> json) =>
      PaymentCheckResult(
        valid: json['valid'] == true,
        claim: json['claim'] as String?,
        transactionId: json['transaction_id'] as String?,
        analysis: json['analysis'] as String?,
        confidence: (json['confidence'] as num?)?.toInt(),
      );

  final bool valid;
  final String? claim;
  final String? transactionId;
  final String? analysis;
  final int? confidence;
}

class PaymentApi {
  PaymentApi(this._dio);
  final Dio _dio;

  Future<List<PaymentRecord>> fetchPayments() => guardApiCall(() async {
    final response = await _dio.get<Map<String, dynamic>>(
      '/api/student/payments',
    );
    return (response.data!['payments'] as List<dynamic>)
        .map((e) => PaymentRecord.fromJson(e as Map<String, dynamic>))
        .toList();
  });

  Future<PaymentCheckResult> verifyReceipt({
    required File receipt,
    required double amount,
  }) => guardApiCall(() async {
    final form = FormData.fromMap({
      'file': await MultipartFile.fromFile(
        receipt.path,
        filename: receipt.path.split(Platform.pathSeparator).last,
      ),
      'amount': amount.toString(),
    });
    final response = await _dio.post<Map<String, dynamic>>(
      '/api/ai/tekshiruv',
      data: form,
    );
    final result = PaymentCheckResult.fromJson(response.data ?? const {});
    if (!result.valid || result.claim == null) {
      throw ApiException(
        result.analysis?.trim().isNotEmpty == true
            ? result.analysis!
            : 'Chek AI tekshiruvidan o‘tmadi. Iltimos, aniqroq rasm yuboring.',
      );
    }
    return result;
  });

  Future<void> submitPayment({
    required File receipt,
    required double amount,
    required int academicYearStart,
    required List<String> months,
    required String? transactionId,
    required String validatedHash,
  }) => guardApiCall(() async {
    final form = FormData.fromMap({
      'file': await MultipartFile.fromFile(
        receipt.path,
        filename: receipt.path.split(Platform.pathSeparator).last,
      ),
      'amount': amount.toString(),
      'academicYearStart': academicYearStart.toString(),
      'months': jsonEncode(months),
      'transactionId': transactionId ?? '',
      'validatedHash': validatedHash,
    });
    await _dio.post('/api/student/payments', data: form);
  });
}
