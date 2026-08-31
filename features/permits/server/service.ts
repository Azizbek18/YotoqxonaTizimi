import 'server-only'
import { ApiError } from '@/server/http/api-error'
import { sendPermitApprovalCancelledEmail, sendPermitApprovedEmail } from '@/lib/email'
import { writeAuditLog } from '@/lib/audit-log'
import { createRoomLayoutRepository } from '@/features/room-layout/server/repository'
import { createAppSettingsService } from '@/features/app-settings/server/service'
import { summariseBeds } from '@/lib/room-capacity'
import { PERMIT_FACULTIES } from '@/lib/faculties'
import type { DekanOverview } from '../types'
import { createPermitAdminRepository, type PermitAdminRepository } from './repository'
import { notifyPermitTelegram } from '@/lib/permit-telegram'

function sameFaculty(value: string | null, faculty: string) {
  return (value ?? '').trim().toLocaleLowerCase() === faculty.trim().toLocaleLowerCase()
}

async function notifyTelegramWithoutBreakingDecision(request: Awaited<ReturnType<PermitAdminRepository['find']>>) {
  if (!request) return
  try {
    await notifyPermitTelegram(request)
  } catch (error) {
    // A Telegram outage must never roll back a dean's database decision.
    console.error('Permit Telegram notification failed:', error)
  }
}

// Only what overview() needs for its bed-capacity maths — kept narrow so
// the service test can stub it without a Supabase client.
type CapacityDeps = {
  roomLayout?: { listAllRooms: (faculty: string) => Promise<Array<{ room_number: string; frozen: boolean; capacity: number | null }>> }
  appSettings?: { get: (faculty: string) => Promise<{ defaultRoomCapacity: number }> }
}

export function createPermitAdminService(
  repository: PermitAdminRepository = createPermitAdminRepository(),
  capacityDeps: CapacityDeps = {},
) {
  return {
    async overview(facultyValue: string | null): Promise<DekanOverview> {
      const faculty = facultyValue?.trim()
      if (!faculty) throw new ApiError(403, 'Dekan fakulteti biriktirilmagan')
      // repository.load already scopes both permits and students to this
      // faculty — nothing here is building-wide any more.
      const { permits, users: students } = await repository.load(faculty)
      const userByPassport = new Map(students.filter((user) => user.passport_series).map((user) => [user.passport_series, user]))
      const userByJshshir = new Map(students.filter((user) => user.jshshir).map((user) => [user.jshshir, user]))
      const requests = permits.map((permit) => {
        const linked = userByPassport.get(permit.passport_series) ?? userByJshshir.get(permit.jshshir)
        return { ...permit, warning_count: linked?.warning_count ?? 0, blacklisted: linked?.blacklisted ?? false }
      })

      const studentsWithRooms = students.filter((user) => Boolean(user.room_number))
      const usersWithRooms = studentsWithRooms.map((user) => ({
        id: user.id,
        full_name: user.full_name,
        passport_series: user.passport_series,
        jshshir: user.jshshir,
        phone_number: user.phone_number,
        gender: user.gender,
        faculty: user.faculty,
        direction: user.direction,
        course: user.course,
        room_number: user.room_number,
        warning_count: user.warning_count,
      }))
      const approvedPermitsWithRooms = permits.filter(
        (permit) => permit.status === 'approved' && permit.room_number,
      )

      // Real bed capacity for THIS dekan's scope — the rooms on their own
      // floors (shared-dorm aware via listAllRooms), each room's own
      // capacity override, and frozen rooms excluded: a room in ta'mirlash
      // is not a free bed, even if empty.
      const [scopedRooms, appSettings] = await Promise.all([
        (capacityDeps.roomLayout ?? createRoomLayoutRepository()).listAllRooms(faculty),
        (capacityDeps.appSettings ?? createAppSettingsService()).get(faculty),
      ])
      const defaultCapacity = appSettings.defaultRoomCapacity
      const occByRoom = new Map<string, number>()
      const bumpRoom = (roomNumber: string | null | undefined) => {
        if (!roomNumber) return
        occByRoom.set(roomNumber, (occByRoom.get(roomNumber) ?? 0) + 1)
      }
      studentsWithRooms.forEach((user) => bumpRoom(user.room_number))
      approvedPermitsWithRooms.forEach((permit) => bumpRoom(permit.room_number))

      const { availableBeds, freeBeds, frozenRoomCount } = summariseBeds(scopedRooms, defaultCapacity, occByRoom)

      const courses: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 }
      const faculties: Record<string, number> = Object.create(null)
      const addDistribution = (course: number | null, targetFaculty: string | null) => {
        if (course && courses[course] !== undefined) courses[course]++
        if (targetFaculty) faculties[targetFaculty] = (faculties[targetFaculty] ?? 0) + 1
      }
      permits.filter((permit) => permit.status === 'approved' || permit.status === 'registered')
        .forEach((permit) => addDistribution(permit.course, permit.faculty))
      studentsWithRooms.forEach((user) => addDistribution(user.course, user.faculty))

      return {
        faculty,
        requests,
        usersWithRooms,
        approvedPermitsWithRooms,
        dashboard: {
          pendingCount: permits.filter((permit) => permit.status === 'pending').length,
          approvedCount: permits.filter((permit) => permit.status === 'approved').length,
          rejectedCount: permits.filter((permit) => permit.status === 'rejected').length,
          registeredCount: permits.filter((permit) => permit.status === 'registered').length,
          activeStudentsCount: students.filter((user) => user.status === 'active').length,
          totalOccupiedBeds: usersWithRooms.length + approvedPermitsWithRooms.length,
          availableBeds,
          freeBeds,
          frozenRoomCount,
          courseDistribution: Object.entries(courses).map(([course, talabalar]) => ({ course: `${course}-kurs`, talabalar })),
          facultyDistribution: Object.entries(faculties).map(([name, talabalar]) => ({ name, talabalar })),
          recentRequests: permits.filter((permit) => permit.status === 'pending').slice(0, 5),
        },
      }
    },

    /**
     * Cross-faculty overview for a superadmin in global scope. Merges every
     * faculty's `overview()` — 13 faculties of tiny early-stage data, so the
     * fan-out is fine; revisit with an aggregation RPC at scale.
     */
    async overviewGlobal(): Promise<DekanOverview> {
      const slices = await Promise.all(
        PERMIT_FACULTIES.map(async ({ value, label }) => ({ value, label, data: await this.overview(value) })),
      )

      const sum = (pick: (d: DekanOverview['dashboard']) => number) =>
        slices.reduce((total, s) => total + pick(s.data.dashboard), 0)
      const mergeDist = (key: 'courseDistribution' | 'facultyDistribution') => {
        const acc = new Map<string, number>()
        for (const s of slices) {
          for (const row of s.data.dashboard[key]) {
            const label = key === 'courseDistribution'
              ? (row as { course: string }).course
              : (row as { name: string }).name
            acc.set(label, (acc.get(label) ?? 0) + row.talabalar)
          }
        }
        return [...acc.entries()].map(([k, talabalar]) =>
          key === 'courseDistribution' ? { course: k, talabalar } : { name: k, talabalar })
      }

      return {
        faculty: '*',
        perFaculty: slices.map((s) => ({
          faculty: s.value,
          facultyLabel: s.label,
          pendingCount: s.data.dashboard.pendingCount,
          activeStudentsCount: s.data.dashboard.activeStudentsCount,
          totalOccupiedBeds: s.data.dashboard.totalOccupiedBeds,
          availableBeds: s.data.dashboard.availableBeds,
          freeBeds: s.data.dashboard.freeBeds,
        })),
        requests: slices.flatMap((s) => s.data.requests),
        usersWithRooms: slices.flatMap((s) => s.data.usersWithRooms),
        approvedPermitsWithRooms: slices.flatMap((s) => s.data.approvedPermitsWithRooms),
        dashboard: {
          pendingCount: sum((d) => d.pendingCount),
          approvedCount: sum((d) => d.approvedCount),
          rejectedCount: sum((d) => d.rejectedCount),
          registeredCount: sum((d) => d.registeredCount),
          activeStudentsCount: sum((d) => d.activeStudentsCount),
          totalOccupiedBeds: sum((d) => d.totalOccupiedBeds),
          availableBeds: sum((d) => d.availableBeds),
          freeBeds: sum((d) => d.freeBeds),
          frozenRoomCount: sum((d) => d.frozenRoomCount),
          courseDistribution: mergeDist('courseDistribution') as { course: string; talabalar: number }[],
          facultyDistribution: mergeDist('facultyDistribution') as { name: string; talabalar: number }[],
          recentRequests: slices
            .flatMap((s) => s.data.dashboard.recentRequests)
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .slice(0, 5),
        },
      }
    },

    async update(facultyValue: string | null, value: unknown, actorId: string | null = null) {
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

      const audit = (details: Record<string, unknown> = {}) =>
        writeAuditLog({ eventType: `permit.${action}`, status: 'success', actorUserId: actorId, targetRole: 'talaba', details: { permitId: id, faculty, ...details } })

      if (action === 'cancel') {
        // Undo an approval, back to the pending queue. An account that has
        // already verified its email ('active') belongs to a real resident —
        // pulling the approval then is an expulsion, not an undo, and goes
        // through student management. But a still-'pending' account is just
        // a premature self-registration; we delete it here so the dekan
        // isn't left stuck.
        if (existing.status !== 'approved') {
          throw new ApiError(409, 'Faqat tasdiqlangan arizani bekor qilish mumkin')
        }
        const linked = await repository.findLinkedUser(existing.passport_series, existing.jshshir)
        if (linked && (linked.status !== 'pending' || !sameFaculty(linked.faculty, faculty))) {
          throw new ApiError(409, "Bu talaba allaqachon ro'yxatdan o'tib, hisobini tasdiqlagan — endi yo'llanma tasdig'ini bekor qilib bo'lmaydi. Talabani xonadan chiqarish kerak bo'lsa, «Xonalar» bo'limidan foydalaning; hisobni butunlay o'chirish esa administrator orqali amalga oshiriladi.")
        }
        if (linked) await repository.deletePendingStudent(linked.id)
        // Also frees any room the dekan pre-reserved on this permit — that
        // bed counts as occupied for as long as status stays 'approved'
        // with a room_number set.
        const request = await repository.cancelApproval(id)
        if (!request) throw new ApiError(409, 'Ariza holati o\'zgardi — sahifani yangilang')
        await sendPermitApprovalCancelledEmail(existing.email, existing.full_name)
        await notifyTelegramWithoutBreakingDecision(request)
        await audit({ deletedPendingUserId: linked?.id ?? null })
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
        await sendPermitApprovedEmail(request.email, request.full_name, request.application_type)
        await notifyTelegramWithoutBreakingDecision(request)
        await audit()
        return { success: true as const, request }
      }
      const reason = typeof input.reason === 'string' ? input.reason.trim().slice(0, 2000) : ''
      if (!reason) throw new ApiError(400, 'Rad etish sababi talab qilinadi')
      const request = await repository.update(id, { status: 'rejected', room_number: null, reject_reason: reason })
      await notifyTelegramWithoutBreakingDecision(request)
      await audit()
      return { success: true as const, request }
    },

    /**
     * Superadmin cross-faculty step-in: approve / reject / cancel a permit
     * for whichever faculty owns it — used when a faculty has no active dean
     * and its queue would otherwise be stuck. Resolves the permit's own
     * faculty, then defers to update() so every sameFaculty() guard and the
     * audit log still bind to the real faculty.
     */
    async updateGlobal(value: unknown, actorId: string | null = null) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ApiError(400, 'So\'rov noto\'g\'ri')
      const id = typeof (value as Record<string, unknown>).id === 'string'
        ? String((value as Record<string, unknown>).id).trim()
        : ''
      if (!id) throw new ApiError(400, 'So\'rov noto\'g\'ri')
      const existing = await repository.find(id)
      if (!existing) throw new ApiError(404, 'Yo\'llanma topilmadi')
      if (!existing.faculty) throw new ApiError(409, 'Bu yo\'llanmaga fakultet biriktirilmagan')
      return this.update(existing.faculty, value, actorId)
    },
  }
}
