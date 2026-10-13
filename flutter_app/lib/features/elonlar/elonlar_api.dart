import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_client.dart';
import 'elonlar_models.dart';

final elonlarApiProvider = Provider((ref) => ElonlarApi(ref.watch(apiClientProvider)));

class ElonlarPage {
  ElonlarPage({required this.elonlar, required this.currentFaculty});

  final List<Announcement> elonlar;
  final String? currentFaculty;
}

class ElonlarApi {
  ElonlarApi(this._dio);
  final Dio _dio;

  Future<ElonlarPage> fetchAnnouncements() => guardApiCall(() async {
        final response = await _dio.get<Map<String, dynamic>>('/api/elonlar');
        final data = response.data ?? {};
        final list = (data['elonlar'] as List<dynamic>? ?? [])
            .map((e) => Announcement.fromJson(e as Map<String, dynamic>))
            .toList();
        return ElonlarPage(elonlar: list, currentFaculty: data['currentFaculty'] as String?);
      });
}
