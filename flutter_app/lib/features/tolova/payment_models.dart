const paymentMonthsOrder = [
  'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr',
  'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
];

class PaymentRecord {
  PaymentRecord({
    required this.id,
    required this.month,
    required this.year,
    required this.amount,
    required this.status,
    this.adminMessage,
    required this.createdAt,
  });

  factory PaymentRecord.fromJson(Map<String, dynamic> json) => PaymentRecord(
        id: json['id'] as String,
        month: json['month'] as String? ?? '',
        year: (json['year'] as num?)?.toInt() ?? 0,
        amount: (json['amount'] as num?)?.toDouble() ?? 0,
        status: json['status'] as String? ?? 'pending',
        adminMessage: json['admin_message'] as String?,
        createdAt: json['created_at'] as String? ?? '',
      );

  final String id;
  final String month;
  final int year;
  final double amount;
  final String status;
  final String? adminMessage;
  final String createdAt;
}

String paymentStatusLabel(String status) {
  switch (status) {
    case 'paid':
    case 'approved':
      return "To'landi";
    case 'rejected':
      return 'Rad etildi';
    case 'waiting':
      return 'Tekshirilmoqda';
    default:
      return 'Kutilmoqda';
  }
}
