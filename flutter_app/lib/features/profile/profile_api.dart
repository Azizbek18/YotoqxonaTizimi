import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_client.dart';
import 'profile_models.dart';

final profileApiProvider = Provider((ref) => ProfileApi(ref.watch(apiClientProvider)));

class ProfileApi {
  ProfileApi(this._dio);
  final Dio _dio;

  Future<StudentProfilePayload> fetchProfile() => guardApiCall(() async {
        final response = await _dio.get<Map<String, dynamic>>('/api/student/profile');
        return StudentProfilePayload.fromJson(response.data!);
      });

  /// Self-service edit is deliberately narrow on the web too: a student may
  /// only correct their own group code (see features/profile/types.ts).
  Future<void> updateGroup(String group) => guardApiCall(() async {
        await _dio.patch('/api/student/profile/update', data: {'group': group});
      });

  Future<String> uploadAvatar(File file) => guardApiCall(() async {
        final form = FormData.fromMap({
          'file': await MultipartFile.fromFile(file.path, filename: file.path.split(Platform.pathSeparator).last),
        });
        final response = await _dio.post<Map<String, dynamic>>(
          '/api/student/profile/upload-avatar',
          data: form,
        );
        return response.data!['avatar_url'] as String;
      });

  Future<void> deleteAvatar() => guardApiCall(() async {
        await _dio.delete('/api/student/profile/upload-avatar');
      });

  Future<List<DeviceSession>> fetchSessions() => guardApiCall(() async {
        final response = await _dio.get<Map<String, dynamic>>('/api/account/sessions');
        return (response.data!['sessions'] as List<dynamic>)
            .map((e) => DeviceSession.fromJson(e as Map<String, dynamic>))
            .toList();
      });

  Future<void> revokeSession(String sessionId) => guardApiCall(() async {
        await _dio.post('/api/account/sessions', data: {'action': 'revoke', 'sessionId': sessionId});
      });

  Future<int> revokeOtherSessions() => guardApiCall(() async {
        final response = await _dio.post<Map<String, dynamic>>(
          '/api/account/sessions',
          data: {'action': 'revoke-others'},
        );
        return (response.data!['revoked'] as num?)?.toInt() ?? 0;
      });
}
