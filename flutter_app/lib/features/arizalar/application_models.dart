class StudentApplication {
  StudentApplication({
    required this.id,
    this.title,
    this.type,
    this.reason,
    required this.text,
    this.status,
    this.adminResponse,
    required this.createdAt,
  });

  factory StudentApplication.fromJson(Map<String, dynamic> json) => StudentApplication(
        id: json['id'] as String,
        title: json['title'] as String?,
        type: json['type'] as String?,
        reason: json['reason'] as String?,
        text: json['text'] as String? ?? '',
        status: json['status'] as String?,
        adminResponse: json['admin_response'] as String?,
        createdAt: json['created_at'] as String? ?? '',
      );

  final String id;
  final String? title;
  final String? type;
  final String? reason;
  final String text;
  final String? status;
  final String? adminResponse;
  final String createdAt;
}

String applicationStatusLabel(String? status) {
  switch (status) {
    case 'draft':
      return 'Qoralama';
    case 'submitted':
    case 'pending':
      return 'Yuborilgan';
    case 'answered':
    case 'responded':
      return 'Javob berilgan';
    case 'rejected':
      return 'Rad etilgan';
    default:
      return status ?? "Noma'lum";
  }
}

const applicationTypeLabels = {
  'ariza': 'Ariza',
  'tushuntirish': 'Tushuntirish xati',
  'taklif': 'Taklif',
};
