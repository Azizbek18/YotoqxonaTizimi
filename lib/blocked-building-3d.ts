import type { BlockedRoom } from '@/features/dorms/types'

// Mirror of the constants in app/dekan/3d-xonalar/page.tsx so the two 3D
// makets read identically — same corridor, same room footprint, same slab.
export const CORRIDOR_WIDTH = 2.4
export const GAP = 0.35
export const ROOM_WIDTH = 1.8
export const ROOM_HEIGHT = 1.0

export type BlockedRoomSize = 'small' | 'medium' | 'large'

// Only the frontage along the row (`depth`) varies by size, exactly as in
// 3d-xonalar — a bigger room grows in line with its neighbours instead of
// jutting sideways out of the row.
export const SIZE_UNITS: Record<BlockedRoomSize, { width: number; depth: number; height: number }> = {
  small: { width: ROOM_WIDTH, depth: 1.3, height: ROOM_HEIGHT },
  medium: { width: ROOM_WIDTH, depth: 1.8, height: ROOM_HEIGHT },
  large: { width: ROOM_WIDTH, depth: 2.6, height: ROOM_HEIGHT },
}

// The hand drawing fixes which rooms sit on which side of the corridor.
const RIGHT_ROOMS = new Set(['1', '3', '7', '9'])
export const sideForRoom = (roomNumber: string): 'left' | 'right' =>
  RIGHT_ROOMS.has(roomNumber) ? 'right' : 'left'

// Bed count stands in for the size pill: 4-bed rooms read small, 8-bed large.
export const sizeForCapacity = (capacity: number): BlockedRoomSize =>
  capacity <= 4 ? 'small' : capacity >= 8 ? 'large' : 'medium'

export type PositionedBlockedRoom = {
  roomNumber: string
  side: 'left' | 'right'
  capacity: number
  frozen: boolean
  occupied: number
  x: number
  z: number
  width: number
  depth: number
  height: number
}

// Lays one side's rooms out along Z hugging the corridor on X — the same
// algorithm as 3d-xonalar's layoutSide, so sizes never overlap.
function layoutSide(rooms: BlockedRoom[], side: 'left' | 'right') {
  let cursor = 0
  const raw = rooms.map((r) => {
    const units = SIZE_UNITS[sizeForCapacity(r.capacity)]
    const z = cursor + units.depth / 2
    cursor += units.depth + GAP
    return { r, z, ...units }
  })
  const totalDepth = Math.max(cursor - GAP, 0)
  const centerOffset = totalDepth / 2
  const maxWidth = raw.reduce((m, x) => Math.max(m, x.width), 0)
  const xSign = side === 'left' ? -1 : 1
  const positioned: PositionedBlockedRoom[] = raw.map(({ r, z, width, depth, height }) => ({
    roomNumber: r.roomNumber,
    side,
    capacity: r.capacity,
    frozen: r.frozen,
    occupied: r.occupants.length,
    x: xSign * (CORRIDOR_WIDTH / 2 + width / 2 + GAP),
    z: z - centerOffset,
    width,
    depth,
    height,
  }))
  return { rooms: positioned, totalDepth, maxWidth }
}

/** One blocked section (block + floor) laid out as a single 3d-xonalar-style floor. */
export function sectionFloorLayout(rooms: BlockedRoom[]): {
  rooms: PositionedBlockedRoom[]
  slabWidth: number
  slabDepth: number
} {
  const sorted = [...rooms].sort((a, b) => Number(a.roomNumber) - Number(b.roomNumber))
  const left = layoutSide(sorted.filter((r) => sideForRoom(r.roomNumber) === 'left'), 'left')
  const right = layoutSide(sorted.filter((r) => sideForRoom(r.roomNumber) === 'right'), 'right')
  return {
    rooms: [...left.rooms, ...right.rooms],
    slabWidth: CORRIDOR_WIDTH + 2 * (Math.max(left.maxWidth, right.maxWidth, ROOM_WIDTH) + GAP) + 1,
    slabDepth: Math.max(left.totalDepth, right.totalDepth, 2) + 2,
  }
}

/** Filled beds vs. non-frozen capacity across a section. */
export function sectionOccupancy(rooms: BlockedRoom[]): { filled: number; total: number } {
  let filled = 0
  let total = 0
  for (const r of rooms) {
    filled += r.occupants.length
    total += r.frozen ? 0 : r.capacity
  }
  return { filled, total }
}
