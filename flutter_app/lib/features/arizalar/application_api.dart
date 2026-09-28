import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_client.dart';
import 'application_models.dart';

final applicationApiProvider = Provider((ref) => ApplicationApi(ref.watch(apiClientProvider)));

class ApplicationApi {
  ApplicationApi(this._dio);
  final Dio _dio;

  Future<List<StudentApplication>> fetchApplications() => guardApiCall(() async {
        final response = await _dio.get<Map<String, dynamic>>(
          '/api/student/applications',
          queryParameters: {'kind': 'documents', 'limit': 100},
        );
        return (response.data!['applications'] as List<dynamic>)
            .map((e) => StudentApplication.fromJson(e as Map<String, dynamic>))
            .toList();
      });

  Future<StudentApplication> createApplication({
    required String title,
    required String type,
    required String reason,
    required String text,
  }) =>
      guardApiCall(() async {
        final response = await _dio.post<Map<String, dynamic>>(
          '/api/student/applications',
          data: {'title': title, 'type': type, 'reason': reason, 'text': text, 'status': 'draft'},
        );
        return StudentApplication.fromJson(response.data!['application'] as Map<String, dynamic>);
      });

  /// Signs and submits a draft with a typed-name attestation (the simpler
  /// of the two signature paths the web supports — the hand-drawn/formal
  /// composer with an image signature is left to the web app for now).
  Future<void> submitApplication(String id, String typedName) => guardApiCall(() async {
        await _dio.patch(
          '/api/student/applications',
          data: {
            'id': id,
            'signature': {'typedName': typedName, 'attested': true},
          },
        );
      });

  Future<void> deleteApplication(String id) => guardApiCall(() async {
        await _dio.delete('/api/student/applications', queryParameters: {'id': id});
      });
}
