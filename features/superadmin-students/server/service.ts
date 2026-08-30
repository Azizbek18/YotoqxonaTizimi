import 'server-only'
import { ApiError } from '@/server/http/api-error'
import { writeAuditLog } from '@/lib/audit-log'
import { sendStudentBlacklistEmail } from '@/lib/email'
import { PERMIT_FACULTIES, normalizeFaculty, permitFacultyLabel } from '@/lib/faculties'
import type {
  StudentActionResult,
  SuperadminStudentRow,
  SuperadminStudentsPage,
  SuperadminStudentsQuery,
} from '../types'
import { createSuperadminStudentsRepository, type SuperadminStudentsRepository } from './repository'

const FACULTY_SET = new Set(PERMIT_FACULTIES.map((f) => f.value))
const MAX_LIMIT = 100
const DEFAULT_LIMIT = 30
const REASON_MIN = 5
const REASON_MAX = 1000

// Clearing a bed: room, floor and captaincy always move together so the
// room map and the Sardorlar list never keep a stale resident.
const VACATE = { room_number: null, assigned_floor: null, is_floor_captain: false }

export function parseStudentsQuery(params: URLSearchParams): SuperadminStudentsQuery {
  const rawLimit = Number(params.get('limit'))
  const limit = Number.isInteger(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, MAX_LIMIT) : DEFAULT_LIMIT
  const rawOffset = Number(params.get('offset'))
  const offset = Number.isInteger(rawOffset) && rawOffset >= 0 ? rawOffset : 0
  const blacklisted = params.get('blacklisted')
  const placement = params.get('placement')
  const faculty = normalizeFaculty(params.get('faculty'))

  return {
    limit,
    offset,
    search: params.get('search')?.trim().slice(0, 120) || undefined,
    faculty: faculty && FACULTY_SET.has(faculty) ? faculty : undefined,
    status: params.get('status')?.trim() || undefined,
    blacklisted: blacklisted === 'true' ? true : blacklisted === 'false' ? false : undefined,
    placement: placement === 'placed' || placement === 'roomless' ? placement : undefined,
    unknownFacultyOnly: params.get('unknownFaculty') === 'true',
  }
}

type RawStudent = {
  id: string
  full_name: string | null
  email: string | null
  phone_number: string | null
  faculty: string | null
  direction: string | null
  course: number | null
  status: string | null
  room_number: string | null
  assigned_floor: number | null
  blacklisted: boolean | null
  created_at: string
}

function mapRow(r: RawStudent): SuperadminStudentRow {
  const code = normalizeFaculty(r.faculty)
  return {
    id: r.id,
    fullName: r.full_name?.trim() || '—',
    email: r.email,
    phone: r.phone_number,
    faculty: r.faculty,
    facultyLabel: code ? permitFacultyLabel(code) || r.faculty || '—' : r.faculty || '—',
    unknownFaculty: !code || !FACULTY_SET.has(code),
    direction: r.direction,
    course: r.course,
    status: r.status,
    roomNumber: r.room_number,
    assignedFloor: r.assigned_floor,
    blacklisted: Boolean(r.blacklisted),
    createdAt: r.created_at,
  }
}

export function createSuperadminStudentsService(
  repository: SuperadminStudentsRepository = createSuperadminStudentsRepository(),
) {
  async function requireStudent(id: string) {
    const student = await repository.findStudent(id)
    if (!student) throw new ApiError(404, 'Talaba topilmadi')
    if (student.role !== 'talaba') throw new ApiError(403, 'Bu hisob talaba emas')
    return student
  }

  function reasonOf(value: unknown, required: boolean) {
    const reason = typeof value === 'string' ? value.trim().slice(0, REASON_MAX) : ''
    if (required && reason.length < REASON_MIN) throw new ApiError(400, 'Sabab yozing (kamida 5 belgi)')
    return reason
  }

  return {
    async getPage(query: SuperadminStudentsQuery): Promise<SuperadminStudentsPage> {
      const [{ rows, total }, tallies] = await Promise.all([
        repository.list(query),
        repository.facultyTallies(),
      ])
      let students = (rows as RawStudent[]).map(mapRow)
      if (query.unknownFacultyOnly) students = students.filter((s) => s.unknownFaculty)

      const facultyCounts = PERMIT_FACULTIES.map((f) => ({
        faculty: f.value,
        facultyLabel: f.label,
        count: tallies.get(f.value) ?? 0,
      }))

      return { students, total, facultyCounts }
    },

    // Correct a student registered under the wrong faculty. The bed is
    // vacated — the room belonged to the old faculty's allocation; the new
    // faculty's dekan re-places them.
    async moveFaculty(idValue: unknown, facultyValue: unknown, actorId: string | null): Promise<StudentActionResult> {
      const id = typeof idValue === 'string' ? idValue.trim() : ''
      if (!id) throw new ApiError(400, 'Talaba tanlanmagan')
      const faculty = normalizeFaculty(typeof facultyValue === 'string' ? facultyValue : null)
      if (!faculty || !FACULTY_SET.has(faculty)) throw new ApiError(400, "Fakultet noto'g'ri")

      const student = await requireStudent(id)
      if (normalizeFaculty(student.faculty) === faculty) return { ok: true, message: 'Fakultet allaqachon shu' }

      const hadRoom = Boolean(student.room_number)
      const updated = await repository.updateStudent(id, { faculty, dorm_id: null, ...VACATE })
      if (!updated) throw new ApiError(409, "Talaba holati o'zgardi — sahifani yangilang")

      await writeAuditLog({
        eventType: 'student.faculty_move',
        status: 'success',
        actorUserId: actorId,
        targetRole: 'talaba',
        details: { studentId: id, from: student.faculty, to: faculty, roomVacated: hadRoom },
      })
      return {
        ok: true,
        message: `${student.full_name ?? 'Talaba'} → ${permitFacultyLabel(faculty)}${hadRoom ? ' (xona bo‘shatildi)' : ''}`,
      }
    },

    async setBlacklist(idValue: unknown, blacklisted: boolean, reasonValue: unknown, actorId: string | null): Promise<StudentActionResult> {
      const id = typeof idValue === 'string' ? idValue.trim() : ''
      if (!id) throw new ApiError(400, 'Talaba tanlanmagan')
      const reason = reasonOf(reasonValue, blacklisted)

      const student = await requireStudent(id)
      if (Boolean(student.blacklisted) === blacklisted) return { ok: true, message: 'Holat allaqachon shunday' }

      const updates = blacklisted ? { blacklisted, ...VACATE } : { blacklisted }
      const updated = await repository.updateStudent(id, updates)
      if (!updated) throw new ApiError(409, "Talaba holati o'zgardi — sahifani yangilang")

      await writeAuditLog({
        eventType: blacklisted ? 'student.blacklist' : 'student.unblacklist',
        status: 'success',
        actorUserId: actorId,
        targetRole: 'talaba',
        details: { studentId: id, faculty: student.faculty, reason: reason || null, via: 'superadmin' },
      })
      await sendStudentBlacklistEmail(student.email ?? '', student.full_name ?? 'Talaba', blacklisted, reason || undefined)
      return { ok: true, message: blacklisted ? 'Qora ro‘yxatga olindi' : 'Qora ro‘yxatdan chiqarildi' }
    },

    // Full expulsion: vacate the bed, deactivate the account, and
    // optionally bar re-application.
    async expel(idValue: unknown, reasonValue: unknown, alsoBlacklist: boolean, actorId: string | null): Promise<StudentActionResult> {
      const id = typeof idValue === 'string' ? idValue.trim() : ''
      if (!id) throw new ApiError(400, 'Talaba tanlanmagan')
      const reason = reasonOf(reasonValue, true)

      const student = await requireStudent(id)
      const updated = await repository.updateStudent(id, {
        status: 'inactive',
        ...VACATE,
        ...(alsoBlacklist ? { blacklisted: true } : {}),
      })
      if (!updated) throw new ApiError(409, "Talaba holati o'zgardi — sahifani yangilang")

      await writeAuditLog({
        eventType: 'student.expel',
        status: 'success',
        actorUserId: actorId,
        targetRole: 'talaba',
        details: { studentId: id, faculty: student.faculty, reason, blacklisted: alsoBlacklist, via: 'superadmin' },
      })
      await sendStudentBlacklistEmail(student.email ?? '', student.full_name ?? 'Talaba', true, reason)
      return { ok: true, message: `${student.full_name ?? 'Talaba'} yotoqxonadan chetlashtirildi` }
    },
  }
}
