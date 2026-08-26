import type { FloorRoomPlan, RoomFloor, RoomNumbering } from './types'

export const MAX_ROOMS_PER_FLOOR = 200

/**
 * Turns "1-qavatda 30 ta xona, 2-qavatda 30 ta..." into the actual room
 * numbers. Shared by the generator dialog (to preview exactly what will be
 * created) and the server (to create it), so the preview can never promise
 * something different from what gets written.
 */
export function planRoomNumbers(plans: FloorRoomPlan[], numbering: RoomNumbering): RoomFloor[] {
  const ordered = [...plans].sort((a, b) => a.floor - b.floor)
  const rooms: RoomFloor[] = []
  let sequentialNext = 1

  ordered.forEach(({ floor, rooms: count }) => {
    for (let index = 0; index < count; index++) {
      const roomNumber = numbering === 'per-floor'
        ? String(floor * 100 + index + 1)
        : String(sequentialNext + index)
      rooms.push({ roomNumber, floor })
    }
    if (numbering === 'sequential') sequentialNext += count
  })

  return rooms
}

export type FloorFillSummary = {
  floor: number
  /** Rooms already in the layout on this floor, untouched by this plan. */
  existing: number
  /** Rooms this plan would newly create on this floor. */
  added: number
  /** existing + added — what the floor ends up with. */
  total: number
}

/**
 * Same numbering as planRoomNumbers, but aware of rooms the building
 * already has — the generator can now top up a partially-drawn layout
 * (e.g. rooms that already exist because students live in them) instead
 * of only ever bootstrapping an empty one. A planned room number that's
 * already taken, on any floor, is skipped rather than colliding with it;
 * this summarises exactly what the confirm button will and won't create,
 * so the preview can never promise something the server won't do.
 */
export function describeFloorFill(
  plans: FloorRoomPlan[],
  numbering: RoomNumbering,
  existingRooms: readonly RoomFloor[],
): FloorFillSummary[] {
  const existingNumbers = new Set(existingRooms.map((room) => room.roomNumber))
  const existingByFloor = new Map<number, number>()
  existingRooms.forEach((room) => existingByFloor.set(room.floor, (existingByFloor.get(room.floor) ?? 0) + 1))

  const addedByFloor = new Map<number, number>()
  planRoomNumbers(plans, numbering).forEach((room) => {
    if (!existingNumbers.has(room.roomNumber)) {
      addedByFloor.set(room.floor, (addedByFloor.get(room.floor) ?? 0) + 1)
    }
  })

  return [...plans]
    .sort((a, b) => a.floor - b.floor)
    .map(({ floor }) => {
      const existing = existingByFloor.get(floor) ?? 0
      const added = addedByFloor.get(floor) ?? 0
      return { floor, existing, added, total: existing + added }
    })
}
