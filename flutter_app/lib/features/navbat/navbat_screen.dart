import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_exception.dart';
import '../../shared/widgets/app_bottom_nav.dart';
import 'navbat_api.dart';

class NavbatScreen extends ConsumerStatefulWidget {
  const NavbatScreen({super.key});

  @override
  ConsumerState<NavbatScreen> createState() => _NavbatScreenState();
}

class _NavbatScreenState extends ConsumerState<NavbatScreen> {
  DutyScheduleData? _duty;
  Map<String, dynamic> _cleaning = {};
  String? _cleaningNote;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
      _cleaningNote = null;
    });
    try {
      final api = ref.read(navbatApiProvider);
      final duty = await api.fetchDutySchedule();
      Map<String, dynamic> cleaning = {};
      String? note;

      try {
        final cleaningData = await api.fetchCleaningSchedule();
        cleaning = Map<String, dynamic>.from(cleaningData['schedule'] as Map? ?? {});
      } catch (error) {
        if (error is ApiException && (error.statusCode == 409 || error.statusCode == 403)) {
          note = error.message;
        }
      }

      setState(() {
        _duty = duty;
        _cleaning = cleaning;
        _cleaningNote = note;
        _loading = false;
      });
    } catch (error) {
      setState(() {
        _error = error is ApiException ? error.message : "Navbatchilik ma'lumotlarini yuklab bo'lmadi";
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Navbatchilik')),
      bottomNavigationBar: const AppBottomNav(currentPath: '/navbat'),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Text(_error!))
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      Text("Qavat sardorlari", style: Theme.of(context).textTheme.titleMedium),
                      const SizedBox(height: 8),
                      if (_duty!.floorCaptains.isEmpty)
                        const Padding(
                          padding: EdgeInsets.symmetric(vertical: 8),
                          child: Text("Ma'lumot yo'q", style: TextStyle(color: Colors.grey)),
                        )
                      else
                        for (final captain in _duty!.floorCaptains)
                          Card(
                            child: ListTile(
                              leading: const Icon(Icons.badge_outlined),
                              title: Text(captain.fullName),
                              subtitle: Text([
                                if (captain.roomNumber != null) 'Xona ${captain.roomNumber}',
                                if (captain.phoneNumber != null) captain.phoneNumber!,
                              ].join(' · ')),
                            ),
                          ),
                      const SizedBox(height: 24),
                      Text('Xona tozalash jadvali', style: Theme.of(context).textTheme.titleMedium),
                      const SizedBox(height: 8),
                      if (_cleaningNote != null)
                        Card(
                          color: Theme.of(context).colorScheme.surfaceContainerHighest,
                          child: Padding(
                            padding: const EdgeInsets.all(16),
                            child: Row(
                              children: [
                                const Icon(Icons.info_outline, color: Colors.amber),
                                const SizedBox(width: 12),
                                Expanded(child: Text(_cleaningNote!)),
                              ],
                            ),
                          ),
                        )
                      else if (_cleaning.isEmpty)
                        const Padding(
                          padding: EdgeInsets.symmetric(vertical: 8),
                          child: Text("Jadval hali belgilanmagan", style: TextStyle(color: Colors.grey)),
                        )
                      else
                        Card(
                          child: Column(
                            children: [
                              for (final entry in _cleaning.entries)
                                ListTile(
                                  title: Text(entry.key),
                                  trailing: Text(
                                    entry.value is Map ? (entry.value['name'] as String? ?? '—') : '—',
                                    style: const TextStyle(fontWeight: FontWeight.w600),
                                  ),
                                ),
                            ],
                          ),
                        ),
                    ],
                  ),
                ),
    );
  }
}
