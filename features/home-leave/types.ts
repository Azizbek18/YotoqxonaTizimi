// Uyga ketish arizasi (talaba → yo'qlamada "Uyda" holati).

export type LeaveDestinationKind = 'uy' | 'qarindosh' | 'boshqa'
export type LeaveStatus = 'pending' | 'active' | 'returned' | 'cancelled' | 'rejected'
export type LeaveLocStatus = 'none' | 'near' | 'far' | 'shared'
export type LeaveCallResult = 'none' | 'ok' | 'no_answer' | 'denied'

export const LEAVE_KIND_LABELS: Record<LeaveDestinationKind, string> = {
  uy: 'Uyimga',
  qarindosh: 'Qarindoshimnikiga',
  boshqa: 'Boshqa joyga',
}

export const LEAVE_STATUS_LABELS: Record<LeaveStatus, string> = {
  pending: 'Dekan ko‘rib chiqmoqda',
  active: 'Faol',
  returned: 'Qaytgan',
  cancelled: 'Bekor qilingan',
  rejected: 'Rad etilgan',
}

export const LEAVE_CALL_LABELS: Record<LeaveCallResult, string> = {
  none: 'Qo‘ng‘iroq qilinmagan',
  ok: 'Aloqa shaxsi tasdiqladi',
  no_answer: 'Javob bermadi',
  denied: 'Tasdiqlamadi',
}

/** Shu kungacha ariza tekshiruvsiz darrov kuchga kiradi; undan uzoqi dekanga ketadi. */
export const LEAVE_AUTO_MAX_DAYS = 7
export const LEAVE_MAX_DAYS = 30
/** Ketish sanasi eng ko'pi bilan shuncha kun oldindan belgilanadi. */
export const LEAVE_MAX_ADVANCE_DAYS = 14
/** Joylashuv shu masofadan (km) yaqin bo'lsa manzilga mos deb hisoblanadi. */
export const LEAVE_NEAR_KM = 60

export type HomeLeave = {
  id: string
  destinationKind: LeaveDestinationKind
  destinationAddress: string
  destinationLat: number | null
  destinationLng: number | null
  contactName: string
  contactPhone: string
  reason: string | null
  startsOn: string
  endsOn: string
  status: LeaveStatus
  locStatus: LeaveLocStatus
  callResult: LeaveCallResult
  callByName: string | null
  decidedByName: string | null
  decisionNote: string | null
  returnedAt: string | null
  createdAt: string
}

/** Xodim ro'yxatidagi qator: ariza + talaba. */
export type HomeLeaveStaffRow = HomeLeave & {
  studentId: string
  studentName: string
  roomNumber: string | null
  floor: number | null
  /** Ariza bugun amalda (starts..ends oralig'ida) ekanini. */
  inEffect: boolean
}

export type HomeLeaveInput = {
  destinationKind: LeaveDestinationKind
  destinationAddress: string
  destinationLat?: number | null
  destinationLng?: number | null
  contactName: string
  contactPhone: string
  reason?: string
  startsOn: string
  endsOn: string
  consent: boolean
}
