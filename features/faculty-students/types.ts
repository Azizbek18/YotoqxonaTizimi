import type { PaymentStatus } from '@/features/payments/types'

/**
 * Which slice of the faculty's students to return.
 * 'placed' — already housed (the Talabalar directory).
 * 'roomless' — registered and verified, but not yet assigned a room.
 * 'all' — both, for reporting/export.
 */
export type StudentScope = 'placed' | 'roomless' | 'all'

export const STUDENT_SCOPES: readonly StudentScope[] = ['placed', 'roomless', 'all']

// Full profile of a faculty student — powers the dekan "Talabalar"
// directory (a faculty-scoped, read-only mirror of the admin foydalanuvchilar
// section), so it carries the same fields that section renders in its
// Profil / Hujjat / Oila tabs.
export type StudentProfileRow = {
  id: string
  full_name: string
  middle_name: string | null
  email: string | null
  phone_number: string | null
  avatar_url: string | null
  gender: string | null
  faculty: string | null
  direction: string | null
  course: number | null
  status: string | null
  room_number: string | null
  assigned_floor: number | null
  is_floor_captain: boolean | null
  warning_count: number | null
  birth_date: string | null
  nationality: string | null
  study_type: string | null
  entry_date: string | null
  region: string | null
  district: string | null
  mahalla: string | null
  passport_series: string | null
  jshshir: string | null
  passport_date: string | null
  father_full_name: string | null
  father_workplace: string | null
  father_phone: string | null
  mother_full_name: string | null
  mother_workplace: string | null
  mother_phone: string | null
  created_at: string
}

// Deliberately NOT the admin `PaymentRecord`: `receipt_url` is omitted and
// replaced by a plain `has_receipt` flag. Receipt files live in a private
// bucket whose signed-URL endpoint (/api/payments/receipt-url) only opens
// for the paying student or an admin, so handing a dekan the object
// path would be a dead link at best and scope creep into private financial
// documents at worst — knowing *whether* a receipt was attached is all the
// debt overview needs.
export type FacultyPaymentRecord = {
  id: string
  student_id: string
  month: string
  year: number
  amount: number
  status: PaymentStatus
  admin_message?: string
  has_receipt: boolean
  created_at: string
}

/**
 * 'info' — eslatma: reaches the student's notification bell and email only.
 * 'warning' — rasmiy ogohlantirish: additionally lands in the student's
 * "Ogohlantirishlar" list and raises `users.warning_count`, which is the
 * counter the expulsion threshold is measured against. Keeping these two
 * separate is what stops a routine payment reminder from pushing someone
 * toward chetlatilish.
 */
export type StudentWarningLevel = 'info' | 'warning'

export type SendWarningInput = {
  studentId: string
  message: string
  level: StudentWarningLevel
}

export type SendWarningResult = {
  ok: true
  level: StudentWarningLevel
  warningCount: number
}
