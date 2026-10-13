import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth/auth_controller.dart';
import '../../core/auth/auth_state.dart';
import '../../core/theme/app_colors.dart';
import '../../shared/widgets/app_button.dart';

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
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 84,
                height: 84,
                decoration: BoxDecoration(
                  color: isDark ? AppColors.dangerTop.withValues(alpha: 0.12) : const Color(0xFFFFF1F2),
                  shape: BoxShape.circle,
                ),
                child: Icon(Icons.lock_outline_rounded, size: 38, color: AppColors.dangerBottom),
              ),
              const SizedBox(height: 24),
              Text(
                _messageFor(reason),
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontSize: 14.5, height: 1.5),
              ),
              const SizedBox(height: 28),
              AppButton(
                label: 'KIRISH SAHIFASIGA QAYTISH',
                icon: Icons.arrow_back_rounded,
                expand: false,
                onPressed: () => ref.read(authControllerProvider.notifier).resetToLogin(),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
