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
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    if (!mounted) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final api = ref.read(navbatApiProvider);
      final results = await Future.wait([
        api.fetchDutySchedule(),
        api.fetchCleaningSchedule(),
      ]);
      if (!mounted) return;
      setState(() {
        _duty = results[0] as DutyScheduleData;
        _cleaning = Map<String, dynamic>.from(
          (results[1] as Map<String, dynamic>)['schedule'] as Map? ?? {},
        );
        _loading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error is ApiException
            ? error.message
            : "Navbatchilik ma'lumotlarini yuklab bo'lmadi";
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final schedule = _duty?.schedule ?? const <String, dynamic>{};
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
                  _SectionLabel('QAVAT MA‘MURLARI'),
                  if (_duty!.admins.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    Card(
                      child: Column(
                        children: [
                          for (final admin in _duty!.admins.take(2))
                            ListTile(
                              leading: CircleAvatar(
                                backgroundColor: Theme.of(context)
                                    .colorScheme
                                    .primaryContainer,
                                child: Icon(
                                  Icons.admin_panel_settings_rounded,
                                  color: Theme.of(context).colorScheme.primary,
                                ),
                              ),
                              title: Text(admin.name),
                              subtitle: Text(
                                admin.room == null
                                    ? 'Navbatchilik admini'
                                    : 'Xona ${admin.room}',
                              ),
                            ),
                        ],
                      ),
                    ),
                  ],
                  const SizedBox(height: 20),
                  _SectionLabel('QAVAT SARDORLARI'),
                  const SizedBox(height: 8),
                  if (_duty!.floorCaptains.isEmpty)
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 8),
                      child: Text(
                        "Ma'lumot yo'q",
                        style: TextStyle(color: Colors.grey),
                      ),
                    )
                  else
                    for (final captain in _duty!.floorCaptains)
                      Card(
                        child: ListTile(
                          leading: const Icon(Icons.badge_outlined),
                          title: Text(captain.fullName),
                          subtitle: Text(
                            [
                              if (captain.roomNumber != null)
                                'Xona ${captain.roomNumber}',
                              if (captain.phoneNumber != null)
                                captain.phoneNumber!,
                            ].join(' · '),
                          ),
                        ),
                      ),
                  const SizedBox(height: 24),
                  _SectionLabel('HAFTALIK NAVBATCHILAR JADVALI'),
                  const SizedBox(height: 8),
                  if (schedule.isEmpty)
                    const Card(
                      child: Padding(
                        padding: EdgeInsets.all(16),
                        child: Text('Haftalik jadval hali belgilanmagan.'),
                      ),
                    )
                  else
                    for (final entry in schedule.entries)
                      Card(
                        margin: const EdgeInsets.only(bottom: 8),
                        child: ListTile(
                          leading: CircleAvatar(
                            backgroundColor: Theme.of(context)
                                .colorScheme
                                .secondaryContainer,
                            child: Icon(
                              Icons.calendar_month_rounded,
                              color: Theme.of(context).colorScheme.secondary,
                            ),
                          ),
                          title: Text(entry.key),
                          subtitle: Text(_dutyNames(entry.value)),
                        ),
                      ),
                  const SizedBox(height: 16),
                  _SectionLabel('TOZALASH JADVALI'),
                  const SizedBox(height: 8),
                  if (_cleaning.isEmpty)
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 8),
                      child: Text(
                        "Jadval hali belgilanmagan",
                        style: TextStyle(color: Colors.grey),
                      ),
                    )
                  else
                    Card(
                      child: Column(
                        children: [
                          for (final entry in _cleaning.entries)
                            ListTile(
                              title: Text(entry.key),
                              trailing: Text(
                                entry.value is Map
                                    ? (entry.value['name'] as String? ?? '—')
                                    : '—',
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

class _SectionLabel extends StatelessWidget {
  const _SectionLabel(this.label);
  final String label;

  @override
  Widget build(BuildContext context) =>
      Text(label, style: Theme.of(context).textTheme.labelSmall);
}

String _dutyNames(dynamic value) {
  if (value is List) {
    return value
        .map((item) {
          if (item is Map) {
            return (item['name'] ?? item['full_name'] ?? 'Navbatchi')
                .toString();
          }
          return item.toString();
        })
        .join(' • ');
  }
  if (value is Map) {
    return (value['name'] ?? value['full_name'] ?? 'Navbatchi').toString();
  }
  return value?.toString() ?? 'Navbatchi belgilanmagan';
}
