/**
 * Per-person permissions the dekan can grant or revoke at any time, the way
 * Telegram lets an owner tune each admin's rights individually.
 *
 * Two subjects carry permissions:
 *   - `tarbiyachi` — a `staff` row   -> `staff.permissions`
 *   - `sardor`     — a floor captain -> `users.captain_permissions`
 *     (a captain is a student with `users.is_floor_captain`, not a staff role)
 *
 * **An absent key means allowed.** The stored object only ever records what
 * has been taken away, so an empty `{}` is a fully-privileged member. This is
 * what makes the feature safe to deploy: every existing tarbiyachi and sardor
 * keeps working the moment the column appears, instead of being locked out
 * until someone ticks their boxes.
 */

export const PERMISSION_SUBJECTS = ['tarbiyachi', 'sardor'] as const
export type PermissionSubject = (typeof PERMISSION_SUBJECTS)[number]

export const TARBIYACHI_PERMISSIONS = [
  'students.view',
  'payments.review',
  'announcements.manage',
  'attendance.manage',
  'applications.review',
] as const

export const SARDOR_PERMISSIONS = [
  'students.view',
  'attendance.mark',
  'floor.announcements',
  'duty.schedule',
] as const

export type TarbiyachiPermission = (typeof TARBIYACHI_PERMISSIONS)[number]
export type SardorPermission = (typeof SARDOR_PERMISSIONS)[number]
export type PermissionKey = TarbiyachiPermission | SardorPermission

/** What the dekan sees next to each toggle. */
export const PERMISSION_LABELS: Record<PermissionKey, { title: string; hint: string }> = {
  'students.view': {
    title: "Talabalarni ko'rish",
    hint: "Fakultet talabalari ro'yxati va ularning ma'lumotlari",
  },
  'payments.review': {
    title: "To'lov cheklarini tasdiqlash",
    hint: 'Chekni ochish, tasdiqlash va rad etish',
  },
  'announcements.manage': {
    title: "E'lon va story joylash",
    hint: "E'lon yaratish/o'chirish va yangiliklar lentasiga story qo'yish",
  },
  'attendance.manage': {
    title: "Yo'qlama ochish va belgilash",
    hint: "Kunlik yo'qlamani ochish, belgilash va yakunlash",
  },
  'applications.review': {
    title: "Arizalarni ko'rib chiqish",
    hint: "Talaba murojaatlari holatini o'zgartirish",
  },
  'attendance.mark': {
    title: "Yo'qlama belgilash",
    hint: "O'z qavatidagi talabalarni yo'qlamada belgilash",
  },
  'floor.announcements': {
    title: "Qavat e'lonlari",
    hint: "O'z qavatidagi talabalarga e'lon yozish",
  },
  'duty.schedule': {
    title: 'Navbatchilik jadvali',
    hint: 'Qavat tozalik navbatchiligini tuzish',
  },
}

export function permissionsForSubject(subject: PermissionSubject): readonly PermissionKey[] {
  return subject === 'tarbiyachi' ? TARBIYACHI_PERMISSIONS : SARDOR_PERMISSIONS
}

/** The shape stored in the jsonb column: only revocations are written. */
export type PermissionMap = Partial<Record<PermissionKey, boolean>>

/**
 * The single place that decides access. Anything not explicitly set to
 * `false` is granted, so unknown/legacy rows stay functional.
 */
export function can(permissions: unknown, key: PermissionKey): boolean {
  if (!permissions || typeof permissions !== 'object' || Array.isArray(permissions)) return true
  return (permissions as PermissionMap)[key] !== false
}

/**
 * Normalises whatever came from the client into a storable map: only known
 * keys for that subject, and only the `false` entries are kept so the column
 * stays small and "empty = full access" holds.
 */
export function sanitizePermissions(subject: PermissionSubject, value: unknown): PermissionMap {
  const out: PermissionMap = {}
  if (!value || typeof value !== 'object' || Array.isArray(value)) return out
  const input = value as Record<string, unknown>
  for (const key of permissionsForSubject(subject)) {
    if (input[key] === false) out[key] = false
  }
  return out
}
