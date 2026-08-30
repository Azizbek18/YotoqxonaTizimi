import { extractFloor } from '@/lib/floor'
import type { RoomFloor, RoomFloorStatus } from './types'

// Room numbers are free text in the layout builder ("101", " 101 ", "1A"),
// so match on a trimmed form rather than the raw string — an admin's stray
// space must not detach a room from its floor.
function normalizeRoomNumber(roomNumber: string) {
  return roomNumber.trim()
}

export function buildRoomFloorMap(rooms: RoomFloor[]) {
  return new Map(rooms.map((room) => [normalizeRoomNumber(room.roomNumber), room.floor]))
}

/**
 * Room number -> its per-room capacity override (null = inherit the dorm
 * default). Only rooms with an actual override are worth carrying, but we
 * keep every room so `.has()` can tell "no override" from "unknown room".
 */
export function buildRoomCapacityMap(rooms: RoomFloorStatus[]) {
  return new Map(rooms.map((room) => [normalizeRoomNumber(room.roomNumber), room.capacity]))
}

/**
 * Groups a floor's rooms by effective capacity for the settings summary,
 * e.g. [{ capacity: 4, count: 26 }, { capacity: 2, count: 2 }] renders as
 * "26×4 · 2×2". `defaultCapacity` fills in for rooms with no override; pass
 * null while the dorm settings are still loading and those rooms are simply
 * dropped from the breakdown rather than bucketed under a guessed number.
 */
export function getRoomCapacityBreakdown(
  rooms: Pick<RoomFloorStatus, 'capacity'>[],
  defaultCapacity: number | null,
): Array<{ capacity: number; count: number }> {
  const counts = new Map<number, number>()
  for (const room of rooms) {
    const effective = room.capacity ?? defaultCapacity
    if (effective === null) continue
    counts.set(effective, (counts.get(effective) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([capacity, count]) => ({ capacity, count }))
    .sort((a, b) => b.count - a.count || a.capacity - b.capacity)
}

/**
 * Resolves a room number to its floor using the admin-entered layout, and
 * only falls back to the `(room - 1) / 30 + 1` guess for rooms the layout
 * doesn't know about — a room can be occupied but missing from the layout
 * if it was deleted after the student moved in, and showing that student
 * no floor at all is worse than showing the old estimate.
 *
 * Pass an empty/undefined map (e.g. while the fetch is still in flight) and
 * this degrades to exactly the previous behaviour instead of blanking out.
 */
export function resolveFloor(
  roomFloors: Map<string, number> | null | undefined,
  roomNumber?: string | null,
): number | null {
  if (!roomNumber) return null
  const mapped = roomFloors?.get(normalizeRoomNumber(roomNumber))
  return mapped ?? extractFloor(roomNumber)
}
