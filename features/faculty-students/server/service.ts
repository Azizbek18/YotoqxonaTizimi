import 'server-only'
import { ApiError } from '@/server/http/api-error'
import { sendStudentBlacklistEmail, sendStudentWarningEmail } from '@/lib/email'
import { writeAuditLog } from '@/lib/audit-log'
import type {
  FacultyPaymentRecord,
  SendWarningResult,
  SetBlacklistResult,
  StudentProfileRow,
  StudentScope,
  StudentWarningLevel,
} from '../types'
import { STUDENT_SCOPES } from '../types'
import type { PaymentStatus } from '@/features/payments/types'
import { createFacultyStudentsRepository, type FacultyStudentsRepository } from './repository'

const WARNING_LEVELS = new Set<StudentWarningLevel>(['info', 'warning'])
const MESSAGE_MIN = 5
const MESSAGE_MAX = 1000

const WARNING_TITLES: Record<StudentWarningLevel, string> = {
  info: 'Eslatma (dekan)',
  warning: 'Rasmiy ogohlantirish (dekan)',
}

function sameFaculty(value: string | null | undefined, faculty: string) {
  return (value ?? '').trim().toLocaleLowerCase() === faculty.trim().toLocaleLowerCase()
}

function requireFaculty(facultyValue: string | null) {
  const faculty = facultyValue?.trim()
  if (!faculty) throw new ApiError(403, 'Dekan fakulteti biriktirilmagan')
  return faculty
}

export function createFacultyStudentsService(
  repository: FacultyStudentsRepository = createFacultyStudentsRepository(),
) {
  return {
    async listStudents(facultyValue: string | null, scopeValue?: string | null): Promise<StudentProfileRow[]> {
      const scope = STUDENT_SCOPES.includes(scopeValue as StudentScope)
        ? (scopeValue as StudentScope)
        : 'placed'
      return (await repository.listStudentProfiles(requireFaculty(facultyValue), scope)) as StudentProfileRow[]
    },

    async listPayments(facultyValue: string | null): Promise<FacultyPaymentRecord[]> {
      const ids = await repository.listFacultyStudentIds(requireFaculty(facultyValue))
      // `.in()` with an empty list is a valid query that matches nothing,
      // but skipping the round trip entirely keeps an empty faculty cheap.
      if (ids.length === 0) return []
      const rows = await repository.listPayments(ids)
      return rows.map((row) => ({
        id: String(row.id),
        student_id: String(row.student_id),
        month: String(row.month),
        year: Number(row.year),
        amount: Number(row.amount),
        status: row.status as PaymentStatus,
        admin_message: typeof row.admin_message === 'string' ? row.admin_message : undefined,
        has_receipt: Boolean(row.receipt_url),
        created_at: String(row.created_at),
      }))
    },

    async sendWarning(facultyValue: string | null, value: unknown): Promise<SendWarningResult> {
      const faculty = requireFaculty(facultyValue)
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ApiError(400, "So'rov noto'g'ri")
      const input = value as Record<string, unknown>

      const studentId = typeof input.studentId === 'string' ? input.studentId.trim() : ''
      if (!studentId) throw new ApiError(400, 'Talaba tanlanmagan')

      const level = (typeof input.level === 'string' ? input.level : '') as StudentWarningLevel
      if (!WARNING_LEVELS.has(level)) throw new ApiError(400, "Ogohlantirish darajasi noto'g'ri")

      const message = typeof input.message === 'string' ? input.message.trim().slice(0, MESSAGE_MAX) : ''
      if (message.length < MESSAGE_MIN) throw new ApiError(400, "Xabar matni juda qisqa")

      const student = await repository.findStudent(studentId)
      if (!student) throw new ApiError(404, 'Talaba topilmadi')
      if (student.role !== 'talaba') throw new ApiError(403, 'Faqat talabalarga ogohlantirish yuborish mumkin')
      if (!sameFaculty(student.faculty, faculty)) {
        throw new ApiError(403, "Boshqa fakultet talabasiga ogohlantirish yuborib bo'lmaydi")
      }

      let result: { warning_id: string; new_warning_count: number } | null
      try {
        result = await repository.createWarningAtomic(studentId, WARNING_TITLES[level], message, level)
      } catch (error) {
        // The RPC ships in migration 202607300000 — surface a fixable
        // message instead of a generic 500 if the database hasn't been
        // migrated yet, since that is the one realistic cause here.
        const code = (error as { code?: string } | null)?.code
        if (code === 'PGRST202' || code === '42883') {
          throw new ApiError(500, "Ogohlantirish funksiyasi bazada topilmadi — migratsiyani qo'llang")
        }
        throw error
      }
      if (!result) throw new ApiError(500, "Ogohlantirishni saqlab bo'lmadi")

      // Best-effort, same rule as lib/telegram.ts: a mail outage must not
      // undo a warning that is already recorded in the database.
      await sendStudentWarningEmail(student.email ?? '', student.full_name ?? 'Talaba', level, message)

      return { ok: true as const, level, warningCount: Number(result.new_warning_count) }
    },

    async setBlacklist(
      facultyValue: string | null,
      value: unknown,
      actorId: string | null = null,
    ): Promise<SetBlacklistResult> {
      const faculty = requireFaculty(facultyValue)
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ApiError(400, "So'rov noto'g'ri")
      const input = value as Record<string, unknown>

      const studentId = typeof input.studentId === 'string' ? input.studentId.trim() : ''
      if (!studentId) throw new ApiError(400, 'Talaba tanlanmagan')
      if (typeof input.blacklisted !== 'boolean') throw new ApiError(400, "So'rov noto'g'ri")
      const blacklisted = input.blacklisted
      const reason = typeof input.reason === 'string' ? input.reason.trim().slice(0, MESSAGE_MAX) : ''
      if (blacklisted && reason.length < MESSAGE_MIN) throw new ApiError(400, 'Chetlatish sababini yozing')

      const student = await repository.findStudent(studentId)
      if (!student) throw new ApiError(404, 'Talaba topilmadi')
      if (student.role !== 'talaba') throw new ApiError(403, 'Faqat talabalarni chetlatish mumkin')
      if (!sameFaculty(student.faculty, faculty)) {
        throw new ApiError(403, "Boshqa fakultet talabasini chetlatib bo'lmaydi")
      }
      if (Boolean(student.blacklisted) === blacklisted) {
        // Idempotent — the button just reflects stale UI state.
        return { ok: true as const, blacklisted }
      }

      const updated = await repository.setBlacklist(studentId, blacklisted)
      if (!updated) throw new ApiError(409, "Talaba holati o'zgardi — sahifani yangilang")

      await writeAuditLog({
        eventType: blacklisted ? 'student.blacklist' : 'student.unblacklist',
        status: 'success',
        actorUserId: actorId,
        targetRole: 'talaba',
        details: { studentId, faculty, reason: reason || null },
      })

      // Best-effort — the bar is already in the database.
      await sendStudentBlacklistEmail(
        student.email ?? '',
        student.full_name ?? 'Talaba',
        blacklisted,
        reason || undefined,
      )

      return { ok: true as const, blacklisted }
    },
  }
}
