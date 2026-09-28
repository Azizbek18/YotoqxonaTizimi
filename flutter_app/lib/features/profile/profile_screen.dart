import 'dart:io';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../../core/api/api_exception.dart';
import '../../core/auth/auth_controller.dart';
import '../../shared/widgets/app_bottom_nav.dart';
import 'profile_api.dart';
import 'profile_models.dart';

class ProfileScreen extends ConsumerStatefulWidget {
  const ProfileScreen({super.key});

  @override
  ConsumerState<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends ConsumerState<ProfileScreen> {
  StudentProfilePayload? _payload;
  List<DeviceSession> _sessions = [];
  bool _loading = true;
  String? _error;
  bool _busy = false;
  final _groupController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _groupController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final api = ref.read(profileApiProvider);
      final results = await Future.wait([api.fetchProfile(), api.fetchSessions()]);
      final payload = results[0] as StudentProfilePayload;
      setState(() {
        _payload = payload;
        _sessions = results[1] as List<DeviceSession>;
        _groupController.text = payload.profile.group ?? '';
        _loading = false;
      });
    } catch (error) {
      setState(() {
        _error = error is ApiException ? error.message : "Profilni yuklab bo'lmadi";
        _loading = false;
      });
    }
  }

  Future<void> _saveGroup() async {
    setState(() => _busy = true);
    try {
      await ref.read(profileApiProvider).updateGroup(_groupController.text.trim());
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text("Guruh yangilandi")));
      }
      await _load();
    } catch (error) {
      if (mounted) {
        final message = error is ApiException ? error.message : 'Xatolik yuz berdi';
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _pickAvatar() async {
    final picked = await ImagePicker().pickImage(source: ImageSource.gallery, maxWidth: 1024, imageQuality: 85);
    if (picked == null) return;
    setState(() => _busy = true);
    try {
      await ref.read(profileApiProvider).uploadAvatar(File(picked.path));
      await _load();
    } catch (error) {
      if (mounted) {
        final message = error is ApiException ? error.message : 'Rasmni yuklab bo\'lmadi';
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _revokeSession(String id) async {
    try {
      await ref.read(profileApiProvider).revokeSession(id);
      await _load();
    } catch (error) {
      if (mounted) {
        final message = error is ApiException ? error.message : 'Xatolik yuz berdi';
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Profil'),
        actions: [
          IconButton(
            tooltip: 'Chiqish',
            icon: const Icon(Icons.logout),
            onPressed: () => ref.read(authControllerProvider.notifier).signOut(),
          ),
        ],
      ),
      bottomNavigationBar: const AppBottomNav(currentPath: '/profil'),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? _ErrorView(message: _error!, onRetry: _load)
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      _buildHeader(),
                      const SizedBox(height: 24),
                      _buildGroupEditor(),
                      const SizedBox(height: 24),
                      _buildInfo(),
                      const SizedBox(height: 24),
                      _buildSessions(),
                    ],
                  ),
                ),
    );
  }

  Widget _buildHeader() {
    final profile = _payload!.profile;
    return Column(
      children: [
        Stack(
          children: [
            CircleAvatar(
              radius: 48,
              backgroundImage: profile.avatarUrl != null ? CachedNetworkImageProvider(profile.avatarUrl!) : null,
              child: profile.avatarUrl == null ? const Icon(Icons.person, size: 48) : null,
            ),
            Positioned(
              right: 0,
              bottom: 0,
              child: InkWell(
                onTap: _busy ? null : _pickAvatar,
                child: CircleAvatar(
                  radius: 16,
                  child: _busy
                      ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2))
                      : const Icon(Icons.camera_alt, size: 16),
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Text(profile.fullName, style: Theme.of(context).textTheme.titleLarge, textAlign: TextAlign.center),
        if (profile.faculty != null) Text(profile.faculty!, style: Theme.of(context).textTheme.bodyMedium),
        if (profile.warningCount > 0)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Chip(
              label: Text("${profile.warningCount} ta ogohlantirish"),
              backgroundColor: Colors.orange.shade100,
            ),
          ),
      ],
    );
  }

  Widget _buildGroupEditor() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            Expanded(
              child: TextField(
                controller: _groupController,
                decoration: const InputDecoration(labelText: 'Guruh', border: OutlineInputBorder()),
              ),
            ),
            const SizedBox(width: 8),
            FilledButton(onPressed: _busy ? null : _saveGroup, child: const Text('Saqlash')),
          ],
        ),
      ),
    );
  }

  Widget _buildInfo() {
    final p = _payload!.profile;
    final rows = <(String, String?)>[
      ('Email', p.email),
      ('Telefon', p.phoneNumber),
      ('Xona', p.roomNumber),
      ('Kurs', p.course?.toString()),
      ("Yo'nalish", p.direction),
    ];
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            for (final (label, value) in rows)
              if (value != null && value.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(label, style: const TextStyle(color: Colors.grey)),
                      Text(value),
                    ],
                  ),
                ),
          ],
        ),
      ),
    );
  }

  Widget _buildSessions() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Ulangan qurilmalar', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            for (final session in _sessions)
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.devices_other),
                title: Text('${session.browser} · ${session.os}'),
                subtitle: Text(session.current ? 'Joriy qurilma' : session.lastActiveAt),
                trailing: session.current
                    ? null
                    : IconButton(
                        icon: const Icon(Icons.close),
                        onPressed: () => _revokeSession(session.id),
                      ),
              ),
          ],
        ),
      ),
    );
  }
}

class _ErrorView extends StatelessWidget {
  const _ErrorView({required this.message, required this.onRetry});
  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(message, textAlign: TextAlign.center),
            const SizedBox(height: 12),
            FilledButton(onPressed: onRetry, child: const Text("Qayta urinish")),
          ],
        ),
      ),
    );
  }
}
