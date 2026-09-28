import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_client.dart';

final navbatApiProvider = Provider((ref) => NavbatApi(ref.watch(apiClientProvider)));

class FloorCaptain {
  FloorCaptain({required this.fullName, this.roomNumber, this.phoneNumber, this.avatarUrl});

  factory FloorCaptain.fromJson(Map<String, dynamic> json) => FloorCaptain(
        fullName: json['full_name'] as String? ?? '',
        roomNumber: json['room_number'] as String?,
        phoneNumber: json['phone_number'] as String?,
        avatarUrl: json['avatar_url'] as String?,
      );

  final String fullName;
  final String? roomNumber;
  final String? phoneNumber;
  final String? avatarUrl;
}

class DutyScheduleData {
  DutyScheduleData({required this.floorCaptains, required this.schedule});

  factory DutyScheduleData.fromJson(Map<String, dynamic> json) => DutyScheduleData(
        floorCaptains: (json['floorCaptains'] as List<dynamic>? ?? [])
            .map((e) => FloorCaptain.fromJson(e as Map<String, dynamic>))
            .toList(),
        schedule: Map<String, dynamic>.from(json['schedule'] as Map? ?? {}),
      );

  final List<FloorCaptain> floorCaptains;
  final Map<String, dynamic> schedule;
}

class NavbatApi {
  NavbatApi(this._dio);
  final Dio _dio;

  Future<DutyScheduleData> fetchDutySchedule() => guardApiCall(() async {
        final response = await _dio.get<Map<String, dynamic>>('/api/student/duty-schedule');
        return DutyScheduleData.fromJson(response.data!);
      });

  /// Raw cleaning-schedule map: day/slot label -> {id, name} or null.
  Future<Map<String, dynamic>> fetchCleaningSchedule() => guardApiCall(() async {
        final response = await _dio.get<Map<String, dynamic>>('/api/student/cleaning-schedule');
        return response.data ?? {};
      });
}
