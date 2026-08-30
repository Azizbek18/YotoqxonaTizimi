/**
 * Bed accounting shared by the dekan dashboard and the superadmin overview.
 * A frozen (ta'mirlash) room contributes no beds and no free places — it's
 * out of circulation, not empty. Per-room `capacity` overrides the dorm
 * default (migration 202609180000).
 */
export type CapacityRoom = {
  room_number: string
  frozen: boolean
  capacity: number | null
}

export function summariseBeds(
  rooms: readonly CapacityRoom[],
  defaultCapacity: number,
  occupancyByRoom: ReadonlyMap<string, number>,
) {
  let availableBeds = 0
  let freeBeds = 0
  let frozenRoomCount = 0
  for (const room of rooms) {
    if (room.frozen) {
      frozenRoomCount += 1
      continue
    }
    const capacity = room.capacity ?? defaultCapacity
    availableBeds += capacity
    freeBeds += Math.max(0, capacity - (occupancyByRoom.get(room.room_number) ?? 0))
  }
  return { availableBeds, freeBeds, frozenRoomCount }
}
