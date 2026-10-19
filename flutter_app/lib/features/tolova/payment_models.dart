const paymentMonthsOrder = [
  'Sentabr',
  'Oktabr',
  'Noyabr',
  'Dekabr',
  'Yanvar',
  'Fevral',
  'Mart',
  'Aprel',
  'May',
  'Iyun',
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

class PaymentSettings {
  PaymentSettings({
    required this.monthlyFee,
    required this.yearlyContractFee,
  });

  factory PaymentSettings.fromJson(Map<String, dynamic> json) => PaymentSettings(
        monthlyFee: (json['monthlyFee'] as num?)?.toDouble() ?? 350000,
        yearlyContractFee: (json['yearlyContractFee'] as num?)?.toDouble() ?? 3500000,
      );

  final double monthlyFee;
  final double yearlyContractFee;
}

class AiCheckResult {
  AiCheckResult({
    required this.valid,
    required this.aiSkipped,
    required this.confidence,
    this.extractedAmount,
    this.transactionId,
    this.paymentDate,
    this.analysis,
    this.amountMatch,
    required this.isDuplicate,
    required this.isSuspiciousId,
    this.duplicateInfo,
    this.claim,
    this.fileHash,
  });

  factory AiCheckResult.fromJson(Map<String, dynamic> json) => AiCheckResult(
        valid: json['valid'] as bool? ?? false,
        aiSkipped: json['aiSkipped'] as bool? ?? false,
        confidence: (json['confidence'] as num?)?.toInt() ?? 0,
        extractedAmount: (json['extracted_amount'] as num?)?.toDouble(),
        transactionId: json['transaction_id'] as String?,
        paymentDate: json['payment_date'] as String?,
        analysis: json['analysis'] as String?,
        amountMatch: json['amount_match'] as bool?,
        isDuplicate: json['is_duplicate'] as bool? ?? false,
        isSuspiciousId: json['is_suspicious_id'] as bool? ?? false,
        duplicateInfo: json['duplicate_info'] as String?,
        claim: json['claim'] as String?,
        fileHash: json['file_hash'] as String?,
      );

  final bool valid;
  final bool aiSkipped;
  final int confidence;
  final double? extractedAmount;
  final String? transactionId;
  final String? paymentDate;
  final String? analysis;
  final bool? amountMatch;
  final bool isDuplicate;
  final bool isSuspiciousId;
  final String? duplicateInfo;
  final String? claim;
  final String? fileHash;
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
