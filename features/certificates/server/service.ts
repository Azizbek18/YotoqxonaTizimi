import 'server-only'
import { ApiError } from '@/server/http/api-error'
import { normalizeFaculty } from '@/lib/faculties'
import type { CertificateRequestRow } from '@/types/database.generated'
import {
  CERTIFICATE_PURPOSES,
  MAX_PENDING_CERTIFICATES,
  type CertificateDashboardRow,
  type CertificateDocument,
  type CertificatePurpose,
  type CertificateRequest,
} from '../types'
import {
  createCertificatesRepository,
  type CertificateWithStudent,
  type CertificatesRepository,
} from './repository'

const NOTE_MAX = 300

function cleanNote(value: unknown): string | null {
  if (value === undefined || value === null) return null
  const text = String(value).trim()
  return text ? text.slice(0, NOTE_MAX) : null
}

function mapRow(row: CertificateRequestRow): CertificateRequest {
  return {
    id: row.id,
    purpose: row.purpose,
    purposeNote: row.purpose_note,
    status: row.status,
    number: row.number,
    decidedByName: row.decided_by_name,
    decidedAt: row.decided_at,
    decisionNote: row.decision_note,
    createdAt: row.created_at,
  }
}

/** Ma'lumotnoma raqami: MA-2026-1A2B3C (so'rov id sidan). */
export function certificateNumber(id: string, year: number): string {
  return `MA-${year}-${id.replace(/-/g, '').slice(0, 6).toUpperCase()}`
}

export function createCertificatesService(
  repository: CertificatesRepository = createCertificatesRepository(),
) {
  return {
    async listForStudent(studentId: string): Promise<CertificateRequest[]> {
      return (await repository.listForStudent(studentId)).map(mapRow)
    },

    /** Faqat kvartirada turuvchi (KV) talaba so'rov yubora oladi. */
    async request(studentId: string, input: { purpose?: unknown; purposeNote?: unknown }): Promise<CertificateRequest> {
      const purpose = input.purpose as CertificatePurpose
      if (!CERTIFICATE_PURPOSES.includes(purpose)) throw new ApiError(400, 'Maqsadni tanlang')
      const note = cleanNote(input.purposeNote)
      if (purpose === 'boshqa' && !note) throw new ApiError(400, 'Maqsadni qisqacha yozing')

      const student = await repository.findStudent(studentId)
      if (!student) throw new ApiError(404, 'Talaba profili topilmadi')
      if (student.is_off_campus !== true) {
        throw new ApiError(403, 'Ma‘lumotnoma so‘rovi faqat kvartirada turuvchi talaba uchun')
      }
      if (!normalizeFaculty(student.faculty)) throw new ApiError(400, 'Fakultet biriktirilmagan')
      if ((await repository.countPending(studentId)) >= MAX_PENDING_CERTIFICATES) {
        throw new ApiError(429, 'Ko‘rib chiqilayotgan so‘rovlar ko‘p. Avval ularning natijasini kuting.')
      }
      return mapRow(await repository.insert(studentId, { purpose, purpose_note: note }))
    },

    /** Talaba o'z tasdiqlangan ma'lumotnomasini PDF uchun oladi. */
    async documentForStudent(studentId: string, id: string): Promise<CertificateDocument> {
      const row = await repository.getById(id)
      if (!row || row.student_id !== studentId) throw new ApiError(404, 'Ma‘lumotnoma topilmadi')
      if (row.status !== 'approved') throw new ApiError(409, 'Ma‘lumotnoma hali tasdiqlanmagan')
      const u = row.users
      return {
        ...mapRow(row),
        studentName: u?.full_name ?? '',
        faculty: u?.faculty ?? null,
        direction: u?.direction ?? null,
        course: u?.course ?? null,
        group: u?.group ?? null,
      }
    },

    async listForFaculty(facultyValue: string): Promise<CertificateDashboardRow[]> {
      const faculty = normalizeFaculty(facultyValue)
      if (!faculty) throw new ApiError(403, 'Fakultet biriktirilmagan')
      const rows = await repository.listForFaculty(faculty)
      return rows.map((row) => ({
        ...mapRow(row),
        studentId: row.student_id,
        studentName: row.users?.full_name ?? '—',
        course: row.users?.course ?? null,
        group: row.users?.group ?? null,
        direction: row.users?.direction ?? null,
      }))
    },

    async decide(
      id: string,
      facultyValue: string,
      staff: { id: string; full_name: string | null },
      input: { action?: unknown; note?: unknown },
    ): Promise<{ request: CertificateRequest; studentId: string }> {
      const faculty = normalizeFaculty(facultyValue)
      if (!faculty) throw new ApiError(403, 'Fakultet biriktirilmagan')
      if (input.action !== 'approve' && input.action !== 'reject') throw new ApiError(400, 'Amal noto‘g‘ri')
      const note = cleanNote(input.note)
      if (input.action === 'reject' && !note) throw new ApiError(400, 'Rad etish sababini yozing')

      const row: CertificateWithStudent | null = await repository.getById(id)
      if (!row) throw new ApiError(404, 'So‘rov topilmadi')
      if (normalizeFaculty(row.users?.faculty ?? null) !== faculty) {
        throw new ApiError(403, 'Boshqa fakultet talabasi so‘rovini hal qilib bo‘lmaydi')
      }
      if (row.status !== 'pending') throw new ApiError(409, 'Bu so‘rov allaqachon hal qilingan')

      const now = new Date()
      const updated = await repository.decide(id, {
        status: input.action === 'approve' ? 'approved' : 'rejected',
        number: input.action === 'approve' ? certificateNumber(id, now.getFullYear()) : null,
        decided_by: staff.id,
        decided_by_name: staff.full_name ?? 'Dekan',
        decided_at: now.toISOString(),
        decision_note: note,
      })
      if (!updated) throw new ApiError(409, 'Bu so‘rov allaqachon hal qilingan')
      return { request: mapRow(updated), studentId: row.student_id }
    },
  }
}
