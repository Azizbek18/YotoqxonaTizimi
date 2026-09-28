import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/api/api_exception.dart';
import 'foreign_docs_api.dart';

class HujjatlarimScreen extends ConsumerStatefulWidget {
  const HujjatlarimScreen({super.key});

  @override
  ConsumerState<HujjatlarimScreen> createState() => _HujjatlarimScreenState();
}

class _HujjatlarimScreenState extends ConsumerState<HujjatlarimScreen> {
  List<ForeignDoc> _docs = [];
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
      final docs = await ref.read(foreignDocsApiProvider).fetchDocs();
      setState(() {
        _docs = docs;
        _loading = false;
      });
    } catch (error) {
      setState(() {
        _error = error is ApiException ? error.message : "Hujjatlarni yuklab bo'lmadi";
        _loading = false;
      });
    }
  }

  Future<void> _openEditor([ForeignDoc? existing]) async {
    final changed = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _DocEditorSheet(api: ref.read(foreignDocsApiProvider), existing: existing),
    );
    if (changed == true) _load();
  }

  Future<void> _viewFile(ForeignDoc doc) async {
    try {
      final url = await ref.read(foreignDocsApiProvider).fetchFileUrl(doc.id);
      await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
    } catch (error) {
      if (mounted) {
        final message = error is ApiException ? error.message : "Faylni ochib bo'lmadi";
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
      }
    }
  }

  Future<void> _delete(ForeignDoc doc) async {
    try {
      await ref.read(foreignDocsApiProvider).deleteDoc(doc.id);
      _load();
    } catch (error) {
      if (mounted) {
        final message = error is ApiException ? error.message : "O'chirib bo'lmadi";
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Hujjatlarim')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _openEditor(),
        icon: const Icon(Icons.add),
        label: const Text('Qo\'shish'),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Text(_error!))
              : RefreshIndicator(
                  onRefresh: _load,
                  child: _docs.isEmpty
                      ? ListView(children: const [
                          Padding(
                            padding: EdgeInsets.all(32),
                            child: Center(child: Text("Hali hujjat qo'shilmagan")),
                          ),
                        ])
                      : ListView.builder(
                          padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
                          itemCount: _docs.length,
                          itemBuilder: (context, index) {
                            final doc = _docs[index];
                            final expiringSoon = doc.daysLeft <= 15;
                            return Card(
                              child: ListTile(
                                title: Text(docTypeLabels[doc.docType] ?? doc.docType),
                                subtitle: Text(
                                  '${docStatusLabels[doc.status] ?? doc.status} · ${doc.expiresOn} gacha (${doc.daysLeft} kun)',
                                  style: expiringSoon ? const TextStyle(color: Colors.red) : null,
                                ),
                                onTap: () => _openEditor(doc),
                                trailing: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    if (doc.hasFile)
                                      IconButton(icon: const Icon(Icons.description), onPressed: () => _viewFile(doc)),
                                    IconButton(icon: const Icon(Icons.delete_outline), onPressed: () => _delete(doc)),
                                  ],
                                ),
                              ),
                            );
                          },
                        ),
                ),
    );
  }
}

class _DocEditorSheet extends StatefulWidget {
  const _DocEditorSheet({required this.api, this.existing});
  final ForeignDocsApi api;
  final ForeignDoc? existing;

  @override
  State<_DocEditorSheet> createState() => _DocEditorSheetState();
}

class _DocEditorSheetState extends State<_DocEditorSheet> {
  late String _docType = widget.existing?.docType ?? 'visa';
  final _numberController = TextEditingController();
  final _addressController = TextEditingController();
  DateTime? _expiresOn;
  File? _file;
  bool _submitting = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _numberController.text = widget.existing?.number ?? '';
    _addressController.text = widget.existing?.address ?? '';
    _expiresOn = widget.existing?.expiresOn.isNotEmpty == true ? DateTime.tryParse(widget.existing!.expiresOn) : null;
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _expiresOn ?? DateTime.now().add(const Duration(days: 90)),
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 365 * 3)),
    );
    if (picked != null) setState(() => _expiresOn = picked);
  }

  Future<void> _pickFile() async {
    final picked = await ImagePicker().pickImage(source: ImageSource.gallery, maxWidth: 2000, imageQuality: 90);
    if (picked != null) setState(() => _file = File(picked.path));
  }

  Future<void> _submit() async {
    if (_expiresOn == null) {
      setState(() => _error = "Muddatni tanlang");
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      await widget.api.saveDoc(
        id: widget.existing?.id,
        docType: _docType,
        number: _numberController.text.trim().isEmpty ? null : _numberController.text.trim(),
        expiresOn: _expiresOn!.toIso8601String().split('T').first,
        address: _addressController.text.trim().isEmpty ? null : _addressController.text.trim(),
        file: _file,
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
            Text(widget.existing == null ? 'Yangi hujjat' : 'Hujjatni tahrirlash',
                style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              initialValue: _docType,
              decoration: const InputDecoration(labelText: 'Turi'),
              items: docTypeLabels.entries.map((e) => DropdownMenuItem(value: e.key, child: Text(e.value))).toList(),
              onChanged: (value) => setState(() => _docType = value ?? 'visa'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _numberController,
              decoration: const InputDecoration(labelText: 'Raqami', border: OutlineInputBorder()),
            ),
            const SizedBox(height: 12),
            ListTile(
              contentPadding: EdgeInsets.zero,
              title: Text(_expiresOn == null ? 'Muddati' : _expiresOn!.toIso8601String().split('T').first),
              trailing: const Icon(Icons.calendar_today),
              onTap: _pickDate,
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _addressController,
              decoration: const InputDecoration(labelText: 'Manzil', border: OutlineInputBorder()),
            ),
            const SizedBox(height: 12),
            OutlinedButton.icon(
              onPressed: _pickFile,
              icon: const Icon(Icons.upload_file),
              label: Text(_file == null ? 'Fayl tanlash' : 'Fayl tanlandi ✓'),
            ),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text(_error!, style: const TextStyle(color: Colors.red)),
              ),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: _submitting ? null : _submit,
              child: _submitting
                  ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2))
                  : const Text('Saqlash'),
            ),
          ],
        ),
      ),
    );
  }
}
