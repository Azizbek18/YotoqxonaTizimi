import 'server-only'
import { ApiError } from '@/server/http/api-error'
import { normalizeFaculty } from '@/lib/faculties'
import { createAppSettingsService } from '@/features/app-settings/server/service'
import type { ForeignStudentDocumentRow } from '@/types/database.generated'
import {
  DOC_STATUSES,
  DOC_TYPES,
  REGISTRATION_BASES,
  type DocStatus,
  type DocType,
  type ForeignDoc,
  type ForeignDocDashboardRow,
  type ForeignDocInput,
  type ForeignDocStaffPatch,
  type RegistrationBasis,
} from '../types'
import { bucketOf, daysLeft, tashkentToday } from '../domain/expiry'
import {
  createForeignDocsRepository,
  type DocWriteFields,
  type ForeignDocsRepository,
} from './repository'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const NUMBER_MAX = 60
const ADDRESS_MAX = 300
const NOTE_MAX = 1000
const MIN_YEAR = 2000
const MAX_FUTURE_YEARS = 20

function isValidDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false
  const time = Date.parse(`${value}T00:00:00Z`)
  if (Number.isNaN(time)) return false
  const year = Number(value.slice(0, 4))
  const maxYear = new Date().getUTCFullYear() + MAX_FUTURE_YEARS
  return year >= MIN_YEAR && year <= maxYear
}

function optionalText(value: unknown, max: number): string | null {
  if (value === undefined || value === null) return null
  const text = String(value).trim()
  return text ? text.slice(0, max) : null
}

function mapRow(row: ForeignStudentDocumentRow, today: string): ForeignDoc {
  const d = daysLeft(row.expires_on, today)
  return {
    id: row.id,
    studentId: row.student_id,
    docType: row.doc_type,
    number: row.number,
    issuedOn: row.issued_on,
    expiresOn: row.expires_on,
    status: row.status,
    registrationBasis: row.registration_basis,
    address: row.address,
    hasFile: Boolean(row.file_path),
    note: row.note,
    verifiedAt: row.verified_at,
    createdByRole: row.created_by_role,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    daysLeft: d,
    bucket: bucketOf(d),
  }
}

/**
 * Umumiy validatsiya + `registration_basis='ttj'` bo'lganda manzilni TTJ
 * nomidan avto to'ldirish. `faculty` — TTJ nomi per-fakultet sozlamasidan
 * olinadi.
 */
async function toWriteFields(
  input: ForeignDocInput,
  faculty: string | null,
  isForeign: boolean,
): Promise<DocWriteFields> {
  const docType = input.docType
  if (!DOC_TYPES.includes(docType)) throw new ApiError(400, "Hujjat turi noto'g'ri")
  // Viza faqat chet el fuqarosiga tegishli tushuncha — O'zbekiston fuqarosi
  // (boshqa viloyatdan bo'lsa ham) faqat propiska (registration) qo'sha oladi.
  if (docType === 'visa' && !isForeign) {
    throw new ApiError(403, "Viza faqat xorijiy fuqarolik uchun — O'zbekiston fuqarosiga tegishli emas")
  }

  const expiresOn = String(input.expiresOn ?? '').trim()
  if (!expiresOn) throw new ApiError(400, 'Amal qilish muddatini kiriting')
  if (!isValidDate(expiresOn)) throw new ApiError(400, "Amal qilish muddati noto'g'ri")

  let issuedOn: string | null = null
  if (input.issuedOn) {
    issuedOn = String(input.issuedOn).trim()
    if (!isValidDate(issuedOn)) throw new ApiError(400, "Berilgan sana noto'g'ri")
    if (issuedOn > expiresOn) {
      throw new ApiError(400, "Berilgan sana amal qilish muddatidan keyin bo'lolmaydi")
    }
  }

  const status: DocStatus = DOC_STATUSES.includes(input.status as DocStatus)
    ? (input.status as DocStatus)
    : 'active'

  const fields: DocWriteFields = {
    doc_type: docType,
    number: optionalText(input.number, NUMBER_MAX),
    issued_on: issuedOn,
    expires_on: expiresOn,
    status,
    note: optionalText(input.note, NOTE_MAX),
  }

  if (docType === 'registration') {
    const basis = input.registrationBasis
    if (!basis || !REGISTRATION_BASES.includes(basis as RegistrationBasis)) {
      throw new ApiError(400, "Ro'yxatga qo'yish turini tanlang")
    }
    fields.registration_basis = basis as RegistrationBasis
    let address = optionalText(input.address, ADDRESS_MAX)
    if (basis === 'ttj' && !address && faculty) {
      const { ttjName } = await createAppSettingsService().get(faculty)
      address = ttjName ? ttjName : null
    }
    fields.address = address
  } else {
    // Viza — asos/manzil qatnashmaydi.
    fields.registration_basis = null
    fields.address = null
  }

  return fields
}

function requireFaculty(faculty: string | null | undefined): string {
  const canonical = normalizeFaculty(faculty ?? null)
  if (!canonical) throw new ApiError(403, 'Fakultet biriktirilmagan')
  return canonical
}

export function createForeignDocsService(
  repository: ForeignDocsRepository = createForeignDocsRepository(),
) {
  return {
    async listForStudent(studentId: string): Promise<ForeignDoc[]> {
      const today = tashkentToday()
      const rows = await repository.listForStudent(studentId)
      return rows.map((row) => mapRow(row, today))
    },

    /** Talaba o'zi uchun hujjat yaratadi yoki o'z yozuvini yangilaydi. */
    async saveForStudent(studentId: string, input: ForeignDocInput): Promise<ForeignDoc> {
      const context = await repository.findStudentContext(studentId)
      if (!context) throw new ApiError(404, 'Talaba profili topilmadi')
      const fields = await toWriteFields(input, context.faculty, Boolean(context.country))
      const today = tashkentToday()

      if (input.id) {
        const updated = await repository.updateOwn(input.id, studentId, fields)
        if (!updated) throw new ApiError(404, 'Hujjat topilmadi yoki tahrirlashga ruxsat yo‘q')
        return mapRow(updated, today)
      }
      const created = await repository.insert(studentId, fields, 'talaba')
      return mapRow(created, today)
    },

    async deleteForStudent(id: string, studentId: string): Promise<void> {
      const ok = await repository.deleteOwn(id, studentId)
      if (!ok) throw new ApiError(404, 'Hujjat topilmadi yoki o‘chirishga ruxsat yo‘q')
    },

    /** Fayl yuklangach yo'lni biriktirish — egasi yoki xodim. */
    async attachFile(
      id: string,
      filePath: string | null,
      actor: { studentId?: string; staff?: boolean },
    ): Promise<void> {
      const doc = await repository.getById(id)
      if (!doc) throw new ApiError(404, 'Hujjat topilmadi')
      if (!actor.staff && doc.student_id !== actor.studentId) {
        throw new ApiError(403, 'Ruxsat berilmadi')
      }
      await repository.setFilePath(id, filePath)
    },

    async getForFileAccess(
      id: string,
      requester: { userId: string; isStaff: boolean },
    ): Promise<{ filePath: string; studentId: string }> {
      const doc = await repository.getById(id)
      if (!doc || !doc.file_path) throw new ApiError(404, 'Fayl topilmadi')
      if (!requester.isStaff && doc.student_id !== requester.userId) {
        throw new ApiError(403, 'Ruxsat berilmadi')
      }
      return { filePath: doc.file_path, studentId: doc.student_id }
    },

    // ── Dekan / superadmin ────────────────────────────────────────────────
    async listForFaculty(facultyValue: string | null): Promise<ForeignDocDashboardRow[]> {
      const faculty = requireFaculty(facultyValue)
      const today = tashkentToday()
      const rows = await repository.listForFaculty(faculty)
      return rows.map((row) => ({
        ...mapRow(row, today),
        studentName: row.users?.full_name ?? '—',
        faculty: row.users?.faculty ?? null,
        country: row.users?.country ?? null,
        course: row.users?.course ?? null,
        roomNumber: row.users?.room_number ?? null,
      }))
    },

    async patchByStaff(
      id: string,
      facultyValue: string | null,
      patch: ForeignDocStaffPatch,
      staffId: string,
    ): Promise<ForeignDoc> {
      const faculty = requireFaculty(facultyValue)
      const doc = await repository.getById(id)
      if (!doc) throw new ApiError(404, 'Hujjat topilmadi')
      const context = await repository.findStudentContext(doc.student_id)
      if (!context || normalizeFaculty(context.faculty) !== faculty) {
        throw new ApiError(403, 'Boshqa fakultet talabasi hujjatini tahrirlab bo‘lmaydi')
      }

      const fields: DocWriteFields = {}
      if (patch.number !== undefined) fields.number = optionalText(patch.number, NUMBER_MAX)
      if (patch.note !== undefined) fields.note = optionalText(patch.note, NOTE_MAX)
      if (patch.address !== undefined) fields.address = optionalText(patch.address, ADDRESS_MAX)
      if (patch.issuedOn !== undefined) {
        const value = patch.issuedOn ? String(patch.issuedOn).trim() : null
        if (value && !isValidDate(value)) throw new ApiError(400, "Berilgan sana noto'g'ri")
        fields.issued_on = value
      }
      if (patch.expiresOn !== undefined) {
        const value = String(patch.expiresOn).trim()
        if (!isValidDate(value)) throw new ApiError(400, "Amal qilish muddati noto'g'ri")
        fields.expires_on = value
      }
      if (patch.status !== undefined) {
        if (!DOC_STATUSES.includes(patch.status)) throw new ApiError(400, "Holat noto'g'ri")
        fields.status = patch.status
      }
      if (patch.registrationBasis !== undefined) {
        if (patch.registrationBasis && !REGISTRATION_BASES.includes(patch.registrationBasis)) {
          throw new ApiError(400, "Ro'yxatga qo'yish turi noto'g'ri")
        }
        fields.registration_basis = patch.registrationBasis
      }
      if (patch.verified !== undefined) {
        fields.verified_at = patch.verified ? new Date().toISOString() : null
        fields.verified_by = patch.verified ? staffId : null
      }
      if (Object.keys(fields).length === 0) throw new ApiError(400, "Yangilash uchun ma'lumot yo'q")

      const updated = await repository.patchByStaff(id, fields)
      if (!updated) throw new ApiError(404, 'Hujjat topilmadi')
      return mapRow(updated, tashkentToday())
    },

    /** Dekan talaba nomidan hujjat qo'shadi. */
    async addByStaff(
      studentId: string,
      facultyValue: string | null,
      input: ForeignDocInput,
      role: 'dekan' | 'admin',
    ): Promise<ForeignDoc> {
      const faculty = requireFaculty(facultyValue)
      const context = await repository.findStudentContext(studentId)
      if (!context) throw new ApiError(404, 'Talaba topilmadi')
      if (normalizeFaculty(context.faculty) !== faculty) {
        throw new ApiError(403, 'Boshqa fakultet talabasiga hujjat qo‘shib bo‘lmaydi')
      }
      const fields = await toWriteFields(input, context.faculty, Boolean(context.country))
      const created = await repository.insert(studentId, fields, role)
      return mapRow(created, tashkentToday())
    },
  }
}

export type ForeignDocsService = ReturnType<typeof createForeignDocsService>

export type { DocType, RegistrationBasis }
