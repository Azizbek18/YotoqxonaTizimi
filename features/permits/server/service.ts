import 'server-only'
import { ApiError } from '@/server/http/api-error'
import { sendPermitApprovedEmail } from '@/lib/email'
import type { DekanOverview } from '../types'
import { createPermitAdminRepository, type PermitAdminRepository } from './repository'

function sameFaculty(value: string | null, faculty: string) {
  return (value ?? '').trim().toLocaleLowerCase() === faculty.trim().toLocaleLowerCase()
}

export function createPermitAdminService(repository: PermitAdminRepository = createPermitAdminRepository()) {
  return {
    async overview(facultyValue: string | null): Promise<DekanOverview> {
      const faculty = facultyValue?.trim()
      if (!faculty) throw new ApiError(403, 'Dekan fakulteti biriktirilmagan')
      const { permits, users } = await repository.load()
      const students = users.filter((user) => user.role === 'talaba')
      const scoped = permits.filter((permit) => sameFaculty(permit.faculty, faculty))
      const userByPassport = new Map(students.filter((user) => user.passport_series).map((user) => [user.passport_series, user]))
      const userByJshshir = new Map(students.filter((user) => user.jshshir).map((user) => [user.jshshir, user]))
      const requests = scoped.map((permit) => {
        const linked = userByPassport.get(permit.passport_series) ?? userByJshshir.get(permit.jshshir)
        return { ...permit, warning_count: linked?.warning_count ?? 0, blacklisted: linked?.blacklisted ?? false }
      })
      // Room occupancy/capacity math needs every occupant building-wide
      // (rooms aren't segregated by faculty), but a dekan must only see
      // the identifying details of students in their own faculty — PII AND
      // demographic/identifying metadata (auth id, faculty, direction,
      // course) for other faculties' occupants is redacted, not the whole
      // row, so occupancy counts and gender-conflict checks below still
      // work. Only `gender` survives redaction, since the room map's
      // mixed-gender warning genuinely needs it building-wide; a dekan
      // has no jurisdiction to act on another faculty's student, so their
      // auth id is dropped too (the UI's "remove from room" action keys off
      // it, and the server independently re-checks faculty ownership
      // anyway — this just stops the id from being visible at all).
      const studentsWithRooms = students.filter((user) => Boolean(user.room_number))
      const usersWithRooms = studentsWithRooms.map((user) => {
        const own = sameFaculty(user.faculty, faculty)
        return {
          id: own ? user.id : '',
          full_name: own ? user.full_name : '',
          passport_series: own ? user.passport_series : '',
          jshshir: own ? user.jshshir : '',
          phone_number: own ? user.phone_number : '',
          gender: user.gender,
          faculty: own ? user.faculty : null,
          direction: own ? user.direction : null,
          course: own ? user.course : null,
          room_number: user.room_number,
          warning_count: own ? user.warning_count : null,
        }
      })
      const approvedPermitsWithRooms = permits
        .filter((permit) => permit.status === 'approved' && permit.room_number)
        .map((permit) => {
          if (sameFaculty(permit.faculty, faculty)) return permit
          // Anonymous DTO for other-faculty occupants — every field the room
          // map/occupancy math actually needs, nothing that identifies them
          // (no name/passport/JShSHIR/phone/email/permit document link/auth
          // id/faculty/direction/course).
          // Built from scratch rather than spreading `permit` so a future
          // column added to permit_requests can't leak here by default.
          return {
            id: '',
            passport_series: '',
            jshshir: '',
            full_name: '',
            email: '',
            phone: '',
            gender: permit.gender,
            faculty: '',
            direction: '',
            course: 0,
            permit_url: '',
            status: permit.status,
            room_number: permit.room_number,
            reject_reason: null,
            created_at: '',
            updated_at: '',
            application_type: permit.application_type,
            relative_phone: '',
            origin_country: '',
            origin_region: '',
            study_type: null,
          }
        })
      const courses: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 }
      const faculties: Record<string, number> = Object.create(null)
      const addDistribution = (course: number | null, targetFaculty: string | null) => {
        if (course && courses[course] !== undefined) courses[course]++
        if (targetFaculty) faculties[targetFaculty] = (faculties[targetFaculty] ?? 0) + 1
      }
      permits.filter((permit) => permit.status === 'approved' || permit.status === 'registered')
        .forEach((permit) => addDistribution(permit.course, permit.faculty))
      // Sourced from the pre-redaction `studentsWithRooms`, not the
      // client-facing `usersWithRooms` — the latter has faculty/course
      // blanked out for other-faculty rows, which would otherwise silently
      // zero out this dashboard's cross-faculty distribution stats.
      studentsWithRooms.forEach((user) => addDistribution(user.course, user.faculty))
      return {
        faculty,
        requests,
        usersWithRooms,
        approvedPermitsWithRooms,
        dashboard: {
          pendingCount: scoped.filter((permit) => permit.status === 'pending').length,
          approvedCount: scoped.filter((permit) => permit.status === 'approved').length,
          rejectedCount: scoped.filter((permit) => permit.status === 'rejected').length,
          registeredCount: scoped.filter((permit) => permit.status === 'registered').length,
          activeStudentsCount: students.filter((user) => user.status === 'active').length,
          totalOccupiedBeds: usersWithRooms.length + approvedPermitsWithRooms.length,
          courseDistribution: Object.entries(courses).map(([course, talabalar]) => ({ course: `${course}-kurs`, talabalar })),
          facultyDistribution: Object.entries(faculties).map(([name, talabalar]) => ({ name, talabalar })),
          recentRequests: scoped.filter((permit) => permit.status === 'pending').slice(0, 5),
        },
      }
    },

    async update(facultyValue: string | null, value: unknown) {
      const faculty = facultyValue?.trim()
      if (!faculty) throw new ApiError(403, 'Dekan fakulteti biriktirilmagan')
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ApiError(400, 'So\'rov noto\'g\'ri')
      const input = value as Record<string, unknown>
      const id = typeof input.id === 'string' ? input.id.trim() : ''
      const action = input.action
      if (!id || (action !== 'approve' && action !== 'reject' && action !== 'cancel')) {
        throw new ApiError(400, 'So\'rov noto\'g\'ri')
      }
      const existing = await repository.find(id)
      if (!existing) throw new ApiError(404, 'Yo\'llanma topilmadi')
      if (!sameFaculty(existing.faculty, faculty)) throw new ApiError(403, 'Boshqa fakultet yo\'llanmasini boshqarib bo\'lmaydi')

      if (action === 'cancel') {
        // Undo an approval, back to the pending queue. Only reachable while
        // nobody has acted on it yet: once the applicant self-registers a
        // users row exists (pending or active), and pulling the approval
        // out from under an account is an expulsion, not an undo — that
        // goes through student management, not here.
        if (existing.status !== 'approved') {
          throw new ApiError(409, 'Faqat tasdiqlangan arizani bekor qilish mumkin')
        }
        const linked = await repository.findLinkedUser(existing.passport_series, existing.jshshir)
        if (linked) {
          throw new ApiError(409, 'Bu talaba allaqachon ro\'yxatdan o\'tgan — tasdiqni bekor qilib bo\'lmaydi. Uni chetlashtirish uchun Talabalar bo\'limidan foydalaning.')
        }
        // Also frees any room the dekan pre-reserved on this permit — that
        // bed counts as occupied for as long as status stays 'approved'
        // with a room_number set.
        const request = await repository.cancelApproval(id)
        if (!request) throw new ApiError(409, 'Ariza holati o\'zgardi — sahifani yangilang')
        return { success: true as const, request }
      }

      if (existing.status !== 'pending') {
        throw new ApiError(409, 'Bu yo\'llanma allaqachon ko\'rib chiqilgan')
      }
      if (action === 'approve') {
        // Approval only flips the status — it never picks a room itself.
        // The now-approved permit shows up in the room-assignment queue
        // (features/room-assignment) right away, though, so the dekan can
        // reserve a room for this person before they've even registered;
        // app/api/student/register/route.ts seeds the new account with
        // whatever room ends up on the permit by the time they do.
        const request = await repository.update(id, { status: 'approved', room_number: null, reject_reason: null })
        if (!request) throw new ApiError(409, 'Bu yo\'llanma allaqachon ko\'rib chiqilgan')
        // Xat yuborilmasa ham tasdiqlash kuchda qoladi — sendMail o'zi
        // xatolarni yutadi, shuning uchun bu yerda try/catch shart emas.
        await sendPermitApprovedEmail(request.email, request.full_name)
        return { success: true as const, request }
      }
      const reason = typeof input.reason === 'string' ? input.reason.trim().slice(0, 2000) : ''
      if (!reason) throw new ApiError(400, 'Rad etish sababi talab qilinadi')
      const request = await repository.update(id, { status: 'rejected', room_number: null, reject_reason: reason })
      return { success: true as const, request }
    },
  }
}
