import 'package:flutter_test/flutter_test.dart';

import 'package:mtalaba_student/core/config/app_config.dart';

void main() {
  test('AppConfig exposes a default API base URL', () {
    expect(AppConfig.apiBaseUrl, isNotEmpty);
  });
}
