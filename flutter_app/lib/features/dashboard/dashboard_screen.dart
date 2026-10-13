import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/auth_controller.dart';
import '../../core/theme/app_colors.dart';
import '../../shared/widgets/app_bottom_nav.dart';

/// M1 placeholder landing screen. The web dashboard aggregates ~10 cards
/// (room info, roommates, payments, applications, announcements, stories,
/// discipline rating, AI/admin chat, sardor/council panels) — per the plan,
/// v1 ships a reduced subset here incrementally; the quick-link cards below
/// point at the M2 screens (arizalar, tolova, navbat, profil) that are now
/// built, while richer dashboard cards remain a later milestone.
class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  static const _links = [
    (Icons.description_rounded, 'Arizalar', AppColors.indigoBottom, '/arizalar', false),
    (Icons.credit_card_rounded, "To'lovlar", AppColors.emerald, '/tolova', false),
    (Icons.groups_rounded, 'Navbatchilik', AppColors.amber, '/navbat', false),
    (Icons.person_rounded, 'Profil', AppColors.blue, '/profil', false),
    (Icons.location_on_rounded, "Yo'qlama", AppColors.rose, '/yoqlama', true),
    (Icons.folder_shared_rounded, 'Hujjatlarim', Color(0xFF8B5CF6), '/hujjatlarim', true),
  ];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: CustomScrollView(
          slivers: [
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 20, 20, 8),
                child: Row(
                  children: [
                    Container(
                      width: 48,
                      height: 48,
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                          colors: [AppColors.indigoTop, AppColors.indigoBottom],
                        ),
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: const Icon(Icons.apartment_rounded, color: Colors.white, size: 24),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Xush kelibsiz 👋', style: Theme.of(context).textTheme.titleLarge),
                          Text('MTalaba', style: Theme.of(context).textTheme.labelSmall),
                        ],
                      ),
                    ),
                    IconButton(
                      tooltip: 'Chiqish',
                      onPressed: () => ref.read(authControllerProvider.notifier).signOut(),
                      style: IconButton.styleFrom(
                        backgroundColor: isDark ? Colors.white.withValues(alpha: 0.05) : const Color(0xFFF1F5F9),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      icon: const Icon(Icons.logout_rounded, size: 20),
                    ),
                  ],
                ),
              ),
            ),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 10, 20, 4),
                child: Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [AppColors.indigoBottom, Color(0xFF312E81)],
                    ),
                    borderRadius: BorderRadius.circular(24),
                    boxShadow: [
                      BoxShadow(
                        color: AppColors.indigoBottom.withValues(alpha: 0.22),
                        blurRadius: 24,
                        offset: const Offset(0, 10),
                      ),
                    ],
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Talaba markazi', style: Theme.of(context).textTheme.labelSmall?.copyWith(color: Colors.white70)),
                            const SizedBox(height: 6),
                            const Text('Kerakli xizmatlar bir joyda', style: TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w900)),
                            const SizedBox(height: 6),
                            const Text('Ariza, to‘lov va yotoqxona ma’lumotlarini boshqaring.', style: TextStyle(color: Colors.white70, height: 1.35)),
                          ],
                        ),
                      ),
                      const SizedBox(width: 12),
                      Container(
                        width: 58,
                        height: 58,
                        decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.14), shape: BoxShape.circle),
                        child: const Icon(Icons.auto_awesome_rounded, color: Colors.white, size: 28),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 22, 20, 0),
                child: Text('XIZMATLAR', style: Theme.of(context).textTheme.labelSmall),
              ),
            ),
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 100),
              sliver: SliverGrid(
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 2,
                  mainAxisSpacing: 12,
                  crossAxisSpacing: 12,
                  childAspectRatio: 1.25,
                ),
                delegate: SliverChildBuilderDelegate(
                  (context, i) {
                    final (icon, label, accent, route, push) = _links[i];
                    return _QuickLinkCard(
                      icon: icon,
                      label: label,
                      accent: accent,
                      onTap: () => push ? context.push(route) : context.go(route),
                    );
                  },
                  childCount: _links.length,
                ),
              ),
            ),
          ],
        ),
      ),
      bottomNavigationBar: const AppBottomNav(currentPath: '/dashboard'),
    );
  }
}

class _QuickLinkCard extends StatelessWidget {
  const _QuickLinkCard({required this.icon, required this.label, required this.accent, required this.onTap});

  final IconData icon;
  final String label;
  final Color accent;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(18),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: accent.withValues(alpha: 0.14),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(icon, color: accent, size: 22),
              ),
              Text(
                label,
                style: Theme.of(context).textTheme.titleMedium?.copyWith(fontSize: 13.5),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
