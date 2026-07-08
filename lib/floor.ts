const ROOMS_PER_FLOOR = 30

export function extractFloor(roomNumber?: string | null): number | null {
  if (!roomNumber) return null
  const matched = roomNumber.match(/\d+/)
  if (!matched) return null
  const parsed = Number(matched[0])
  if (!Number.isFinite(parsed)) return null
  return Math.max(1, Math.floor((parsed - 1) / ROOMS_PER_FLOOR) + 1)
}
