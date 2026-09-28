import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/auth_controller.dart';
import '../../shared/widgets/app_bottom_nav.dart';

/// M1 placeholder landing screen. The web dashboard aggregates ~10 cards
/// (room info, roommates, payments, applications, announcements, stories,
/// discipline rating, AI/admin chat, sardor/council panels) — per the plan,
/// v1 ships a reduced subset here incrementally; the quick-link cards below
/// point at the M2 screens (arizalar, tolova, navbat, profil) that are now
/// built, while richer dashboard cards remain a later milestone.
class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Bosh sahifa'),
        actions: [
          IconButton(
            tooltip: 'Chiqish',
            icon: const Icon(Icons.logout),
            onPressed: () => ref.read(authControllerProvider.notifier).signOut(),
          ),
        ],
      ),
      bottomNavigationBar: const AppBottomNav(currentPath: '/dashboard'),
      body: GridView.count(
        padding: const EdgeInsets.all(16),
        crossAxisCount: 2,
        mainAxisSpacing: 12,
        crossAxisSpacing: 12,
        children: [
          _QuickLinkCard(
            icon: Icons.description_outlined,
            label: 'Arizalar',
            onTap: () => context.go('/arizalar'),
          ),
          _QuickLinkCard(
            icon: Icons.payments_outlined,
            label: "To'lovlar",
            onTap: () => context.go('/tolova'),
          ),
          _QuickLinkCard(
            icon: Icons.groups_outlined,
            label: 'Navbatchilik',
            onTap: () => context.go('/navbat'),
          ),
          _QuickLinkCard(
            icon: Icons.person_outline,
            label: 'Profil',
            onTap: () => context.go('/profil'),
          ),
          _QuickLinkCard(
            icon: Icons.location_on_outlined,
            label: "Yo'qlama",
            onTap: () => context.push('/yoqlama'),
          ),
          _QuickLinkCard(
            icon: Icons.folder_shared_outlined,
            label: 'Hujjatlarim',
            onTap: () => context.push('/hujjatlarim'),
          ),
        ],
      ),
    );
  }
}

class _QuickLinkCard extends StatelessWidget {
  const _QuickLinkCard({required this.icon, required this.label, required this.onTap});

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: InkWell(
        onTap: onTap,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 36, color: Theme.of(context).colorScheme.primary),
            const SizedBox(height: 8),
            Text(label),
          ],
        ),
      ),
    );
  }
}
