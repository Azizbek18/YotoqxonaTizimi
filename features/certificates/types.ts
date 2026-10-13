// Talabalik ma'lumotnomasi so'rovlari (KV-talaba → fakultet dekani).

export type CertificatePurpose = 'ijara' | 'migratsiya' | 'bank' | 'boshqa'
export type CertificateStatus = 'pending' | 'approved' | 'rejected'

export const CERTIFICATE_PURPOSES: readonly CertificatePurpose[] = ['ijara', 'migratsiya', 'bank', 'boshqa']

export const CERTIFICATE_PURPOSE_LABELS: Record<CertificatePurpose, string> = {
  ijara: 'Ijara shartnomasi uchun',
  migratsiya: "Migratsiya / ro'yxatga qo'yish uchun",
  bank: 'Bank uchun',
  boshqa: 'Boshqa maqsad',
}

export const CERTIFICATE_STATUS_LABELS: Record<CertificateStatus, string> = {
  pending: 'Ko‘rib chiqilmoqda',
  approved: 'Tasdiqlangan',
  rejected: 'Rad etilgan',
}

export const MAX_PENDING_CERTIFICATES = 3

export type CertificateRequest = {
  id: string
  purpose: CertificatePurpose
  purposeNote: string | null
  status: CertificateStatus
  number: string | null
  decidedByName: string | null
  decidedAt: string | null
  decisionNote: string | null
  createdAt: string
}

/** Dekan ro'yxatidagi qator: so'rov + talaba konteksti. */
export type CertificateDashboardRow = CertificateRequest & {
  studentId: string
  studentName: string
  course: number | null
  group: string | null
  direction: string | null
}

/** PDF yig'ish uchun tasdiqlangan ma'lumotnoma ma'lumotlari. */
export type CertificateDocument = CertificateRequest & {
  studentName: string
  faculty: string | null
  direction: string | null
  course: number | null
  group: string | null
}
