import type { FloorRoomPlan, RoomFloor, RoomNumbering } from './types'

export const MAX_ROOMS_PER_FLOOR = 200

/**
 * Orders room numbers the way a human reads them: "2" before "10", not
 * after. `floor_room_layout.room_number` is a text column, so a plain
 * `ORDER BY room_number` (or `Array.sort()`) gives "1, 10, 11, 2, 20…";
 * every list that shows rooms to a person runs through this instead.
 */
export function compareRoomNumbers(a: string, b: string): number {
  const na = Number(a)
  const nb = Number(b)
  const aNumeric = a.trim() !== '' && Number.isFinite(na)
  const bNumeric = b.trim() !== '' && Number.isFinite(nb)
  if (aNumeric && bNumeric) return na - nb || a.localeCompare(b)
  if (aNumeric) return -1
  if (bNumeric) return 1
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
}

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
  /** Rooms already in the layout on this floor, before this plan. */
  existing: number
  /** Rooms this plan would newly create on this floor. */
  added: number
  /** Empty rooms this plan would delete on this floor (floor is over target). */
  removed: number
  /** Rooms over target that stay because they're occupied. */
  keptOccupied: number
  /** What the floor ends up with: existing + added − removed. */
  total: number
}

/**
 * Same numbering as planRoomNumbers, but aware of the rooms the building
 * already has — so the generator can top up a partial floor OR trim an
 * over-built one. A planned number that's already taken (any floor) is
 * skipped; when a floor is over its target, its highest-numbered EMPTY
 * rooms are marked for removal (occupied ones never are). This summarises
 * exactly what the confirm button will do, so the preview can't promise
 * something the server won't.
 */
export function describeFloorFill(
  plans: FloorRoomPlan[],
  numbering: RoomNumbering,
  existingRooms: readonly RoomFloor[],
  occupiedRoomNumbers: ReadonlySet<string> = new Set(),
): FloorFillSummary[] {
  const existingNumbers = new Set(existingRooms.map((room) => room.roomNumber))
  const roomsByFloor = new Map<number, string[]>()
  existingRooms.forEach((room) => {
    const list = roomsByFloor.get(room.floor) ?? []
    list.push(room.roomNumber)
    roomsByFloor.set(room.floor, list)
  })

  const addedByFloor = new Map<number, number>()
  planRoomNumbers(plans, numbering).forEach((room) => {
    if (!existingNumbers.has(room.roomNumber)) {
      addedByFloor.set(room.floor, (addedByFloor.get(room.floor) ?? 0) + 1)
    }
  })

  return [...plans]
    .sort((a, b) => a.floor - b.floor)
    .map(({ floor, rooms: target }) => {
      const current = roomsByFloor.get(floor) ?? []
      const existing = current.length
      const added = addedByFloor.get(floor) ?? 0

      let removed = 0
      let keptOccupied = 0
      const overBy = existing - target
      if (overBy > 0) {
        const removableEmpty = current.filter((n) => !occupiedRoomNumbers.has(n)).length
        removed = Math.min(overBy, removableEmpty)
        keptOccupied = overBy - removed
      }

      return { floor, existing, added, removed, keptOccupied, total: existing + added - removed }
    })
}
