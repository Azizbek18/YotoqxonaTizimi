import 'server-only'
import { ApiError } from '@/server/http/api-error'
import type { FloorRoomPlan, RoomBlockSide, RoomBlockSize, RoomFloorStatus, RoomLayoutBlock, RoomNumbering } from '../types'
import { MAX_ROOMS_PER_FLOOR, planRoomNumbers } from '../plan'
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
     * Tops up the layout from a simple "nechta xona" target per floor, so a
     * dekan can grow the building over time instead of drawing every room
     * in the 3D builder. A planned room number that already exists — on
     * this floor or any other — is skipped, never touched: this only ever
     * ADDS rooms, so it's safe to run against an empty building, a fully
     * drawn one, or (the common case) one that already has a few rooms
     * because students live in them. Existing rooms keep whatever side/
     * position/size/frozen state they already have.
     */
    async generateFloors(faculty: string, plansValue: unknown, numberingValue: unknown) {
      const plans = parseFloorPlans(plansValue)
      const numbering: RoomNumbering = numberingValue === 'per-floor' ? 'per-floor' : 'sequential'

      const planned = planRoomNumbers(plans, numbering)
      if (planned.length === 0) throw new ApiError(400, "Kamida bitta xona kiritilishi kerak")

      const existingRooms = await repository.listAllRooms(faculty)
      const existingNumbers = new Set(existingRooms.map((row) => row.room_number))
      const rooms = planned.filter((room) => !existingNumbers.has(room.roomNumber))

      // Every planned number is already taken — a legitimate no-op (e.g.
      // the dekan re-runs the same target after nothing changed), not an
      // error.
      if (rooms.length === 0) {
        return { success: true as const, created: 0 }
      }

      // side/position keep the 3D builder's rendering sane: new rooms
      // continue each floor's corridor from wherever it currently ends,
      // split left/right to keep the two sides roughly balanced overall
      // — existing rooms on that floor keep their own side/position.
      const existingCountByFloorSide = new Map<string, number>()
      existingRooms.forEach((row) => {
        const key = `${row.floor_number}:${row.side}`
        existingCountByFloorSide.set(key, (existingCountByFloorSide.get(key) ?? 0) + 1)
      })
      const newCountByFloor = new Map<number, number>()
      rooms.forEach((room) => newCountByFloor.set(room.floor, (newCountByFloor.get(room.floor) ?? 0) + 1))

      const placedNew = new Map<number, number>()
      const rows = rooms.map((room) => {
        const indexAmongNew = placedNew.get(room.floor) ?? 0
        placedNew.set(room.floor, indexAmongNew + 1)

        const existingLeft = existingCountByFloorSide.get(`${room.floor}:left`) ?? 0
        const existingRight = existingCountByFloorSide.get(`${room.floor}:right`) ?? 0
        const newTotal = newCountByFloor.get(room.floor) ?? 0
        // Balance the floor's *eventual* total (existing + new) across both
        // sides, not just the new rooms in isolation — otherwise topping up
        // a floor that's already lopsided keeps it lopsided.
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

      // Students already sitting in these rooms (placed before the layout
      // existed) get their floor filled in right away.
      const { dormId } = await repository.scopeFor(faculty)
      await Promise.all(
        [...new Set(rooms.map((room) => room.floor))].map((floor) =>
          repository.syncAssignedFloors(
            dormId,
            floor,
            rooms.filter((room) => room.floor === floor).map((room) => room.roomNumber),
          ),
        ),
      )

      return { success: true as const, created: rows.length }
    },

    async listRoomFloors(faculty: string): Promise<RoomFloorStatus[]> {
      const rows = await repository.listAllRooms(faculty)
      return rows.map((row) => ({
        roomNumber: row.room_number,
        floor: row.floor_number,
        frozen: row.frozen,
        frozenReason: row.frozen_reason,
        capacity: row.capacity ?? null,
      }))
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
