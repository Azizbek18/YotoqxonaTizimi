import 'server-only'
import { ApiError } from '@/server/http/api-error'
import type { FloorRoomPlan, RoomBlockSide, RoomBlockSize, RoomFloorStatus, RoomLayoutBlock, RoomNumbering } from '../types'
import { MAX_ROOMS_PER_FLOOR, compareRoomNumbers, planRoomNumbers } from '../plan'
import { createRoomLayoutRepository, type RoomLayoutRepository } from './repository'

const VALID_SIDES: RoomBlockSide[] = ['left', 'right']
const VALID_SIZES: RoomBlockSize[] = ['small', 'medium', 'large']

export const MAX_ROOM_CAPACITY = 20

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
     * Makes each floor hold exactly the "nechta xona" target the dekan
     * typed — the quick alternative to drawing every room in the 3D
     * builder. Per floor:
     *   • short  → new rooms are appended (continuing this building's
     *     numbering), split left/right to keep the corridor balanced;
     *   • over   → the highest-numbered EMPTY rooms are deleted down to the
     *     target. A room with a resident or an approved permit is never
     *     touched — it stays even if that leaves the floor above target,
     *     and `keptOccupied` reports how many.
     * Frozen-but-empty rooms count as removable (freezing was the only way
     * to "hide" an unwanted room before this existed). Safe to run against
     * an empty building, a finished one, or a half-drawn one.
     */
    async generateFloors(faculty: string, plansValue: unknown, numberingValue: unknown) {
      const plans = parseFloorPlans(plansValue)
      const numbering: RoomNumbering = numberingValue === 'per-floor' ? 'per-floor' : 'sequential'

      const planned = planRoomNumbers(plans, numbering)
      const targetByFloor = new Map(plans.map((p) => [p.floor, p.rooms]))

      const existingRooms = await repository.listAllRooms(faculty)
      const existingNumbers = new Set(existingRooms.map((row) => row.room_number))
      const roomsByFloor = new Map<number, typeof existingRooms>()
      for (const row of existingRooms) {
        const list = roomsByFloor.get(row.floor_number) ?? []
        list.push(row)
        roomsByFloor.set(row.floor_number, list)
      }

      // ---- additions: planned numbers that don't exist yet ----
      const toAdd = planned.filter((room) => !existingNumbers.has(room.roomNumber))

      // ---- removals: floors that are over target ----
      const occupied = await repository.occupiedRoomNumbers(faculty)
      const trims: { floor: number; removed: string[]; keptOccupied: number }[] = []
      for (const [floor, target] of targetByFloor) {
        const current = roomsByFloor.get(floor) ?? []
        const overBy = current.length - target
        if (overBy <= 0) continue
        const removable = [...current]
          .filter((r) => !occupied.has(r.room_number))
          .sort((a, b) => compareRoomNumbers(b.room_number, a.room_number)) // highest first
          .slice(0, overBy)
          .map((r) => r.room_number)
        const keptOccupied = overBy - removable.length
        if (removable.length > 0 || keptOccupied > 0) trims.push({ floor, removed: removable, keptOccupied })
      }

      if (toAdd.length === 0 && trims.every((t) => t.removed.length === 0)) {
        return { success: true as const, created: 0, removed: 0, keptOccupied: trims.reduce((s, t) => s + t.keptOccupied, 0) }
      }

      const { dormId } = await repository.scopeFor(faculty)

      // ---- apply removals first (per floor, via the guarded RPC) ----
      let removedTotal = 0
      for (const trim of trims) {
        if (trim.removed.length === 0) continue
        const drop = new Set(trim.removed)
        const kept = (roomsByFloor.get(trim.floor) ?? []).filter((r) => !drop.has(r.room_number))
        // Re-pack positions per side so the 3D builder stays tidy.
        const posBySide: Record<RoomBlockSide, number> = { left: 0, right: 0 }
        const keptRows: RoomLayoutBlock[] = kept
          .slice()
          .sort((a, b) => compareRoomNumbers(a.room_number, b.room_number))
          .map((r) => {
            const side: RoomBlockSide = r.side === 'right' ? 'right' : 'left'
            const size: RoomBlockSize = VALID_SIZES.includes(r.size as RoomBlockSize)
              ? (r.size as RoomBlockSize)
              : 'medium'
            return {
              roomNumber: r.room_number,
              side,
              position: posBySide[side]++,
              size,
              capacity: r.capacity ?? null,
            }
          })
        try {
          await repository.replaceFloor(faculty, trim.floor, keptRows)
        } catch (error) {
          const code = (error as { code?: string })?.code
          if (code === 'P0003') {
            throw new ApiError(409, "Band xonani o'chirib bo'lmadi — avval talabani boshqa xonaga ko'chiring")
          }
          throw error
        }
        removedTotal += trim.removed.length
        // A removed room held nobody, so no assigned_floor to fix up.
      }

      // ---- apply additions ----
      let createdTotal = 0
      if (toAdd.length > 0) {
        const existingCountByFloorSide = new Map<string, number>()
        existingRooms
          .filter((row) => !trims.some((t) => t.floor === row.floor_number && t.removed.includes(row.room_number)))
          .forEach((row) => {
            const key = `${row.floor_number}:${row.side}`
            existingCountByFloorSide.set(key, (existingCountByFloorSide.get(key) ?? 0) + 1)
          })
        const newCountByFloor = new Map<number, number>()
        toAdd.forEach((room) => newCountByFloor.set(room.floor, (newCountByFloor.get(room.floor) ?? 0) + 1))

        const placedNew = new Map<number, number>()
        const rows = toAdd.map((room) => {
          const indexAmongNew = placedNew.get(room.floor) ?? 0
          placedNew.set(room.floor, indexAmongNew + 1)

          const existingLeft = existingCountByFloorSide.get(`${room.floor}:left`) ?? 0
          const existingRight = existingCountByFloorSide.get(`${room.floor}:right`) ?? 0
          const newTotal = newCountByFloor.get(room.floor) ?? 0
          const desiredLeftTotal = Math.ceil((existingLeft + existingRight + newTotal) / 2)
          const newLeftCount = Math.min(Math.max(desiredLeftTotal - existingLeft, 0), newTotal)

          const onLeft = indexAmongNew < newLeftCount
          return {
            floor_number: room.floor,
            room_number: room.roomNumber,
            side: onLeft ? 'left' : 'right',
            position: onLeft ? existingLeft + indexAmongNew : existingRight + (indexAmongNew - newLeftCount),
            size: 'medium',
          }
        })

        try {
          await repository.insertRooms(faculty, rows)
        } catch (error) {
          if ((error as { code?: string })?.code === '23505') {
            throw new ApiError(409, 'Xona raqami takrorlandi — raqamlash usulini o‘zgartiring')
          }
          throw error
        }
        createdTotal = rows.length

        // Students already sitting in these rooms (placed before the layout
        // existed) get their floor filled in right away.
        await Promise.all(
          [...new Set(toAdd.map((room) => room.floor))].map((floor) =>
            repository.syncAssignedFloors(
              dormId,
              floor,
              toAdd.filter((room) => room.floor === floor).map((room) => room.roomNumber),
            ),
          ),
        )
      }

      return {
        success: true as const,
        created: createdTotal,
        removed: removedTotal,
        keptOccupied: trims.reduce((s, t) => s + t.keptOccupied, 0),
      }
    },

    async listRoomFloors(faculty: string): Promise<RoomFloorStatus[]> {
      const rows = await repository.listAllRooms(faculty)
      return rows
        .map((row) => ({
          roomNumber: row.room_number,
          floor: row.floor_number,
          frozen: row.frozen,
          frozenReason: row.frozen_reason,
          capacity: row.capacity ?? null,
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
    async setCapacity(faculty: string, roomNumberValue: unknown, capacityValue: unknown) {
      const roomNumber = typeof roomNumberValue === 'string' ? roomNumberValue.trim().slice(0, 20) : ''
      if (!roomNumber) throw new ApiError(400, "Xona raqami kiritilmagan")
      const capacity = parseCapacity(capacityValue, "Xona sig'imi")

      const updated = await repository.setCapacity(faculty, roomNumber, capacity)
      if (!updated) throw new ApiError(404, "Bunday xona xonalar sxemasida topilmadi")
      return { success: true as const, roomNumber, capacity }
    },

    async bulkSetCapacity(faculty: string, roomNumbersValue: unknown, capacityValue: unknown) {
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

      const changed = await repository.bulkSetCapacity(faculty, roomNumbers, capacity)
      return { success: true as const, changed, capacity }
    },

    /**
     * Ta'mirlash (renovation) toggle: freezes a room out of new placements,
     * or thaws it back. Doesn't touch existing occupants — freezing a room
     * mid-repair shouldn't evict whoever is already there, only stop new
     * students from being moved in while it's frozen (enforced again inside
     * assign_student_room_atomic itself, not just here).
     */
    async setFrozen(faculty: string, roomNumberValue: unknown, frozenValue: unknown, reasonValue: unknown) {
      const roomNumber = typeof roomNumberValue === 'string' ? roomNumberValue.trim().slice(0, 20) : ''
      if (!roomNumber) throw new ApiError(400, "Xona raqami kiritilmagan")
      if (typeof frozenValue !== 'boolean') throw new ApiError(400, "So'rov noto'g'ri")

      const reason = typeof reasonValue === 'string' ? reasonValue.trim().slice(0, 300) : ''
      // Unfreezing always drops the reason — otherwise the next freeze of
      // this room would silently inherit whatever was typed last time.
      const storedReason = frozenValue ? (reason || null) : null

      const updated = await repository.setFrozen(faculty, roomNumber, frozenValue, storedReason)
      if (!updated) throw new ApiError(404, "Bunday xona xonalar sxemasida topilmadi")

      return { success: true as const, roomNumber, frozen: frozenValue }
    },

    async getFloor(faculty: string, floorValue: unknown) {
      const floorNumber = parseFloorNumber(floorValue)
      const rows = await repository.listFloor(faculty, floorNumber)
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

    async saveFloor(faculty: string, floorValue: unknown, blocksValue: unknown) {
      const floorNumber = parseFloorNumber(floorValue)
      const blocks = parseBlocks(blocksValue)

      try {
        await repository.replaceFloor(faculty, floorNumber, blocks)
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
        const { dormId } = await repository.scopeFor(faculty)
        await repository.syncAssignedFloors(dormId, floorNumber, blocks.map((block) => block.roomNumber))
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
