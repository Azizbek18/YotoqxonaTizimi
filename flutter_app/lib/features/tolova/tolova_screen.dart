import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';

import '../../core/api/api_exception.dart';
import '../../shared/widgets/app_bottom_nav.dart';
import 'payment_api.dart';
import 'payment_models.dart';

class TolovaScreen extends ConsumerStatefulWidget {
  const TolovaScreen({super.key});

  @override
  ConsumerState<TolovaScreen> createState() => _TolovaScreenState();
}

class _TolovaScreenState extends ConsumerState<TolovaScreen> {
  List<PaymentRecord> _payments = [];
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
      final payments = await ref.read(paymentApiProvider).fetchPayments();
      payments.sort((a, b) => b.createdAt.compareTo(a.createdAt));
      setState(() {
        _payments = payments;
        _loading = false;
      });
    } catch (error) {
      setState(() {
        _error = error is ApiException ? error.message : "To'lovlarni yuklab bo'lmadi";
        _loading = false;
      });
    }
  }

  Future<void> _openSubmitSheet() async {
    final submitted = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _SubmitPaymentSheet(api: ref.read(paymentApiProvider)),
    );
    if (submitted == true) _load();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text("To'lovlar")),
      bottomNavigationBar: const AppBottomNav(currentPath: '/tolova'),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _openSubmitSheet,
        icon: const Icon(Icons.add),
        label: const Text('Chek yuborish'),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Text(_error!))
              : RefreshIndicator(
                  onRefresh: _load,
                  child: _payments.isEmpty
                      ? ListView(children: const [
                          Padding(
                            padding: EdgeInsets.all(32),
                            child: Center(child: Text("Hali to'lov tarixi yo'q")),
                          ),
                        ])
                      : ListView.builder(
                          padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
                          itemCount: _payments.length,
                          itemBuilder: (context, index) {
                            final payment = _payments[index];
                            return Card(
                              child: ListTile(
                                title: Text('${payment.month} ${payment.year}'),
                                subtitle: Text(NumberFormat('#,###').format(payment.amount)),
                                trailing: Chip(label: Text(paymentStatusLabel(payment.status))),
                              ),
                            );
                          },
                        ),
                ),
    );
  }
}

class _SubmitPaymentSheet extends StatefulWidget {
  const _SubmitPaymentSheet({required this.api});
  final PaymentApi api;

  @override
  State<_SubmitPaymentSheet> createState() => _SubmitPaymentSheetState();
}

class _SubmitPaymentSheetState extends State<_SubmitPaymentSheet> {
  final _amountController = TextEditingController();
  final _transactionController = TextEditingController();
  final _selectedMonths = <String>{};
  File? _receipt;
  bool _submitting = false;
  String? _error;

  int get _academicYearStart {
    final now = DateTime.now();
    // Sentabr..Dekabr belongs to the academic year starting this calendar
    // year; Yanvar..Iyun belongs to the one that started last year.
    return now.month >= 9 ? now.year : now.year - 1;
  }

  Future<void> _pickReceipt() async {
    final picked = await ImagePicker().pickImage(source: ImageSource.gallery, maxWidth: 2000, imageQuality: 90);
    if (picked != null) setState(() => _receipt = File(picked.path));
  }

  Future<void> _submit() async {
    if (_receipt == null || _selectedMonths.isEmpty || _amountController.text.trim().isEmpty) {
      setState(() => _error = "Oy, summa va chekni to'ldiring");
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      await widget.api.submitPayment(
        receipt: _receipt!,
        amount: double.parse(_amountController.text.trim()),
        academicYearStart: _academicYearStart,
        months: _selectedMonths.toList(),
        transactionId: _transactionController.text.trim(),
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
            Text("To'lov cheki yuborish", style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              children: [
                for (final month in paymentMonthsOrder)
                  FilterChip(
                    label: Text(month),
                    selected: _selectedMonths.contains(month),
                    onSelected: (selected) => setState(() {
                      selected ? _selectedMonths.add(month) : _selectedMonths.remove(month);
                    }),
                  ),
              ],
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _amountController,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(labelText: 'Summa', border: OutlineInputBorder()),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _transactionController,
              decoration: const InputDecoration(labelText: 'Tranzaksiya ID', border: OutlineInputBorder()),
            ),
            const SizedBox(height: 12),
            OutlinedButton.icon(
              onPressed: _pickReceipt,
              icon: const Icon(Icons.receipt_long),
              label: Text(_receipt == null ? 'Chek rasmini tanlash' : 'Chek tanlandi ✓'),
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
                  ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2))
                  : const Text('Yuborish'),
            ),
          ],
        ),
      ),
    );
  }
}
