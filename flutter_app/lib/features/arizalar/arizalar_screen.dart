import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_exception.dart';
import '../../shared/widgets/app_bottom_nav.dart';
import 'application_api.dart';
import 'application_models.dart';

class ArizalarScreen extends ConsumerStatefulWidget {
  const ArizalarScreen({super.key});

  @override
  ConsumerState<ArizalarScreen> createState() => _ArizalarScreenState();
}

class _ArizalarScreenState extends ConsumerState<ArizalarScreen> {
  List<StudentApplication> _applications = [];
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
    });
    try {
      final applications = await ref.read(applicationApiProvider).fetchApplications();
      applications.sort((a, b) => b.createdAt.compareTo(a.createdAt));
      setState(() {
        _applications = applications;
        _loading = false;
      });
    } catch (error) {
      setState(() {
        _error = error is ApiException ? error.message : "Arizalarni yuklab bo'lmadi";
        _loading = false;
      });
    }
  }

  Future<void> _openCreateDialog() async {
    final created = await showDialog<bool>(
      context: context,
      builder: (_) => _CreateApplicationDialog(api: ref.read(applicationApiProvider)),
    );
    if (created == true) _load();
  }

  Future<void> _openDetail(StudentApplication application) async {
    final changed = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _ApplicationDetailSheet(application: application, api: ref.read(applicationApiProvider)),
    );
    if (changed == true) _load();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Arizalar')),
      bottomNavigationBar: const AppBottomNav(currentPath: '/arizalar'),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _openCreateDialog,
        icon: const Icon(Icons.add),
        label: const Text('Yangi ariza'),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Text(_error!))
              : RefreshIndicator(
                  onRefresh: _load,
                  child: _applications.isEmpty
                      ? ListView(children: const [
                          Padding(
                            padding: EdgeInsets.all(32),
                            child: Center(child: Text('Hali arizalar yo\'q')),
                          ),
                        ])
                      : ListView.builder(
                          padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
                          itemCount: _applications.length,
                          itemBuilder: (context, index) {
                            final application = _applications[index];
                            return Card(
                              child: ListTile(
                                title: Text(application.title ?? applicationTypeLabels[application.type] ?? 'Ariza'),
                                subtitle: Text(application.text, maxLines: 2, overflow: TextOverflow.ellipsis),
                                trailing: Chip(label: Text(applicationStatusLabel(application.status))),
                                onTap: () => _openDetail(application),
                              ),
                            );
                          },
                        ),
                ),
    );
  }
}

class _CreateApplicationDialog extends StatefulWidget {
  const _CreateApplicationDialog({required this.api});
  final ApplicationApi api;

  @override
  State<_CreateApplicationDialog> createState() => _CreateApplicationDialogState();
}

class _CreateApplicationDialogState extends State<_CreateApplicationDialog> {
  final _titleController = TextEditingController();
  final _textController = TextEditingController();
  String _type = 'ariza';
  bool _submitting = false;
  String? _error;

  Future<void> _submit() async {
    if (_titleController.text.trim().isEmpty || _textController.text.trim().isEmpty) {
      setState(() => _error = "Sarlavha va matnni to'ldiring");
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      await widget.api.createApplication(
        title: _titleController.text.trim(),
        type: _type,
        reason: _type,
        text: _textController.text.trim(),
      );
      if (mounted) Navigator.of(context).pop(true);
    } catch (error) {
      setState(() => _error = error is ApiException ? error.message : 'Xatolik yuz berdi');
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Yangi ariza'),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            DropdownButtonFormField<String>(
              initialValue: _type,
              decoration: const InputDecoration(labelText: 'Turi'),
              items: applicationTypeLabels.entries
                  .map((e) => DropdownMenuItem(value: e.key, child: Text(e.value)))
                  .toList(),
              onChanged: (value) => setState(() => _type = value ?? 'ariza'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _titleController,
              decoration: const InputDecoration(labelText: 'Sarlavha', border: OutlineInputBorder()),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _textController,
              maxLines: 5,
              decoration: const InputDecoration(labelText: 'Matn', border: OutlineInputBorder()),
            ),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text(_error!, style: const TextStyle(color: Colors.red)),
              ),
          ],
        ),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.of(context).pop(false), child: const Text('Bekor qilish')),
        FilledButton(
          onPressed: _submitting ? null : _submit,
          child: _submitting
              ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2))
              : const Text('Saqlash'),
        ),
      ],
    );
  }
}

class _ApplicationDetailSheet extends StatefulWidget {
  const _ApplicationDetailSheet({required this.application, required this.api});
  final StudentApplication application;
  final ApplicationApi api;

  @override
  State<_ApplicationDetailSheet> createState() => _ApplicationDetailSheetState();
}

class _ApplicationDetailSheetState extends State<_ApplicationDetailSheet> {
  final _nameController = TextEditingController();
  bool _busy = false;
  String? _error;

  bool get _isDraft => widget.application.status == 'draft' || widget.application.status == null;

  Future<void> _sign() async {
    if (_nameController.text.trim().isEmpty) {
      setState(() => _error = "F.I.Sh kiriting");
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await widget.api.submitApplication(widget.application.id, _nameController.text.trim());
      if (mounted) Navigator.of(context).pop(true);
    } catch (error) {
      setState(() => _error = error is ApiException ? error.message : 'Xatolik yuz berdi');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _delete() async {
    setState(() => _busy = true);
    try {
      await widget.api.deleteApplication(widget.application.id);
      if (mounted) Navigator.of(context).pop(true);
    } catch (error) {
      setState(() => _error = error is ApiException ? error.message : 'Xatolik yuz berdi');
      setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final application = widget.application;
    return Padding(
      padding: EdgeInsets.only(
        left: 16,
        right: 16,
        top: 16,
        bottom: MediaQuery.of(context).viewInsets.bottom + 16,
      ),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(application.title ?? '', style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 4),
            Chip(label: Text(applicationStatusLabel(application.status))),
            const SizedBox(height: 12),
            Text(application.text),
            if (application.adminResponse != null) ...[
              const SizedBox(height: 16),
              Text('Javob:', style: Theme.of(context).textTheme.titleSmall),
              Text(application.adminResponse!),
            ],
            if (_isDraft) ...[
              const Divider(height: 32),
              Text('Imzolash', style: Theme.of(context).textTheme.titleSmall),
              const SizedBox(height: 8),
              TextField(
                controller: _nameController,
                decoration: const InputDecoration(labelText: 'F.I.Sh', border: OutlineInputBorder()),
              ),
              if (_error != null)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Text(_error!, style: const TextStyle(color: Colors.red)),
                ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: _busy ? null : _delete,
                      child: const Text("O'chirish"),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: FilledButton(
                      onPressed: _busy ? null : _sign,
                      child: _busy
                          ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2))
                          : const Text('Imzolab yuborish'),
                    ),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}
