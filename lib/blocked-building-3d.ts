// Pure geometry + occupancy maths for the blocked-building 3D view
// (components/dekan/BlockedBuilding3D.tsx). Kept out of the component so it can
// be unit-tested without a WebGL context.

import { BLOCKED_ROOM_CAPACITIES, type BlockedRoom } from '@/features/dorms/types'

// --- world-space scale ---
export const CORRIDOR_W = 1.4
export const ROOM_W = 1.1
export const ROOM_D = 0.92
export const ROOM_H = 0.5
export const GAP = 0.18
/** Vertical distance between two stacked section plates. */
export const FLOOR_HEIGHT = 1.15
/** Horizontal distance between the A and B block centres. */
export const BLOCK_GAP = 6.4

/** Floor slab footprint (the longer wing has 5 rooms). */
export const SLAB_W = CORRIDOR_W + 2 * (ROOM_W + 2 * GAP) + 0.5
export const SLAB_D = 5 * (ROOM_D + GAP) - GAP + 0.7

// Blocked template: which rooms sit on which side of the corridor
// (mirrors dorm_build_blocked_layout: 1,3,7,9 → right; 2,4,5,6,8 → left).
const RIGHT_ROOMS = [1, 3, 7, 9]
const LEFT_ROOMS = [2, 4, 5, 6, 8]

export type SectionRoomSlot = {
  roomNumber: string
  side: 'left' | 'right'
  /** Local coords within the section plate; corridor centre at x=0, z=0. */
  x: number
  z: number
  capacity: number
}

/** The fixed 9-room layout of one blocked section, in local plate coords. */
export function sectionRoomLayout(): SectionRoomSlot[] {
  const out: SectionRoomSlot[] = []
  const place = (nums: number[], sign: -1 | 1) => {
    const run = nums.length * (ROOM_D + GAP) - GAP
    nums.forEach((n, i) => {
      out.push({
        roomNumber: String(n),
        side: sign < 0 ? 'left' : 'right',
        x: sign * (CORRIDOR_W / 2 + ROOM_W / 2 + GAP),
        z: i * (ROOM_D + GAP) - run / 2 + ROOM_D / 2,
        capacity: BLOCKED_ROOM_CAPACITIES[n - 1] ?? 6,
      })
    })
  }
  place(LEFT_ROOMS, -1)
  place(RIGHT_ROOMS, 1)
  return out
}

export type Placement = { x: number; y: number; z: number }

/**
 * Where a section plate sits in the scene. Block A on the left (x < 0), block B
 * its mirror on the right (x > 0); floor 1 at the bottom, `floorCount` at the
 * top, the stack centred on y = 0.
 */
export function sectionPlacement(
  block: string,
  floor: number,
  blockCount: number,
  floorCount: number,
): Placement {
  const blockIndex = block.toUpperCase().charCodeAt(0) - 65 // A -> 0, B -> 1
  const span = Math.max(blockCount - 1, 1)
  const x = (blockIndex - span / 2) * BLOCK_GAP
  const midFloor = (floorCount + 1) / 2
  return { x, y: (floor - midFloor) * FLOOR_HEIGHT, z: 0 }
}

/** Filled vs total beds of one section (a frozen room contributes 0 to total). */
export function sectionOccupancy(rooms: BlockedRoom[]): { filled: number; total: number } {
  let filled = 0
  let total = 0
  for (const r of rooms) {
    filled += r.occupants.length
    total += r.frozen ? 0 : r.capacity
  }
  return { filled, total }
}
