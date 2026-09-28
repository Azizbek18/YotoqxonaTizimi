import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';

import '../../core/api/api_exception.dart';
import 'attendance_api.dart';

class YoqlamaScreen extends ConsumerStatefulWidget {
  const YoqlamaScreen({super.key});

  @override
  ConsumerState<YoqlamaScreen> createState() => _YoqlamaScreenState();
}

class _YoqlamaScreenState extends ConsumerState<YoqlamaScreen> {
  AttendanceSummary? _summary;
  bool _loading = true;
  bool _checkingIn = false;
  String? _error;
  CheckinResult? _lastResult;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final summary = await ref.read(attendanceApiProvider).fetchSummary();
      setState(() {
        _summary = summary;
        _loading = false;
      });
    } catch (error) {
      setState(() {
        _error = error is ApiException ? error.message : "Yo'qlama holatini yuklab bo'lmadi";
        _loading = false;
      });
    }
  }

  Future<void> _checkin() async {
    setState(() {
      _checkingIn = true;
      _error = null;
      _lastResult = null;
    });
    try {
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.denied || permission == LocationPermission.deniedForever) {
        setState(() {
          _error = "Joylashuvga ruxsat berilmadi. Sozlamalardan ruxsat bering.";
          _checkingIn = false;
        });
        return;
      }
      if (!await Geolocator.isLocationServiceEnabled()) {
        setState(() {
          _error = "Qurilmada joylashuv (GPS) o'chirilgan.";
          _checkingIn = false;
        });
        return;
      }

      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(accuracy: LocationAccuracy.high),
      );
      final result = await ref.read(attendanceApiProvider).checkin(
            lat: position.latitude,
            lng: position.longitude,
            accuracy: position.accuracy,
          );
      setState(() {
        _lastResult = result;
        _checkingIn = false;
      });
      await _load();
    } catch (error) {
      setState(() {
        _error = error is ApiException ? error.message : "Tasdiqlashda xatolik yuz berdi";
        _checkingIn = false;
      });
    }
  }

  String _resultMessage(CheckinResult result) {
    switch (result.status) {
      case 'present':
        return "✅ Tasdiqlandi — siz yotoqxonadasiz";
      case 'outside':
        return "⚠️ Joylashuvingiz yotoqxonadan uzoqda (${result.distanceM?.round() ?? '?'} m)";
      case 'already':
        return "Siz allaqachon belgilangansiz";
      case 'retry':
        return "GPS aniqligi yetarli emas — qayta urinib ko'ring";
      case 'unavailable':
        return "Yotoqxona joylashuvi sozlanmagan";
      case 'no_session':
        return "Hozir ochiq yo'qlama sessiyasi yo'q";
      default:
        return result.status;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Yo\'qlama')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            _summary?.hasOpen == true ? "Bugungi yo'qlama ochiq" : "Hozir ochiq yo'qlama yo'q",
                            style: Theme.of(context).textTheme.titleMedium,
                          ),
                          if (_summary?.hasOpen == true && _summary?.closesAt != null)
                            Padding(
                              padding: const EdgeInsets.only(top: 4),
                              child: Text('Yopilish vaqti: ${_summary!.closesAt}'),
                            ),
                          if (_summary?.hasOpen == true && _summary?.total != null)
                            Padding(
                              padding: const EdgeInsets.only(top: 8),
                              child: Wrap(
                                spacing: 8,
                                children: [
                                  Chip(label: Text('Bor: ${_summary!.present ?? 0}')),
                                  Chip(label: Text("Yo'q: ${_summary!.absent ?? 0}")),
                                  Chip(label: Text('Belgilanmagan: ${_summary!.unmarked ?? 0}')),
                                ],
                              ),
                            ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 24),
                  FilledButton.icon(
                    onPressed: (_summary?.hasOpen == true && !_checkingIn) ? _checkin : null,
                    icon: _checkingIn
                        ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2))
                        : const Icon(Icons.location_on),
                    label: const Text("Men yotoqxonadaman"),
                  ),
                  if (_lastResult != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 16),
                      child: Text(_resultMessage(_lastResult!), textAlign: TextAlign.center),
                    ),
                  if (_error != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 16),
                      child: Text(_error!, style: const TextStyle(color: Colors.red), textAlign: TextAlign.center),
                    ),
                ],
              ),
            ),
    );
  }
}
