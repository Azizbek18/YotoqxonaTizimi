import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/auth_controller.dart';
import '../../shared/widgets/app_bottom_nav.dart';
import '../profile/profile_api.dart';
import '../profile/profile_models.dart';
import '../yoqlama/attendance_api.dart';

class DashboardScreen extends ConsumerStatefulWidget {
  const DashboardScreen({super.key});

  @override
  ConsumerState<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends ConsumerState<DashboardScreen> {
  StudentProfilePayload? _profilePayload;
  AttendanceSummary? _attendanceSummary;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final results = await Future.wait([
        ref.read(profileApiProvider).fetchProfile().catchError((_) => null as dynamic),
        ref.read(attendanceApiProvider).fetchSummary().catchError((_) => null as dynamic),
      ]);
      if (mounted) {
        setState(() {
          _profilePayload = results[0] as StudentProfilePayload?;
          _attendanceSummary = results[1] as AttendanceSummary?;
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final profile = _profilePayload?.profile;
    final roommates = _profilePayload?.roommates ?? [];
    final hasOpenAttendance = _attendanceSummary?.hasOpen ?? false;

    return Scaffold(
      appBar: AppBar(
        title: const Text('MTalaba'),
        actions: [
          IconButton(
            tooltip: 'Chiqish',
            icon: const Icon(Icons.logout),
            onPressed: () => ref.read(authControllerProvider.notifier).signOut(),
          ),
        ],
      ),
      bottomNavigationBar: const AppBottomNav(currentPath: '/dashboard'),
      body: _loading && _profilePayload == null
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // Welcome Header
            Card(
              elevation: 0,
              color: theme.colorScheme.primaryContainer.withValues(alpha: 0.4),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        CircleAvatar(
                          radius: 24,
                          backgroundColor: theme.colorScheme.primary,
                          backgroundImage: profile?.avatarUrl != null ? NetworkImage(profile!.avatarUrl!) : null,
                          child: profile?.avatarUrl == null
                              ? const Icon(Icons.person, color: Colors.white, size: 28)
                              : null,
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                profile?.fullName.isNotEmpty == true ? profile!.fullName : 'Talaba',
                                style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                [
                                  if (profile?.faculty != null) profile!.faculty!,
                                  if (profile?.roomNumber != null) 'Xona: ${profile!.roomNumber}',
                                ].join(' · '),
                                style: theme.textTheme.bodySmall?.copyWith(color: Colors.grey.shade700),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 12),

            // Attendance Banner (if active/open)
            if (hasOpenAttendance)
              Card(
                color: Colors.amber.shade50,
                shape: RoundedRectangleBorder(
                  side: BorderSide(color: Colors.amber.shade400, width: 1.5),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Row(
                    children: [
                      const Icon(Icons.alarm_on, color: Colors.amber, size: 36),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              "Yo'qlama davri ochiq!",
                              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: Colors.black87),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              "Yotoqxonada ekanligingizni tasdiqlang",
                              style: TextStyle(fontSize: 12, color: Colors.grey.shade800),
                            ),
                          ],
                        ),
                      ),
                      FilledButton.tonal(
                        onPressed: () => context.push('/yoqlama'),
                        child: const Text('Tasdiqlash'),
                      ),
                    ],
                  ),
                ),
              ),
            if (hasOpenAttendance) const SizedBox(height: 12),

            // Room & Roommates Card
            if (profile?.roomNumber != null)
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Icon(Icons.meeting_room_outlined, color: theme.colorScheme.primary),
                          const SizedBox(width: 8),
                          Text(
                            "Xona ${profile!.roomNumber}",
                            style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.bold),
                          ),
                          const Spacer(),
                          Text(
                            "${roommates.length + 1} kishi",
                            style: TextStyle(color: Colors.grey.shade600, fontSize: 12),
                          ),
                        ],
                      ),
                      if (roommates.isNotEmpty) ...[
                        const Divider(height: 16),
                        Text("Xonadoshlar:", style: theme.textTheme.bodySmall?.copyWith(color: Colors.grey.shade700)),
                        const SizedBox(height: 6),
                        Wrap(
                          spacing: 8,
                          runSpacing: 4,
                          children: [
                            for (final roommate in roommates)
                              Chip(
                                avatar: const Icon(Icons.person, size: 16),
                                label: Text(roommate.fullName, style: const TextStyle(fontSize: 12)),
                                padding: EdgeInsets.zero,
                              ),
                          ],
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            if (profile?.roomNumber != null) const SizedBox(height: 12),

            // Quick Links Grid
            Text("Xizmatlar", style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            GridView.count(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              crossAxisCount: 2,
              mainAxisSpacing: 10,
              crossAxisSpacing: 10,
              childAspectRatio: 1.25,
              children: [
                _ServiceCard(
                  icon: Icons.description_outlined,
                  color: Colors.indigo,
                  label: 'Arizalar',
                  description: 'Ariza va murojaatlar',
                  onTap: () => context.go('/arizalar'),
                ),
                _ServiceCard(
                  icon: Icons.payments_outlined,
                  color: Colors.teal,
                  label: "To'lovlar",
                  description: 'Cheklar va tarix',
                  onTap: () => context.go('/tolova'),
                ),
                _ServiceCard(
                  icon: Icons.groups_outlined,
                  color: Colors.deepPurple,
                  label: 'Navbatchilik',
                  description: 'Xona jadvali & sardorlar',
                  onTap: () => context.go('/navbat'),
                ),
                _ServiceCard(
                  icon: Icons.location_on_outlined,
                  color: Colors.green,
                  label: "Yo'qlama",
                  description: 'GPS tekshiruvi',
                  onTap: () => context.push('/yoqlama'),
                ),
                _ServiceCard(
                  icon: Icons.folder_shared_outlined,
                  color: Colors.blueGrey,
                  label: 'Hujjatlarim',
                  description: 'Viza va propiska',
                  onTap: () => context.push('/hujjatlarim'),
                ),
                _ServiceCard(
                  icon: Icons.person_outline,
                  color: Colors.blue,
                  label: 'Profil',
                  description: 'Shaxsiy maʼlumotlar',
                  onTap: () => context.go('/profil'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _ServiceCard extends StatelessWidget {
  const _ServiceCard({
    required this.icon,
    required this.color,
    required this.label,
    required this.description,
    required this.onTap,
  });

  final IconData icon;
  final Color color;
  final String label;
  final String description;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              CircleAvatar(
                radius: 18,
                backgroundColor: color.withValues(alpha: 0.15),
                child: Icon(icon, size: 20, color: color),
              ),
              const SizedBox(height: 8),
              Text(
                label,
                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 2),
              Text(
                description,
                style: TextStyle(color: Colors.grey.shade600, fontSize: 11),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
