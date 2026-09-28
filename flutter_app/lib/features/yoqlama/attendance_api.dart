import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_client.dart';

final attendanceApiProvider = Provider((ref) => AttendanceApi(ref.watch(apiClientProvider)));

class AttendanceSummary {
  AttendanceSummary({required this.hasOpen, this.closesAt, this.present, this.absent, this.excused, this.unmarked, this.total});

  factory AttendanceSummary.fromJson(Map<String, dynamic> json) {
    final hasOpen = json['hasOpen'] as bool? ?? false;
    final summary = json['summary'] as Map<String, dynamic>?;
    return AttendanceSummary(
      hasOpen: hasOpen,
      closesAt: json['closesAt'] as String?,
      present: (summary?['present'] as num?)?.toInt(),
      absent: (summary?['absent'] as num?)?.toInt(),
      excused: (summary?['excused'] as num?)?.toInt(),
      unmarked: (summary?['unmarked'] as num?)?.toInt(),
      total: (summary?['total'] as num?)?.toInt(),
    );
  }

  final bool hasOpen;
  final String? closesAt;
  final int? present;
  final int? absent;
  final int? excused;
  final int? unmarked;
  final int? total;
}

class CheckinResult {
  CheckinResult({required this.status, this.distanceM, this.state});

  factory CheckinResult.fromJson(Map<String, dynamic> json) => CheckinResult(
        status: json['status'] as String? ?? 'retry',
        distanceM: (json['distanceM'] as num?)?.toDouble(),
        state: json['state'] as String?,
      );

  final String status;
  final double? distanceM;
  final String? state;
}

class AttendanceApi {
  AttendanceApi(this._dio);
  final Dio _dio;

  Future<AttendanceSummary> fetchSummary() => guardApiCall(() async {
        final response = await _dio.get<Map<String, dynamic>>('/api/attendance/summary');
        return AttendanceSummary.fromJson(response.data!);
      });

  Future<CheckinResult> checkin({required double lat, required double lng, required double accuracy}) =>
      guardApiCall(() async {
        final response = await _dio.post<Map<String, dynamic>>(
          '/api/attendance/checkin',
          data: {'lat': lat, 'lng': lng, 'accuracy': accuracy},
        );
        return CheckinResult.fromJson(response.data!);
      });
}
