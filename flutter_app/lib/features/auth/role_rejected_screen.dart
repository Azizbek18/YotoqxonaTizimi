import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth/auth_controller.dart';
import '../../core/auth/auth_state.dart';

const _staffRoles = {'dekan', 'tarbiyachi', 'admin', 'sardor', 'kengash'};

String _messageFor(String reason) {
  if (_staffRoles.contains(reason)) {
    return 'Bu ilova faqat talabalar uchun. Xodim sifatida tizimga kirish uchun veb-saytdan foydalaning: meningyotoqxonam.uz';
  }
  switch (reason) {
    case 'email_not_verified':
      return 'Email manzilingiz hali tasdiqlanmagan. Pochtangizni tekshiring.';
    case 'awaiting_dean_approval':
      return 'Hisobingiz hali dekanat tomonidan tasdiqlanmagan.';
    case 'invalid_credentials':
      return "Email yoki parol noto'g'ri.";
    case 'no_role':
      return "Hisobingiz uchun rol aniqlanmadi. Dekanatga murojaat qiling.";
    default:
      return "Tizimga kirib bo'lmadi. Qaytadan urinib ko'ring.";
  }
}

class RoleRejectedScreen extends ConsumerWidget {
  const RoleRejectedScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authControllerProvider);
    final reason = auth is AuthRoleRejected ? auth.reason : 'no_role';

    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.lock_outline, size: 56, color: Colors.grey),
              const SizedBox(height: 16),
              Text(
                _messageFor(reason),
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodyLarge,
              ),
              const SizedBox(height: 24),
              FilledButton(
                onPressed: () => ref.read(authControllerProvider.notifier).resetToLogin(),
                child: const Text('Kirish sahifasiga qaytish'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
