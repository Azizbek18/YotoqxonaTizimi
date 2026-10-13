const List<String> announcementTypes = ['Muhim', 'Tadbir', 'Yangilik', 'Ogohlantirish'];

class Announcement {
  Announcement({
    required this.id,
    required this.title,
    required this.text,
    required this.type,
    required this.audience,
    this.faculty,
    this.createdAt,
    this.publishedAt,
    this.authorName,
    this.isFromCaptain = false,
    this.captainFloor,
    this.isFromCouncilChair = false,
  });

  factory Announcement.fromJson(Map<String, dynamic> json) => Announcement(
        id: json['id'] as String,
        title: json['title'] as String? ?? '',
        text: json['text'] as String? ?? '',
        type: json['type'] as String? ?? 'Yangilik',
        audience: json['audience'] as String? ?? 'all',
        faculty: json['faculty'] as String?,
        createdAt: DateTime.tryParse(json['created_at'] as String? ?? ''),
        publishedAt: DateTime.tryParse(json['published_at'] as String? ?? ''),
        authorName: json['author_name'] as String?,
        isFromCaptain: json['is_from_captain'] as bool? ?? false,
        captainFloor: json['captain_floor'] as int?,
        isFromCouncilChair: json['is_from_council_chair'] as bool? ?? false,
      );

  final String id;
  final String title;
  final String text;
  final String type;
  final String audience;
  final String? faculty;
  final DateTime? createdAt;
  final DateTime? publishedAt;
  final String? authorName;
  final bool isFromCaptain;
  final int? captainFloor;
  final bool isFromCouncilChair;

  /// General dorm-wide notices: superadmin ('system') notices belong here too.
  bool get isDormWide => audience == 'all' || audience == 'system';

  /// Faculty-scoped notices already resolved (gender/floor-matched) by the
  /// server for this reader: dekan ('faculty'), sardor ('floor'), kengash
  /// raisi ('council').
  bool get isFacultyScoped => audience == 'faculty' || audience == 'floor' || audience == 'council';

  String get sourceLabel {
    if (isFromCaptain) return captainFloor != null ? '$captainFloor-qavat sardori' : 'Qavat sardori';
    if (isFromCouncilChair) return 'Talaba kengashi raisi';
    return authorName?.isNotEmpty == true ? authorName! : "Tizim ma'muri";
  }

  String get relativeDate {
    final date = publishedAt ?? createdAt;
    if (date == null) return 'Bugun';
    final diffDays = DateTime.now().difference(date).inDays;
    if (diffDays <= 0) return 'Bugun';
    if (diffDays == 1) return 'Kecha';
    if (diffDays < 7) return '$diffDays kun avval';
    if (diffDays < 14) return '1 hafta avval';
    return '${date.day}.${date.month}.${date.year}';
  }
}
