import 'server-only'
import { ApiError } from '@/server/http/api-error'
import type { DekanDorm, DormFloor, DormFloorState, DormPreview, DormSetupInput } from '../types'
import { createDormRepository, type DormFloorRow, type DormRepository } from './repository'

export type DekanStaffCtx = { id: string; faculty: string }

const MAX_FLOORS = 50

function parseSetup(input: unknown): DormSetupInput {
  if (!input || typeof input !== 'object') throw new ApiError(400, "So'rov noto'g'ri")
  const s = input as Record<string, unknown>

  const number = typeof s.number === 'string' ? s.number.trim() : ''
  if (!number || number.length > 40) throw new ApiError(400, 'Yotoqxona raqami noto‘g‘ri')

  const floors = Array.isArray(s.floors)
    ? [...new Set(s.floors.map(Number))]
        .filter((n) => Number.isInteger(n) && n >= 1 && n <= MAX_FLOORS)
        .sort((a, b) => a - b)
    : []

  const floorCount = s.floorCount === undefined ? undefined : Number(s.floorCount)
  if (floorCount !== undefined && (!Number.isInteger(floorCount) || floorCount < 1 || floorCount > MAX_FLOORS)) {
    throw new ApiError(400, 'Qavatlar soni noto‘g‘ri')
  }
  const roomCapacity = s.roomCapacity === undefined ? undefined : Number(s.roomCapacity)
  if (roomCapacity !== undefined && (!Number.isInteger(roomCapacity) || roomCapacity < 1 || roomCapacity > 20)) {
    throw new ApiError(400, 'Xona sig‘imi noto‘g‘ri')
  }

  return { number, floors, floorCount, roomCapacity }
}

function floorState(
  row: DormFloorRow | undefined,
  myFaculty: string,
  iAmConfirmedInDorm: boolean,
): DormFloorState {
  const owner = row?.faculty ?? null
  const pending = row?.pending_faculty ?? null
  if (owner === myFaculty && !pending) return 'mine'
  if (pending === myFaculty) return 'mine_pending'
  if (pending && pending !== myFaculty && iAmConfirmedInDorm) return 'incoming'
  if (pending && pending !== myFaculty) return 'other_pending'
  if (owner && owner !== myFaculty) return 'other'
  return 'free'
}

export function createDormService(repository: DormRepository = createDormRepository()) {
  async function buildDekanDorm(staff: DekanStaffCtx): Promise<DekanDorm | null> {
    const dormId = await repository.facultyDormId(staff.faculty)
    if (!dormId) return null
    const dorm = await repository.getDorm(dormId)
    if (!dorm) return null

    const rows = await repository.listFloors(dormId)
    const byFloor = new Map(rows.map((r) => [r.floor_number, r]))
    const iAmConfirmed = rows.some((r) => r.faculty === staff.faculty)

    const floors: DormFloor[] = []
    for (let f = 1; f <= dorm.floor_count; f++) {
      const row = byFloor.get(f)
      floors.push({
        floor: f,
        ownerFaculty: row?.faculty ?? null,
        pendingFaculty: row?.pending_faculty ?? null,
        state: floorState(row, staff.faculty, iAmConfirmed),
      })
    }

    const coFaculties = [
      ...new Set(
        rows
          .map((r) => r.faculty)
          .filter((x): x is string => Boolean(x) && x !== staff.faculty),
      ),
    ]
    const incoming = floors
      .filter((f) => f.state === 'incoming')
      .map((f) => ({
        floor: f.floor,
        faculty: f.pendingFaculty as string,
        at: byFloor.get(f.floor)?.pending_at ?? '',
      }))

    return {
      dormId,
      number: dorm.number,
      name: dorm.name,
      floorCount: dorm.floor_count,
      faculty: staff.faculty,
      floors,
      coFaculties,
      incoming,
    }
  }

  return {
    /** The dekan's dorm + per-floor state, or null if not set up yet. */
    getDekanDorm(staff: DekanStaffCtx) {
      return buildDekanDorm(staff)
    },

    /** Preview a dorm by number so the onboarding picker can show which
     *  floors are already spoken for. A number nobody has used yet comes
     *  back `exists: false` with a default 5-floor grid. */
    async preview(staff: DekanStaffCtx, rawNumber: string): Promise<DormPreview> {
      const number = String(rawNumber ?? '').trim()
      if (!number || number.length > 40) throw new ApiError(400, 'Yotoqxona raqami noto‘g‘ri')

      const dorm = await repository.findDormByNumber(number)
      if (!dorm) {
        return {
          exists: false,
          number,
          name: '',
          floorCount: 5,
          floors: Array.from({ length: 5 }, (_, i) => ({
            floor: i + 1,
            ownerFaculty: null,
            pendingFaculty: null,
            taken: false,
          })),
        }
      }

      const rows = await repository.listFloors(dorm.id)
      const byFloor = new Map(rows.map((r) => [r.floor_number, r]))
      return {
        exists: true,
        number: dorm.number,
        name: dorm.name,
        floorCount: dorm.floor_count,
        floors: Array.from({ length: dorm.floor_count }, (_, i) => {
          const row = byFloor.get(i + 1)
          const owner = row?.faculty ?? null
          const pending = row?.pending_faculty ?? null
          return {
            floor: i + 1,
            ownerFaculty: owner,
            pendingFaculty: pending,
            // free for me to claim iff nobody else owns or is proposing it
            taken:
              (Boolean(owner) && owner !== staff.faculty) ||
              (Boolean(pending) && pending !== staff.faculty),
          }
        }),
      }
    },

    /**
     * Registration + Sozlamalar entry point. Links the faculty to a dorm
     * (creating the shell on first use) and (re-)claims the given floors.
     */
    async setUp(staff: DekanStaffCtx, input: unknown) {
      const parsed = parseSetup(input)
      const currentDormId = await repository.facultyDormId(staff.faculty)

      let dorm = await repository.findDormByNumber(parsed.number)
      if (!dorm) {
        dorm = await repository.createDorm({
          number: parsed.number,
          floorCount: parsed.floorCount ?? 5,
          roomCapacity: parsed.roomCapacity ?? 4,
        })
      }

      if (currentDormId && currentDormId !== dorm.id) {
        // Moving buildings is a superadmin operation once residents exist.
        const residents = await repository.facultyResidentCount(staff.faculty)
        if (residents > 0) {
          throw new ApiError(
            409,
            "Fakultetда xonaga joylashgan talabalar bor — yotoqxonani almashtirish uchun superadminga murojaat qiling.",
          )
        }
        await repository.withdrawFloors(currentDormId, staff.faculty, [])
      }

      await repository.linkFaculty(staff.faculty, dorm.id)
      await repository.setStaffDorm(staff.id, dorm.id)

      const floors = parsed.floors.length
        ? parsed.floors.filter((f) => f <= dorm!.floor_count)
        : Array.from({ length: dorm.floor_count }, (_, i) => i + 1)

      const result = await repository.claimFloors(dorm.id, staff.faculty, floors, staff.id)
      const state = await buildDekanDorm(staff)
      return { ...result, dorm: state }
    },

    /** The co-dekan confirms or rejects an incoming floor claim. */
    async resolve(staff: DekanStaffCtx, floor: number, accept: boolean) {
      if (!Number.isInteger(floor) || floor < 1) throw new ApiError(400, 'Qavat noto‘g‘ri')
      const dormId = await repository.facultyDormId(staff.faculty)
      if (!dormId) throw new ApiError(400, 'Sizga yotoqxona biriktirilmagan')

      const rows = await repository.listFloors(dormId)
      const row = rows.find((r) => r.floor_number === floor)
      if (!row || !row.pending_faculty || row.pending_faculty === staff.faculty) {
        throw new ApiError(404, 'Bu qavatда kutilayotgan taklif yo‘q')
      }
      if (!rows.some((r) => r.faculty === staff.faculty)) {
        throw new ApiError(403, 'Bu taklifni tasdiqlash sizga tegishli emas')
      }

      const outcome = await repository.resolveFloor(dormId, floor, staff.id, accept)
      const state = await buildDekanDorm(staff)
      return { ...outcome, dorm: state }
    },

    /** The proposer cancels their own pending claim(s). */
    async withdraw(staff: DekanStaffCtx, floors: number[]) {
      const dormId = await repository.facultyDormId(staff.faculty)
      if (!dormId) throw new ApiError(400, 'Sizga yotoqxona biriktirilmagan')
      const clean = Array.isArray(floors)
        ? floors.map(Number).filter((n) => Number.isInteger(n) && n >= 1)
        : []
      await repository.withdrawFloors(dormId, staff.faculty, clean)
      return buildDekanDorm(staff)
    },

    // ---- superadmin ----
    async listAll() {
      const [dorms, floors, links, residents] = await Promise.all([
        repository.listAllDorms(),
        repository.listAllFloors(),
        repository.listFacultyDorm(),
        repository.residentCountByDorm(),
      ])
      const facByDorm = new Map<string, string[]>()
      for (const l of links) {
        if (!facByDorm.has(l.dorm_id)) facByDorm.set(l.dorm_id, [])
        facByDorm.get(l.dorm_id)!.push(l.faculty)
      }
      const floorsByDorm = new Map<string, typeof floors>()
      for (const f of floors) {
        if (!floorsByDorm.has(f.dorm_id)) floorsByDorm.set(f.dorm_id, [])
        floorsByDorm.get(f.dorm_id)!.push(f)
      }
      return dorms.map((d) => {
        const df = new Map((floorsByDorm.get(d.id) ?? []).map((x) => [x.floor_number, x]))
        return {
          id: d.id,
          number: d.number,
          name: d.name,
          address: d.address,
          floorCount: d.floor_count,
          defaultRoomCapacity: d.default_room_capacity,
          ttjName: d.ttj_name,
          tarbiyachiName: d.tarbiyachi_name,
          tarbiyachiPhone: d.tarbiyachi_phone,
          komendantName: d.komendant_name,
          komendantPhone: d.komendant_phone,
          doctorName: d.doctor_name,
          doctorPhone: d.doctor_phone,
          securityPhone: d.security_phone,
          faculties: (facByDorm.get(d.id) ?? []).sort(),
          floors: Array.from({ length: d.floor_count }, (_, i) => {
            const row = df.get(i + 1)
            return { floor: i + 1, faculty: row?.faculty ?? null, pendingFaculty: row?.pending_faculty ?? null }
          }),
          residentCount: residents.get(d.id) ?? 0,
        }
      })
    },

    async create(input: unknown) {
      const s = (input ?? {}) as Record<string, unknown>
      const number = typeof s.number === 'string' ? s.number.trim() : ''
      if (!number || number.length > 40) throw new ApiError(400, 'Yotoqxona raqami noto‘g‘ri')
      const floorCount = Number(s.floorCount)
      if (!Number.isInteger(floorCount) || floorCount < 1 || floorCount > 50) {
        throw new ApiError(400, 'Qavatlar soni noto‘g‘ri')
      }
      const roomCapacity = s.roomCapacity === undefined ? 4 : Number(s.roomCapacity)
      if (!Number.isInteger(roomCapacity) || roomCapacity < 1 || roomCapacity > 20) {
        throw new ApiError(400, 'Xona sig‘imi noto‘g‘ri')
      }
      const existing = await repository.findDormByNumber(number)
      if (existing) throw new ApiError(409, 'Bu raqamli yotoqxona allaqachon mavjud')
      await repository.createDormShell({
        number,
        name: typeof s.name === 'string' ? s.name.trim().slice(0, 80) : '',
        floorCount,
        roomCapacity,
      })
    },

    async patchSettings(dormId: string, input: unknown) {
      const s = (input ?? {}) as Record<string, unknown>
      const patch: Record<string, unknown> = {}
      const str = (k: string, col: string, max = 100) => {
        if (typeof s[k] === 'string') patch[col] = (s[k] as string).trim().slice(0, max)
      }
      str('name', 'name', 80)
      str('address', 'address', 200)
      str('ttjName', 'ttj_name', 60)
      str('tarbiyachiName', 'tarbiyachi_name')
      str('tarbiyachiPhone', 'tarbiyachi_phone', 30)
      str('komendantName', 'komendant_name')
      str('komendantPhone', 'komendant_phone', 30)
      str('doctorName', 'doctor_name')
      str('doctorPhone', 'doctor_phone', 30)
      str('securityPhone', 'security_phone', 30)
      if (s.defaultRoomCapacity !== undefined) {
        const n = Number(s.defaultRoomCapacity)
        if (!Number.isInteger(n) || n < 1 || n > 20) throw new ApiError(400, 'Xona sig‘imi noto‘g‘ri')
        patch.default_room_capacity = n
      }
      if (s.floorCount !== undefined) {
        const n = Number(s.floorCount)
        if (!Number.isInteger(n) || n < 1 || n > 50) throw new ApiError(400, 'Qavatlar soni noto‘g‘ri')
        const floors = await repository.listAllFloors()
        const maxClaimed = Math.max(
          0,
          ...floors.filter((f) => f.dorm_id === dormId).map((f) => f.floor_number),
        )
        if (n < maxClaimed) {
          throw new ApiError(409, `Qavatlar soni ${maxClaimed} dan kam bo‘la olmaydi — ${maxClaimed}-qavat biriktirilgan`)
        }
        patch.floor_count = n
      }
      if (Object.keys(patch).length === 0) throw new ApiError(400, 'O‘zgartiriladigan maydon yo‘q')
      await repository.patchDorm(dormId, patch)
    },

    async reassignFloor(dormId: string, floor: number, faculty: string | null) {
      if (!Number.isInteger(floor) || floor < 1) throw new ApiError(400, 'Qavat noto‘g‘ri')
      const result = await repository.forceFloor(dormId, floor, faculty)
      if (result && 'blocked' in result && result.blocked > 0) {
        throw new ApiError(409, `${floor}-qavatda boshqa fakultetning ${result.blocked} ta talabasi bor — avval ularni ko‘chiring`)
      }
    },
  }
}

export type DormService = ReturnType<typeof createDormService>
