class StudentProfile {
  StudentProfile({
    required this.id,
    required this.fullName,
    this.middleName,
    this.email,
    this.phoneNumber,
    this.faculty,
    this.direction,
    this.roomNumber,
    this.course,
    this.group,
    this.gender,
    this.avatarUrl,
    this.warningCount = 0,
    this.isFloorCaptain = false,
    this.isCouncilChair = false,
  });

  factory StudentProfile.fromJson(Map<String, dynamic> json) => StudentProfile(
        id: json['id'] as String,
        fullName: json['full_name'] as String? ?? '',
        middleName: json['middle_name'] as String?,
        email: json['email'] as String?,
        phoneNumber: json['phone_number'] as String?,
        faculty: json['faculty'] as String?,
        direction: json['direction'] as String?,
        roomNumber: json['room_number'] as String?,
        course: json['course'],
        group: json['group'] as String?,
        gender: json['gender'] as String?,
        avatarUrl: json['avatar_url'] as String?,
        warningCount: (json['warning_count'] as num?)?.toInt() ?? 0,
        isFloorCaptain: json['is_floor_captain'] as bool? ?? false,
        isCouncilChair: json['is_council_chair'] as bool? ?? false,
      );

  final String id;
  final String fullName;
  final String? middleName;
  final String? email;
  final String? phoneNumber;
  final String? faculty;
  final String? direction;
  final String? roomNumber;
  final dynamic course;
  final String? group;
  final String? gender;
  final String? avatarUrl;
  final int warningCount;
  final bool isFloorCaptain;
  final bool isCouncilChair;
}

class RoommateProfile {
  RoommateProfile({required this.id, required this.fullName, this.roomNumber, this.avatarUrl, this.phoneNumber});

  factory RoommateProfile.fromJson(Map<String, dynamic> json) => RoommateProfile(
        id: json['id'] as String,
        fullName: json['full_name'] as String? ?? '',
        roomNumber: json['room_number'] as String?,
        avatarUrl: json['avatar_url'] as String?,
        phoneNumber: json['phone_number'] as String?,
      );

  final String id;
  final String fullName;
  final String? roomNumber;
  final String? avatarUrl;
  final String? phoneNumber;
}

class StudentProfilePayload {
  StudentProfilePayload({required this.profile, required this.roommates, required this.roommatesCount});

  factory StudentProfilePayload.fromJson(Map<String, dynamic> json) => StudentProfilePayload(
        profile: StudentProfile.fromJson(json['profile'] as Map<String, dynamic>),
        roommates: (json['roommates'] as List<dynamic>? ?? [])
            .map((e) => RoommateProfile.fromJson(e as Map<String, dynamic>))
            .toList(),
        roommatesCount: (json['roommatesCount'] as num?)?.toInt() ?? 0,
      );

  final StudentProfile profile;
  final List<RoommateProfile> roommates;
  final int roommatesCount;
}

class DeviceSession {
  DeviceSession({
    required this.id,
    required this.device,
    required this.browser,
    required this.os,
    required this.createdAt,
    required this.lastActiveAt,
    required this.current,
  });

  factory DeviceSession.fromJson(Map<String, dynamic> json) => DeviceSession(
        id: json['id'] as String,
        device: json['device'] as String? ?? '',
        browser: json['browser'] as String? ?? '',
        os: json['os'] as String? ?? '',
        createdAt: json['createdAt'] as String? ?? '',
        lastActiveAt: json['lastActiveAt'] as String? ?? '',
        current: json['current'] as bool? ?? false,
      );

  final String id;
  final String device;
  final String browser;
  final String os;
  final String createdAt;
  final String lastActiveAt;
  final bool current;
}
