import { ApiError } from '@/server/http/api-error'
import { tashkentDateString } from '@/lib/tashkent-time'
import type { HomeLeaveRow } from '@/types/database.generated'
import type { AttendanceActor } from '@/features/attendance/types'
import { distanceKm, initialLeaveStatus, leaveDays, leaveInEffect, parseLeaveInput } from '../domain'
import { LEAVE_NEAR_KM, type HomeLeave, type HomeLeaveStaffRow, type LeaveCallResult } from '../types'
import { createHomeLeaveRepository, type HomeLeaveRepository, type LeaveWithStudent } from './repository'

const MAX_OPEN_LEAVES = 3
const CALL_RESULTS: readonly LeaveCallResult[] = ['ok', 'no_answer', 'denied']

export function toHomeLeave(row: HomeLeaveRow): HomeLeave {
  return {
    id: row.id,
    destinationKind: row.destination_kind,
    destinationAddress: row.destination_address,
    destinationLat: row.destination_lat,
    destinationLng: row.destination_lng,
    contactName: row.contact_name,
    contactPhone: row.contact_phone,
    reason: row.reason,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    status: row.status,
    locStatus: row.loc_status,
    callResult: row.call_result,
    callByName: row.call_by_name,
    decidedByName: row.decided_by_name,
    decisionNote: row.decision_note,
    returnedAt: row.returned_at,
    createdAt: row.created_at,
  }
}

function toStaffRow(row: LeaveWithStudent, today: string): HomeLeaveStaffRow {
  return {
    ...toHomeLeave(row),
    studentId: row.student_id,
    studentName: row.users?.full_name ?? 'Talaba',
    roomNumber: row.users?.room_number ?? null,
    floor: row.users?.assigned_floor ?? null,
    inEffect: leaveInEffect(row, today),
  }
}

/** Xodim shu talabaning arizasini ko'rishga haqlimi (bino/qavat/jins/blok ko'lami). */
function actorCoversStudent(actor: AttendanceActor, student: LeaveWithStudent['users']): boolean {
  if (!student || student.dorm_id !== actor.dormId) return false
  if (!student.faculty || !actor.faculties.includes(student.faculty)) return false
  if (actor.role === 'sardor') {
    if (student.assigned_floor !== actor.floor) return false
    if (student.gender !== actor.gender) return false
    if ((student.block ?? null) !== (actor.block ?? null)) return false
  } else if (actor.gender && student.gender !== actor.gender) {
    return false
  }
  return true
}

export function createHomeLeaveService(repo: HomeLeaveRepository = createHomeLeaveRepository()) {
  async function ownedLeave(studentId: string, id: string): Promise<LeaveWithStudent> {
    const leave = await repo.getById(id)
    if (!leave || leave.student_id !== studentId) throw new ApiError(404, 'Ariza topilmadi')
    return leave
  }

  return {
    async listForStudent(studentId: string): Promise<HomeLeave[]> {
      return (await repo.listForStudent(studentId)).map(toHomeLeave)
    },

    /** Talaba uyga ketish arizasini yuboradi. */
    async create(studentId: string, body: unknown, now: Date = new Date()) {
      const today = tashkentDateString(now)
      const input = parseLeaveInput(body, today)

      const student = await repo.findStudent(studentId)
      if (!student || student.status !== 'active') throw new ApiError(403, 'Faol talaba topilmadi')
      if (student.is_off_campus || !student.dorm_id) {
        throw new ApiError(403, 'Uyga ketish arizasi faqat yotoqxonada yashovchi talabalar uchun')
      }

      const open = await repo.openForStudent(studentId, today)
      if (open.length >= MAX_OPEN_LEAVES) {
        throw new ApiError(429, 'Sizda tugamagan arizalar ko‘p — avval ularni yakunlang')
      }
      if (open.some((l) => l.starts_on <= input.endsOn && input.startsOn <= l.ends_on)) {
        throw new ApiError(409, 'Bu sanalarda sizda boshqa ariza bor')
      }

      const status = initialLeaveStatus(leaveDays(input.startsOn, input.endsOn), await repo.hadSuspicious(studentId))
      const row = await repo.insert(studentId, {
        destination_kind: input.destinationKind,
        destination_address: input.destinationAddress,
        destination_lat: input.destinationLat ?? null,
        destination_lng: input.destinationLng ?? null,
        contact_name: input.contactName,
        contact_phone: input.contactPhone,
        reason: input.reason ?? null,
        starts_on: input.startsOn,
        ends_on: input.endsOn,
        status,
        consented_at: now.toISOString(),
      })
      if (leaveInEffect(row, today)) await repo.markOpenSessions(studentId)
      return { leave: toHomeLeave(row), studentName: student.full_name ?? 'Talaba', needsReview: status === 'pending' }
    },

    /** Talaba arizani bekor qiladi (ketmadi) yoki qaytganini bildiradi. */
    async finish(studentId: string, id: string, action: 'cancel' | 'return', now: Date = new Date()) {
      const leave = await ownedLeave(studentId, id)
      const allowed: HomeLeaveRow['status'][] = action === 'return' ? ['active'] : ['pending', 'active']
      if (!allowed.includes(leave.status)) throw new ApiError(409, 'Bu arizani endi o‘zgartirib bo‘lmaydi')
      const updated = await repo.update(id, allowed, {
        status: action === 'return' ? 'returned' : 'cancelled',
        returned_at: action === 'return' ? now.toISOString() : null,
      })
      if (!updated) throw new ApiError(409, 'Ariza allaqachon o‘zgargan')
      // "Uyda" belgisi olinadi — talaba yo'qlamada o'zini odatiy usulda tasdiqlaydi.
      await repo.releaseOpenSessions(studentId)
      return toHomeLeave(updated)
    },

    /**
     * Ixtiyoriy: talaba joylashuvini yuboradi. Manzil xaritadan tanlangan bo'lsa
     * unga yaqinligi tekshiriladi, aks holda faqat "yuborildi" deb yoziladi.
     * Aniq koordinata saqlanmaydi (≈1 km aniqlikda yaxlitlanadi).
     */
    async shareLocation(studentId: string, id: string, body: { lat?: unknown; lng?: unknown }, now: Date = new Date()) {
      const leave = await ownedLeave(studentId, id)
      if (!['active', 'pending'].includes(leave.status)) throw new ApiError(409, 'Bu ariza yakunlangan')
      const { lat, lng } = body
      if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng)
        || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
        throw new ApiError(400, 'Joylashuv noto‘g‘ri')
      }
      let locStatus: 'near' | 'far' | 'shared' = 'shared'
      if (leave.destination_lat != null && leave.destination_lng != null) {
        const km = distanceKm({ lat, lng }, { lat: leave.destination_lat, lng: leave.destination_lng })
        locStatus = km <= LEAVE_NEAR_KM ? 'near' : 'far'
      }
      const updated = await repo.patchMeta(id, {
        loc_status: locStatus,
        loc_lat: Math.round(lat * 100) / 100,
        loc_lng: Math.round(lng * 100) / 100,
        loc_at: now.toISOString(),
      })
      if (!updated) throw new ApiError(409, 'Ariza allaqachon o‘zgargan')
      return toHomeLeave(updated)
    },

    /** Yo'qlama ekranida: talaba hozir "Uyda"mi. */
    async isOnLeave(studentId: string, now: Date = new Date()): Promise<boolean> {
      return (await repo.activeStudentIds([studentId], tashkentDateString(now))).has(studentId)
    },

    /** Tarbiyachi / sardor / dekan: o'z ko'lamidagi tugamagan arizalar. */
    async listForActor(actor: AttendanceActor, now: Date = new Date()): Promise<HomeLeaveStaffRow[]> {
      const today = tashkentDateString(now)
      const rows = await repo.listForScope(
        {
          dormId: actor.dormId,
          faculties: actor.faculties,
          floor: actor.role === 'sardor' ? actor.floor : undefined,
          gender: actor.role === 'sardor' ? actor.gender : (actor.gender ?? undefined),
          block: actor.role === 'sardor' ? actor.block ?? null : undefined,
        },
        today,
      )
      return rows.map((r) => toStaffRow(r, today))
    },

    /** Xodim aloqa shaxsiga qo'ng'iroq natijasini yozadi. */
    async recordCall(actor: AttendanceActor, actorName: string, id: string, result: unknown, now: Date = new Date()) {
      if (!actor.canWrite) throw new ApiError(403, 'Sizda bu amal uchun huquq yo‘q')
      if (!CALL_RESULTS.includes(result as LeaveCallResult)) throw new ApiError(400, 'Natija noto‘g‘ri')
      const leave = await repo.getById(id)
      if (!leave || !actorCoversStudent(actor, leave.users)) throw new ApiError(404, 'Ariza topilmadi')
      const updated = await repo.patchMeta(id, {
        call_result: result as LeaveCallResult,
        call_by_name: actorName.slice(0, 120),
        call_at: now.toISOString(),
      })
      if (!updated) throw new ApiError(409, 'Ariza yakunlangan')
      return toHomeLeave(updated)
    },

    async listForFaculty(faculty: string, now: Date = new Date()): Promise<HomeLeaveStaffRow[]> {
      const today = tashkentDateString(now)
      return (await repo.listForFaculty(faculty, today)).map((r) => toStaffRow(r, today))
    },

    /** Dekan uzoq muddatli / shubhali arizani tasdiqlaydi yoki rad etadi. */
    async decide(
      id: string,
      faculty: string,
      staff: { id: string; full_name?: string | null },
      body: { action?: unknown; note?: unknown },
      now: Date = new Date(),
    ) {
      const leave = await repo.getById(id)
      if (!leave || (leave.users?.faculty ?? '').toLowerCase() !== faculty.toLowerCase()) {
        throw new ApiError(403, 'Bu ariza sizning fakultetingizga tegishli emas')
      }
      if (leave.status !== 'pending') throw new ApiError(409, 'Ariza allaqachon ko‘rib chiqilgan')
      const approve = body.action === 'approve'
      if (!approve && body.action !== 'reject') throw new ApiError(400, 'Amal noto‘g‘ri')
      const note = typeof body.note === 'string' ? body.note.trim().slice(0, 300) : ''
      if (!approve && note.length < 3) throw new ApiError(400, 'Rad etish sababini yozing')

      const updated = await repo.update(id, ['pending'], {
        status: approve ? 'active' : 'rejected',
        decided_by: staff.id,
        decided_by_name: staff.full_name ?? 'Dekan',
        decided_at: now.toISOString(),
        decision_note: note || null,
      })
      if (!updated) throw new ApiError(409, 'Ariza allaqachon ko‘rib chiqilgan')
      if (approve && leaveInEffect(updated, tashkentDateString(now))) await repo.markOpenSessions(leave.student_id)
      return { leave: toHomeLeave(updated), studentId: leave.student_id }
    },
  }
}

export type HomeLeaveService = ReturnType<typeof createHomeLeaveService>
