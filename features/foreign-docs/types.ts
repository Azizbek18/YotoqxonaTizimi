// Xorijiy talaba viza / propiska nazorati — umumiy tiplar va konstantalar.
// Bu fayl faqat sof tiplardan iborat (server-only emas): client ham,
// domain helperlar ham, testlar ham import qiladi.

export type DocType = 'visa' | 'registration'
export type DocStatus = 'active' | 'renewing' | 'cancelled'
export type RegistrationBasis = 'mehmonxona' | 'ijara' | 'qarindosh' | 'ttj'

export const DOC_TYPES: readonly DocType[] = ['visa', 'registration']
export const DOC_STATUSES: readonly DocStatus[] = ['active', 'renewing', 'cancelled']
export const REGISTRATION_BASES: readonly RegistrationBasis[] = [
  'mehmonxona',
  'ijara',
  'qarindosh',
  'ttj',
]

export const DOC_TYPE_LABELS: Record<DocType, string> = {
  visa: 'Viza',
  registration: "Ro'yxatga qo'yish (propiska)",
}

export const DOC_STATUS_LABELS: Record<DocStatus, string> = {
  active: 'Faol',
  renewing: 'Yangilanmoqda',
  cancelled: 'Bekor qilingan',
}

export const REGISTRATION_BASIS_LABELS: Record<RegistrationBasis, string> = {
  mehmonxona: 'Mehmonxona',
  ijara: 'Ijara (kvartira)',
  qarindosh: 'Qarindoshining uyida',
  ttj: 'Yotoqxona (TTJ)',
}

// Eslatma bosqichlari — muddatga shuncha kun qolganda talaba ogohlantiriladi.
// Muddat o'tgach POST_EXPIRY_GRACE_DAYS kun davomida kunlik ogohlantirish
// (jurnalда manfiy "milestone" sifatida: -1, -2, …).
export const MILESTONES: readonly number[] = [30, 15, 10, 5, 3, 0]
export const POST_EXPIRY_GRACE_DAYS = 7

// Dekan dashboardidagi guruh kartalari (skrinshotdek).
export type ExpiryBucket = 'expired' | 'critical' | 'warning' | 'soon' | 'ok'

export const BUCKET_LABELS: Record<ExpiryBucket, string> = {
  expired: "Muddati o'tgan",
  critical: 'Kritik',
  warning: 'Ogohlantirish',
  soon: 'Kutilayotgan',
  ok: 'Amal qilayotgan',
}

export const BUCKET_HINTS: Record<ExpiryBucket, string> = {
  expired: '< 0 kun',
  critical: '1–3 kun qolgan',
  warning: '4–10 kun qolgan',
  soon: '11–30 kun qolgan',
  ok: '30+ kun',
}

export type ForeignDoc = {
  id: string
  studentId: string
  docType: DocType
  number: string | null
  issuedOn: string | null // YYYY-MM-DD
  expiresOn: string // YYYY-MM-DD
  status: DocStatus
  registrationBasis: RegistrationBasis | null
  address: string | null
  hasFile: boolean
  note: string | null
  verifiedAt: string | null
  createdByRole: 'talaba' | 'dekan' | 'admin'
  createdAt: string
  updatedAt: string
  // Hisoblangan (server yoki client):
  daysLeft: number
  bucket: ExpiryBucket
}

// Talaba yoki dekan formadan yuboradigan shakl.
export type ForeignDocInput = {
  id?: string
  docType: DocType
  number?: string | null
  issuedOn?: string | null
  expiresOn: string
  status?: DocStatus
  registrationBasis?: RegistrationBasis | null
  address?: string | null
  note?: string | null
}

// Dekan tahrirlaydigan qism (talaba emas).
export type ForeignDocStaffPatch = Partial<{
  number: string | null
  issuedOn: string | null
  expiresOn: string
  status: DocStatus
  registrationBasis: RegistrationBasis | null
  address: string | null
  note: string | null
  verified: boolean
}>

// Dekan dashboardidagi bir qator — hujjat + talaba konteksti.
export type ForeignDocDashboardRow = ForeignDoc & {
  studentName: string
  faculty: string | null
  country: string | null
  course: number | null
  roomNumber: string | null
}
