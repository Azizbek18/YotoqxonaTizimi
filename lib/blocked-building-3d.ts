// Pure geometry + occupancy maths for the blocked-building 3D view
// (components/dekan/BlockedBuilding3D.tsx). Kept out of the component so it can
// be unit-tested without a WebGL context.

import type { BlockedRoom } from '@/features/dorms/types'

/** World-space gap between the A and B block centres. */
export const BLOCK_GAP = 3.2
/** World-space height of one floor slab. */
export const FLOOR_HEIGHT = 0.62
/** Footprint of one section box (a wing on one floor). */
export const SECTION_WIDTH = 2.4
export const SECTION_DEPTH = 1.5

export type Placement = { x: number; y: number; z: number }

/**
 * Where a section (block wing, floor) sits in the scene. A block on the left
 * (x < 0), B on the right (x > 0) as its mirror; floor 1 at the bottom,
 * `floorCount` at the top, the stack centred on y = 0.
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
  const y = (floor - midFloor) * FLOOR_HEIGHT
  return { x, y, z: 0 }
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
