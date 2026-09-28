import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

const _tabs = [
  ('/dashboard', Icons.home_outlined, Icons.home, 'Bosh sahifa'),
  ('/arizalar', Icons.description_outlined, Icons.description, 'Arizalar'),
  ('/tolova', Icons.payments_outlined, Icons.payments, "To'lov"),
  ('/navbat', Icons.groups_outlined, Icons.groups, 'Navbat'),
  ('/profil', Icons.person_outline, Icons.person, 'Profil'),
];

class AppBottomNav extends StatelessWidget {
  const AppBottomNav({super.key, required this.currentPath});

  final String currentPath;

  @override
  Widget build(BuildContext context) {
    final index = _tabs.indexWhere((t) => t.$1 == currentPath).clamp(0, _tabs.length - 1);
    return NavigationBar(
      selectedIndex: index,
      onDestinationSelected: (i) {
        if (_tabs[i].$1 != currentPath) context.go(_tabs[i].$1);
      },
      destinations: [
        for (final tab in _tabs)
          NavigationDestination(icon: Icon(tab.$2), selectedIcon: Icon(tab.$3), label: tab.$4),
      ],
    );
  }
}
