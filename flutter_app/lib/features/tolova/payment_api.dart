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

  Future<List<PaymentRecord>> fetchPayments() => guardApiCall(() async {
        final response = await _dio.get<Map<String, dynamic>>('/api/student/payments');
        return (response.data!['payments'] as List<dynamic>)
            .map((e) => PaymentRecord.fromJson(e as Map<String, dynamic>))
            .toList();
      });

  Future<void> submitPayment({
    required File receipt,
    required double amount,
    required int academicYearStart,
    required List<String> months,
    required String transactionId,
  }) =>
      guardApiCall(() async {
        final form = FormData.fromMap({
          'file': await MultipartFile.fromFile(receipt.path, filename: receipt.path.split(Platform.pathSeparator).last),
          'amount': amount.toString(),
          'academicYearStart': academicYearStart.toString(),
          'months': jsonEncode(months),
          'transactionId': transactionId,
        });
        await _dio.post('/api/student/payments', data: form);
      });
}
