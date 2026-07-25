import 'server-only'
import { ApiError } from '@/server/http/api-error'
import type { RoomBlockSide, RoomBlockSize, RoomLayoutBlock } from '../types'
import { createRoomLayoutRepository, type RoomLayoutRepository } from './repository'

const VALID_SIDES: RoomBlockSide[] = ['left', 'right']
const VALID_SIZES: RoomBlockSize[] = ['small', 'medium', 'large']

function parseFloorNumber(value: unknown) {
  const floorNumber = Number(value)
  if (!Number.isInteger(floorNumber) || floorNumber < 1) {
    throw new ApiError(400, "Qavat raqami noto'g'ri")
  }
  return floorNumber
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

    const position = sideCounters[side]++
    return { roomNumber, side, size, position }
  })
}

export function createRoomLayoutService(repository: RoomLayoutRepository = createRoomLayoutRepository()) {
  return {
    async getFloor(floorValue: unknown) {
      const floorNumber = parseFloorNumber(floorValue)
      const rows = await repository.listFloor(floorNumber)
      return rows.map((row) => ({
        roomNumber: row.room_number,
        side: row.side as RoomBlockSide,
        position: row.position,
        size: row.size as RoomBlockSize,
      }))
    },

    async saveFloor(floorValue: unknown, blocksValue: unknown) {
      const floorNumber = parseFloorNumber(floorValue)
      const blocks = parseBlocks(blocksValue)

      try {
        await repository.replaceFloor(floorNumber, blocks)
      } catch (error) {
        const code = (error as { code?: string })?.code
        if (code === '23505') {
          throw new ApiError(409, "Bu xona raqami boshqa qavatda allaqachon ishlatilgan")
        }
        throw error
      }

      return { success: true as const }
    },
  }
}
