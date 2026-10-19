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
  PaymentSettings? _settings;
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
      final api = ref.read(paymentApiProvider);
      final results = await Future.wait([
        api.fetchPayments(),
        api.fetchSettings().catchError((_) => PaymentSettings(monthlyFee: 350000, yearlyContractFee: 3500000)),
      ]);
      final payments = results[0] as List<PaymentRecord>;
      payments.sort((a, b) => b.createdAt.compareTo(a.createdAt));
      setState(() {
        _payments = payments;
        _settings = results[1] as PaymentSettings;
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
      builder: (_) => _SubmitPaymentSheet(
        api: ref.read(paymentApiProvider),
        monthlyFee: _settings?.monthlyFee ?? 350000,
      ),
    );
    if (submitted == true) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text("Chek muvaffaqiyatli yuklandi va ko'rib chiqishga yuborildi ✅")),
        );
      }
      _load();
    }
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
                            final amountFormatted = NumberFormat('#,###').format(payment.amount);
                            return Card(
                              child: ListTile(
                                leading: Icon(
                                  payment.status == 'paid' || payment.status == 'approved'
                                      ? Icons.check_circle_outline
                                      : payment.status == 'rejected'
                                          ? Icons.error_outline
                                          : Icons.schedule,
                                  color: payment.status == 'paid' || payment.status == 'approved'
                                      ? Colors.green
                                      : payment.status == 'rejected'
                                          ? Colors.red
                                          : Colors.orange,
                                ),
                                title: Text('${payment.month} ${payment.year}'),
                                subtitle: Text(
                                  payment.adminMessage != null && payment.adminMessage!.isNotEmpty
                                      ? '$amountFormatted so\'m · ${payment.adminMessage}'
                                      : '$amountFormatted so\'m',
                                ),
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
  const _SubmitPaymentSheet({required this.api, required this.monthlyFee});
  final PaymentApi api;
  final double monthlyFee;

  @override
  State<_SubmitPaymentSheet> createState() => _SubmitPaymentSheetState();
}

class _SubmitPaymentSheetState extends State<_SubmitPaymentSheet> {
  final _transactionController = TextEditingController();
  final _selectedMonths = <String>{};
  File? _receipt;
  bool _submitting = false;
  String _statusMessage = '';
  String? _error;

  double get _totalAmount => _selectedMonths.length * widget.monthlyFee;

  int get _academicYearStart {
    final now = DateTime.now();
    return now.month >= 9 ? now.year : now.year - 1;
  }

  @override
  void dispose() {
    _transactionController.dispose();
    super.dispose();
  }

  Future<void> _pickReceipt() async {
    final picked = await ImagePicker().pickImage(source: ImageSource.gallery, maxWidth: 2000, imageQuality: 90);
    if (picked != null) {
      setState(() {
        _receipt = File(picked.path);
        _error = null;
      });
    }
  }

  Future<void> _submit() async {
    if (_receipt == null) {
      setState(() => _error = "Iltimos, chek rasmini tanlang");
      return;
    }
    if (_selectedMonths.isEmpty) {
      setState(() => _error = "Iltimos, to'lov qilinayotgan oyni tanlang");
      return;
    }
    if (_totalAmount <= 0) {
      setState(() => _error = "To'lov summasi noto'g'ri");
      return;
    }

    setState(() {
      _submitting = true;
      _error = null;
      _statusMessage = 'AI chekni tekshirmoqda...';
    });

    try {
      // 1. AI Pre-check via /api/ai/tekshiruv
      final check = await widget.api.precheckReceipt(
        file: _receipt!,
        amount: _totalAmount,
      );

      if (check.isDuplicate) {
        setState(() {
          _error = check.duplicateInfo ?? "⚠️ Ushbu chek avval yuklangan! Qayta yuklash mumkin emas.";
          _submitting = false;
        });
        return;
      }

      if (!check.aiSkipped && (!check.valid || check.amountMatch == false || check.isSuspiciousId)) {
        final detail = check.analysis ?? "Chekdagi summa yoki rekvizitlar mos kelmadi.";
        setState(() {
          _error = "⚠️ AI tekshiruvi: $detail";
          _submitting = false;
        });
        return;
      }

      // 2. Submit payment with claim
      if (mounted) {
        setState(() => _statusMessage = "To'lov yuborilmoqda...");
      }

      final transactionId = (check.transactionId?.isNotEmpty ?? false)
          ? check.transactionId!
          : _transactionController.text.trim();

      await widget.api.submitPayment(
        receipt: _receipt!,
        amount: _totalAmount,
        academicYearStart: _academicYearStart,
        months: _selectedMonths.toList(),
        validatedHash: check.claim,
        transactionId: transactionId,
      );

      if (mounted) Navigator.of(context).pop(true);
    } catch (error) {
      setState(() {
        _error = error is ApiException ? error.message : "Chekni yuklashda xatolik yuz berdi";
      });
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final currencyFormatter = NumberFormat('#,###');
    final formattedTotal = currencyFormatter.format(_totalAmount);
    final formattedMonthly = currencyFormatter.format(widget.monthlyFee);

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
            const SizedBox(height: 4),
            Text(
              "Oylik to'lov stavkasi: $formattedMonthly so'm",
              style: TextStyle(color: Colors.grey.shade600, fontSize: 13),
            ),
            const SizedBox(height: 12),
            Text("To'lov qilinadigan oylar:", style: Theme.of(context).textTheme.titleSmall),
            const SizedBox(height: 6),
            Wrap(
              spacing: 8,
              runSpacing: 4,
              children: [
                for (final month in paymentMonthsOrder)
                  FilterChip(
                    label: Text(month),
                    selected: _selectedMonths.contains(month),
                    onSelected: _submitting
                        ? null
                        : (selected) => setState(() {
                              selected ? _selectedMonths.add(month) : _selectedMonths.remove(month);
                            }),
                  ),
              ],
            ),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.primaryContainer.withValues(alpha: 0.3),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text("Jami hisoblangan summa:"),
                  Text(
                    "$formattedTotal so'm",
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _transactionController,
              enabled: !_submitting,
              decoration: const InputDecoration(
                labelText: 'Tranzaksiya ID (ixtiyoriy, chekda bo\'lsa)',
                hintText: 'Masalan: 384729184',
              ),
            ),
            const SizedBox(height: 12),
            OutlinedButton.icon(
              onPressed: _submitting ? null : _pickReceipt,
              icon: Icon(_receipt == null ? Icons.receipt_long : Icons.check_circle,
                  color: _receipt == null ? null : Colors.green),
              label: Text(_receipt == null ? 'Chek rasmini tanlash' : 'Chek tanlandi ✓'),
            ),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text(_error!, style: const TextStyle(color: Colors.red)),
              ),
            if (_submitting && _statusMessage.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const SizedBox(height: 16, width: 16, child: CircularProgressIndicator(strokeWidth: 2)),
                    const SizedBox(width: 8),
                    Text(_statusMessage, style: TextStyle(color: Colors.grey.shade700)),
                  ],
                ),
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
