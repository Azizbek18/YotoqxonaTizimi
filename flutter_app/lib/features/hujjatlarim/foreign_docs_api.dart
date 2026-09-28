import 'dart:convert';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_client.dart';

final foreignDocsApiProvider = Provider((ref) => ForeignDocsApi(ref.watch(apiClientProvider)));

const docTypeLabels = {'visa': 'Viza', 'registration': "Ro'yxatga qo'yish (propiska)"};
const docStatusLabels = {'active': 'Faol', 'renewing': 'Yangilanmoqda', 'cancelled': 'Bekor qilingan'};

class ForeignDoc {
  ForeignDoc({
    required this.id,
    required this.docType,
    this.number,
    this.issuedOn,
    required this.expiresOn,
    required this.status,
    this.address,
    this.note,
    required this.hasFile,
    required this.daysLeft,
  });

  factory ForeignDoc.fromJson(Map<String, dynamic> json) => ForeignDoc(
        id: json['id'] as String,
        docType: json['docType'] as String? ?? 'visa',
        number: json['number'] as String?,
        issuedOn: json['issuedOn'] as String?,
        expiresOn: json['expiresOn'] as String? ?? '',
        status: json['status'] as String? ?? 'active',
        address: json['address'] as String?,
        note: json['note'] as String?,
        hasFile: json['hasFile'] as bool? ?? false,
        daysLeft: (json['daysLeft'] as num?)?.toInt() ?? 0,
      );

  final String id;
  final String docType;
  final String? number;
  final String? issuedOn;
  final String expiresOn;
  final String status;
  final String? address;
  final String? note;
  final bool hasFile;
  final int daysLeft;
}

class ForeignDocsApi {
  ForeignDocsApi(this._dio);
  final Dio _dio;

  Future<List<ForeignDoc>> fetchDocs() => guardApiCall(() async {
        final response = await _dio.get<Map<String, dynamic>>('/api/student/foreign-docs');
        return (response.data!['docs'] as List<dynamic>)
            .map((e) => ForeignDoc.fromJson(e as Map<String, dynamic>))
            .toList();
      });

  Future<void> saveDoc({
    String? id,
    required String docType,
    String? number,
    String? issuedOn,
    required String expiresOn,
    String? registrationBasis,
    String? address,
    File? file,
  }) =>
      guardApiCall(() async {
        final payload = {
          'id': ?id,
          'docType': docType,
          'number': number,
          'issuedOn': issuedOn,
          'expiresOn': expiresOn,
          'registrationBasis': registrationBasis,
          'address': address,
        };
        final form = FormData.fromMap({
          'payload': jsonEncode(payload),
          if (file != null)
            'file': await MultipartFile.fromFile(file.path, filename: file.path.split(Platform.pathSeparator).last),
        });
        await _dio.post('/api/student/foreign-docs', data: form);
      });

  Future<void> deleteDoc(String id) => guardApiCall(() async {
        await _dio.delete('/api/student/foreign-docs', queryParameters: {'id': id});
      });

  /// 60s-TTL signed URL — fetch fresh right before opening, never cache.
  Future<String> fetchFileUrl(String id) => guardApiCall(() async {
        final response = await _dio.get<Map<String, dynamic>>(
          '/api/student/foreign-docs/file',
          queryParameters: {'id': id},
        );
        return response.data!['url'] as String;
      });
}
