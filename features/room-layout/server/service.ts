import 'server-only'
import { ApiError } from '@/server/http/api-error'
import { normalizeGender } from '@/lib/gender'
import type { FloorRoomPlan, RoomBlockSide, RoomBlockSize, RoomFloorStatus, RoomLayoutBlock, RoomNumbering } from '../types'
import { MAX_ROOMS_PER_FLOOR, compareRoomNumbers } from '../plan'
import { createRoomLayoutRepository, type RoomLayoutRepository } from './repository'

const VALID_SIDES: RoomBlockSide[] = ['left', 'right']
const VALID_SIZES: RoomBlockSize[] = ['small', 'medium', 'large']

export const MAX_ROOM_CAPACITY = 20

// Forward an optional dormId (targets one of the faculty's several
// buildings, 202609300000) as a real trailing arg only when present, so a
// call made without one has the EXACT same shape as before this parameter
// existed — every repository call site below stays byte-identical, and its
// tests, when dormId is omitted (the vast majority of callers today).
const withDorm = (dormId?: string) => (dormId ? [dormId] as const : [] as const)

// null / undefined / '' -> null (inherit the dorm default). Any other value
// must be a whole number in [1, MAX_ROOM_CAPACITY].
function parseCapacity(value: unknown, label: string): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  if (!Number.isInteger(n) || n < 1 || n > MAX_ROOM_CAPACITY) {
    throw new ApiError(400, `${label} noto'g'ri (1–${MAX_ROOM_CAPACITY})`)
  }
  return n
}

// null / undefined / '' -> null (undeclared, any gender allowed). Anything
// else must resolve to 'male' / 'female' via the shared normaliser.
function parseGender(value: unknown): 'male' | 'female' | null {
  if (value === null || value === undefined || value === '') return null
  const normalized = normalizeGender(typeof value === 'string' ? value : String(value))
  if (!normalized) throw new ApiError(400, "Xona jinsi noto'g'ri")
  return normalized
}

function parseFloorNumber(value: unknown) {
  const floorNumber = Number(value)
  if (!Number.isInteger(floorNumber) || floorNumber < 1) {
    throw new ApiError(400, "Qavat raqami noto'g'ri")
  }
  return floorNumber
}

function parseFloorPlans(value: unknown): FloorRoomPlan[] {
  if (!Array.isArray(value) || value.length === 0) throw new ApiError(400, "Qavatlar ro'yxati noto'g'ri")

  const seen = new Set<number>()
  return value.map((item) => {
    const input = (item ?? {}) as Record<string, unknown>
    const floor = Number(input.floor)
    if (!Number.isInteger(floor) || floor < 1 || floor > 50) {
      throw new ApiError(400, "Qavat raqami noto'g'ri")
    }
    if (seen.has(floor)) throw new ApiError(400, `${floor}-qavat ikki marta kiritilgan`)
    seen.add(floor)

    const rooms = Number(input.rooms)
    if (!Number.isInteger(rooms) || rooms < 0 || rooms > MAX_ROOMS_PER_FLOOR) {
      throw new ApiError(400, `${floor}-qavatdagi xonalar soni noto'g'ri`)
    }
    return { floor, rooms }
  })
}

function parseBlocks(value: unknown): RoomLayoutBlock[] {
  if (!Array.isArray(value)) throw new ApiError(400, "So'rov noto'g'ri")

  const seen = new Set<string>()
  const sideCounters: Record<RoomBlockSide, number> = { left: 0, right: 0 }

  return value.map((item, index) => {
    if (!item || typeof item !== 'object') throw new ApiError(400, `${index + 1}-xona ma'lumoti noto'g'ri`)
    const input = item as Record<string, unknown>

    const roomNumber = typeof input.roomNumber === 'string' ? input.roomNumber.trim().slice(0, 20) : ''
    if (!roomNumber) throw new ApiError(400, `${index + 1}-xona raqami kiritilmagan`)
    if (seen.has(roomNumber)) throw new ApiError(400, `${roomNumber}-xona raqami takrorlangan`)
    seen.add(roomNumber)

    const side = input.side as RoomBlockSide
    if (!VALID_SIDES.includes(side)) throw new ApiError(400, `${roomNumber}-xona uchun tomon noto'g'ri`)

    const size = input.size as RoomBlockSize
    if (!VALID_SIZES.includes(size)) throw new ApiError(400, `${roomNumber}-xona uchun o'lcham noto'g'ri`)

    const capacity = parseCapacity(input.capacity, `${roomNumber}-xona sig'imi`)

    const position = sideCounters[side]++
    return { roomNumber, side, size, position, capacity }
  })
}

export function createRoomLayoutService(repository: RoomLayoutRepository = createRoomLayoutRepository()) {
  return {
    /**
     * Lays the whole building out to match the "nechta xona per qavat"
     * targets the dekan typed. Unlike a plain top-up this RENUMBERS: with
     * 'sequential' the building becomes one contiguous 1..N run in floor
     * order (floor 1 = 1..c1, floor 2 = c1+1..c1+c2, …); with 'per-floor'
     * each floor is N01..N{cN}. Only EMPTY rooms move / are created / are
     * dropped — a room with a resident or approved permit keeps its exact
     * number, and its floor's numbering flows around it. If a resident's
     * room can't keep its number (it would fall outside the floor's new
     * range, or the floor now has fewer rooms than residents) the whole
     * operation is refused and the offending room numbers are reported.
     * See migration 20260902080254 (apply_building_layout).
     */
    async generateFloors(faculty: string, plansValue: unknown, numberingValue: unknown, dormId?: string) {
      const plans = parseFloorPlans(plansValue)
      const numbering: RoomNumbering = numberingValue === 'per-floor' ? 'per-floor' : 'sequential'

      // Any floor that has rooms but isn't in the dekan's plan still has to
      // be part of the sequential run (so its numbers don't collide) — carry
      // it at its current count so nothing on it changes.
      const existingRooms = await repository.listAllRooms(faculty, ...withDorm(dormId))
      const countByFloor = new Map<number, number>()
      for (const row of existingRooms) {
        countByFloor.set(row.floor_number, (countByFloor.get(row.floor_number) ?? 0) + 1)
      }
      const planByFloor = new Map(plans.map((p) => [p.floor, p.rooms]))
      for (const [floor, count] of countByFloor) {
        if (!planByFloor.has(floor)) planByFloor.set(floor, count)
      }
      const fullPlans = [...planByFloor.entries()]
        .map(([floor, rooms]) => ({ floor, rooms }))
        .sort((a, b) => a.floor - b.floor)

      if (fullPlans.every((p) => p.rooms === 0) && existingRooms.length === 0) {
        return { success: true as const, created: 0, removed: 0, renumbered: 0 }
      }

      try {
        const result = await repository.applyBuildingLayout(faculty, numbering, fullPlans, ...withDorm(dormId))
        return { success: true as const, ...result }
      } catch (error) {
        const code = (error as { code?: string })?.code
        const message = (error as { message?: string })?.message ?? ''
        if (code === 'P0003') {
          // "Band xonalarni qayta raqamlab bo'lmadi: 45, 46"
          throw new ApiError(
            409,
            message ||
              "Band xonani qayta raqamlab bo'lmadi — avval o'sha talabalarni boshqa xonaga ko'chiring yoki qavat sonini oshiring",
          )
        }
        if (code === 'P0007') throw new ApiError(403, "Bu qavat boshqa fakultetga tegishli")
        if (code === 'P0002') throw new ApiError(400, "Fakultetga yotoqxona biriktirilmagan")
        throw error
      }
    },

    async listRoomFloors(faculty: string, dormId?: string): Promise<RoomFloorStatus[]> {
      const rows = await repository.listAllRooms(faculty, ...withDorm(dormId))
      return rows
        .map((row) => ({
          roomNumber: row.room_number,
          floor: row.floor_number,
          frozen: row.frozen,
          frozenReason: row.frozen_reason,
          capacity: row.capacity ?? null,
          gender: normalizeGender((row as { gender?: string | null }).gender),
        }))
        // room_number is a text column, so the DB's ORDER BY gives "1,10,2";
        // re-sort floor-then-natural so every consumer reads it in order.
        .sort((a, b) => a.floor - b.floor || compareRoomNumbers(a.roomNumber, b.roomNumber))
    },

    /**
     * Per-room bed-count override. `capacityValue` of null/'' clears it — the
     * room goes back to inheriting dorms.default_room_capacity. Enforced for
     * real inside the assign_*_room_atomic RPCs (COALESCE(capacity, default)).
     */
    async setCapacity(faculty: string, roomNumberValue: unknown, capacityValue: unknown, dormId?: string) {
      const roomNumber = typeof roomNumberValue === 'string' ? roomNumberValue.trim().slice(0, 20) : ''
      if (!roomNumber) throw new ApiError(400, "Xona raqami kiritilmagan")
      const capacity = parseCapacity(capacityValue, "Xona sig'imi")

      const updated = await repository.setCapacity(faculty, roomNumber, capacity, ...withDorm(dormId))
      if (!updated) throw new ApiError(404, "Bunday xona xonalar sxemasida topilmadi")
      return { success: true as const, roomNumber, capacity }
    },

    async bulkSetCapacity(faculty: string, roomNumbersValue: unknown, capacityValue: unknown, dormId?: string) {
      if (!Array.isArray(roomNumbersValue)) throw new ApiError(400, "So'rov noto'g'ri")
      const roomNumbers = [
        ...new Set(
          roomNumbersValue
            .map((value) => (typeof value === 'string' ? value.trim().slice(0, 20) : ''))
            .filter(Boolean),
        ),
      ]
      if (roomNumbers.length === 0) throw new ApiError(400, "Xonalar tanlanmagan")
      if (roomNumbers.length > 500) throw new ApiError(400, "Bir vaqtda 500 tagacha xona")
      const capacity = parseCapacity(capacityValue, "Xona sig'imi")

      const changed = await repository.bulkSetCapacity(faculty, roomNumbers, capacity, ...withDorm(dormId))
      return { success: true as const, changed, capacity }
    },

    /**
     * Declared room gender — the dekan reserves a room for boys/girls before
     * anyone is placed. `genderValue` of null/'' clears it (any gender).
     * Enforced for real inside the assign_*_room_atomic RPCs (a student whose
     * gender differs from a declared room's gender is refused).
     */
    async setGender(faculty: string, roomNumberValue: unknown, genderValue: unknown, dormId?: string) {
      const roomNumber = typeof roomNumberValue === 'string' ? roomNumberValue.trim().slice(0, 20) : ''
      if (!roomNumber) throw new ApiError(400, "Xona raqami kiritilmagan")
      const gender = parseGender(genderValue)

      const updated = await repository.setGender(faculty, roomNumber, gender, ...withDorm(dormId))
      if (!updated) throw new ApiError(404, "Bunday xona xonalar sxemasida topilmadi")
      return { success: true as const, roomNumber, gender }
    },

    async bulkSetGender(faculty: string, roomNumbersValue: unknown, genderValue: unknown, dormId?: string) {
      if (!Array.isArray(roomNumbersValue)) throw new ApiError(400, "So'rov noto'g'ri")
      const roomNumbers = [
        ...new Set(
          roomNumbersValue
            .map((value) => (typeof value === 'string' ? value.trim().slice(0, 20) : ''))
            .filter(Boolean),
        ),
      ]
      if (roomNumbers.length === 0) throw new ApiError(400, "Xonalar tanlanmagan")
      if (roomNumbers.length > 500) throw new ApiError(400, "Bir vaqtda 500 tagacha xona")
      const gender = parseGender(genderValue)

      const changed = await repository.bulkSetGender(faculty, roomNumbers, gender, ...withDorm(dormId))
      return { success: true as const, changed, gender }
    },

    /**
     * Ta'mirlash (renovation) toggle: freezes a room out of new placements,
     * or thaws it back. Doesn't touch existing occupants — freezing a room
     * mid-repair shouldn't evict whoever is already there, only stop new
     * students from being moved in while it's frozen (enforced again inside
     * assign_student_room_atomic itself, not just here).
     */
    async setFrozen(faculty: string, roomNumberValue: unknown, frozenValue: unknown, reasonValue: unknown, dormId?: string) {
      const roomNumber = typeof roomNumberValue === 'string' ? roomNumberValue.trim().slice(0, 20) : ''
      if (!roomNumber) throw new ApiError(400, "Xona raqami kiritilmagan")
      if (typeof frozenValue !== 'boolean') throw new ApiError(400, "So'rov noto'g'ri")

      const reason = typeof reasonValue === 'string' ? reasonValue.trim().slice(0, 300) : ''
      // Unfreezing always drops the reason — otherwise the next freeze of
      // this room would silently inherit whatever was typed last time.
      const storedReason = frozenValue ? (reason || null) : null

      const updated = await repository.setFrozen(faculty, roomNumber, frozenValue, storedReason, ...withDorm(dormId))
      if (!updated) throw new ApiError(404, "Bunday xona xonalar sxemasida topilmadi")

      return { success: true as const, roomNumber, frozen: frozenValue }
    },

    async getFloor(faculty: string, floorValue: unknown, dormId?: string) {
      const floorNumber = parseFloorNumber(floorValue)
      const rows = await repository.listFloor(faculty, floorNumber, ...withDorm(dormId))
      return rows.map((row) => ({
        roomNumber: row.room_number,
        side: row.side as RoomBlockSide,
        position: row.position,
        size: row.size as RoomBlockSize,
        capacity: row.capacity ?? null,
        // Read-only here — freezing lives in the Xonalar xaritasi. Surfaced
        // so the builder's "bo'sh joy" summary can exclude frozen rooms.
        frozen: Boolean(row.frozen),
      }))
    },

    async saveFloor(faculty: string, floorValue: unknown, blocksValue: unknown, dormId?: string) {
      const floorNumber = parseFloorNumber(floorValue)
      const blocks = parseBlocks(blocksValue)

      try {
        await repository.replaceFloor(faculty, floorNumber, blocks, ...withDorm(dormId))
      } catch (error) {
        const code = (error as { code?: string })?.code
        if (code === '23505') {
          throw new ApiError(409, "Bu xona raqami boshqa qavatda allaqachon ishlatilgan")
        }
        if (code === 'P0003') {
          throw new ApiError(409, "Band xonani sxemadan olib tashlab bo'lmaydi — avval talaba yoki yo'llanmani boshqa xonaga ko'chiring")
        }
        if (code === 'P0007') {
          throw new ApiError(403, "Bu qavat boshqa fakultetga tegishli — tarxini o'zgartirib bo'lmaydi")
        }
        if (code === 'P0002') {
          throw new ApiError(400, "Sizga yotoqxona biriktirilmagan — avval yotoqxonani sozlang")
        }
        throw error
      }

      // Reported separately from the save itself: the layout is already
      // committed at this point, so telling the admin "saqlanmadi" would be
      // a lie and re-saving is the correct recovery.
      try {
        const scope = await repository.scopeFor(faculty, dormId)
        await repository.syncAssignedFloors(scope.dormId, floorNumber, blocks.map((block) => block.roomNumber))
      } catch (error) {
        console.error('assigned_floor sync failed after layout save:', error)
        throw new ApiError(
          500,
          "Qavat tarxi saqlandi, lekin talabalarning qavati yangilanmadi — qayta saqlab ko'ring",
        )
      }

      return { success: true as const }
    },
  }
}
