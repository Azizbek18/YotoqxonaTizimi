import { extractFloor } from '@/lib/floor'
import type { RoomFloor } from './types'

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
