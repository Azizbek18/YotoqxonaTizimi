import type { FloorRoomPlan, RoomFloor, RoomNumbering } from './types'

export const MAX_ROOMS_PER_FLOOR = 200

/**
 * Orders room numbers the way a human reads them: "2" before "10", not
 * after, and a lettered sub-room ("7a") right after its base ("7") and
 * before the next number ("8"). `floor_room_layout.room_number` is a text
 * column, so a plain `ORDER BY room_number` (or `Array.sort()`) gives
 * "1, 10, 11, 2, 20…"; every list that shows rooms to a person runs
 * through this instead.
 */
export function compareRoomNumbers(a: string, b: string): number {
  // Split a leading integer from whatever trails it: "7a" -> [7, "a"].
  const pa = a.trim().match(/^(\d+)(.*)$/)
  const pb = b.trim().match(/^(\d+)(.*)$/)
  if (pa && pb) {
    return (Number(pa[1]) - Number(pb[1]))
      || pa[2].localeCompare(pb[2], undefined, { numeric: true, sensitivity: 'base' })
  }
  if (pa) return -1
  if (pb) return 1
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
}

/** A pure-number room ("12") vs a lettered sub-room ("7a") or free-text one. */
export function isPlainRoomNumber(roomNumber: string): boolean {
  return /^\d+$/.test(roomNumber.trim())
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
  /** Rooms currently on this floor. */
  existing: number
  /** Rooms this floor ends up with. */
  target: number
  /** Brand-new rooms created on this floor. */
  added: number
  /** Empty rooms deleted from this floor. */
  removed: number
  /** Empty rooms that keep their spot but get a new number. */
  renumbered: number
  /** Current [min, max] room number on this floor (numeric rooms only). */
  fromRange: [number, number] | null
  /** New [min, max] room number for this floor. */
  toRange: [number, number] | null
  /** Occupied room numbers that can't keep their number → the op is refused. */
  conflicts: string[]
}

/**
 * Predicts, floor by floor, exactly what `apply_building_layout` (migration
 * 20260902080254) will do: the building is renumbered to match the per-floor
 * targets — contiguous 1..N for 'sequential', N01.. for 'per-floor'. Only
 * EMPTY rooms move / are created / are dropped; an occupied room keeps its
 * exact number and the sequence flows around it. `conflicts` lists occupied
 * rooms that can't keep their number (outside the floor's new range, or the
 * floor now has fewer rooms than residents) — the server refuses the whole
 * op when any floor has one, so the preview surfaces it before the click.
 */
export function describeFloorFill(
  plans: FloorRoomPlan[],
  numbering: RoomNumbering,
  existingRooms: readonly RoomFloor[],
  occupiedRoomNumbers: ReadonlySet<string> = new Set(),
): FloorFillSummary[] {
  const roomsByFloor = new Map<number, string[]>()
  existingRooms.forEach((room) => {
    const list = roomsByFloor.get(room.floor) ?? []
    list.push(room.roomNumber)
    roomsByFloor.set(room.floor, list)
  })

  let offset = 0
  return [...plans]
    .sort((a, b) => a.floor - b.floor)
    .map(({ floor, rooms: planCount }) => {
      const allOnFloor = roomsByFloor.get(floor) ?? []
      // A lettered sub-room ("7a") counts toward the floor's total but is
      // never renumbered — so the NUMERIC target is the plan count minus the
      // lettered rooms already there, and the sequence flows by that.
      const current = allOnFloor.filter(isPlainRoomNumber)
      const lettered = allOnFloor.length - current.length
      const target = Math.max(planCount - lettered, 0)

      const lo = numbering === 'per-floor' ? floor * 100 + 1 : offset + 1
      const hi = lo + target - 1
      if (numbering !== 'per-floor') offset += target

      const currentNums = current.map(Number).filter((n) => Number.isFinite(n))
      const occupiedHere = current.filter((n) => occupiedRoomNumbers.has(n))

      const conflicts = occupiedHere.filter((n) => {
        const v = Number(n)
        return !Number.isFinite(v) || v < lo || v > hi || occupiedHere.length > target
      })

      // Mirror the RPC's assignment: occupied rooms in range are pinned, the
      // remaining target numbers go to empty rooms oldest-first, leftovers
      // are new, surplus empty rooms are dropped.
      const pinned = new Set(occupiedHere.map(Number).filter((v) => v >= lo && v <= hi))
      const availTargets: number[] = []
      for (let n = lo; n <= hi; n++) if (!pinned.has(n)) availTargets.push(n)
      const movable = current.filter((n) => !occupiedRoomNumbers.has(n)).sort(compareRoomNumbers)

      let renumbered = 0
      const zip = Math.min(movable.length, availTargets.length)
      for (let i = 0; i < zip; i++) if (Number(movable[i]) !== availTargets[i]) renumbered++

      return {
        floor,
        existing: allOnFloor.length,
        // What the floor ends up with = numeric target + the lettered rooms kept.
        target: target + lettered,
        added: Math.max(0, availTargets.length - movable.length),
        removed: Math.max(0, movable.length - availTargets.length),
        renumbered,
        fromRange: currentNums.length ? [Math.min(...currentNums), Math.max(...currentNums)] : null,
        toRange: target > 0 ? [lo, hi] : null,
        conflicts,
      }
    })
}
