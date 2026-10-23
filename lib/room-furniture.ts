/**
 * Furniture layout for the 3D room maket (RoomScene3D).
 *
 * Pure geometry: given a positioned room (three.js units, 1 unit ≈ 2.8 m) it
 * returns axis-aligned boxes for bunk beds, mattresses, pillows, wardrobes, a
 * desk and chairs. The scene draws every kind with ONE InstancedMesh, so the
 * draw-call count does not grow with the number of rooms (cheap Android).
 *
 * Room frame: X runs from the corridor door to the outer window wall, Z along
 * the corridor. Rooms left of the corridor (x < 0) have their door on +X.
 * Beds are bunk beds (2 places each): bed slot i is bunk ⌊i/2⌋, lower deck
 * first, and the first `occupied` slots are drawn as taken.
 */

export type FurnitureKind = 'frame' | 'mattress' | 'pillow' | 'wood' | 'chair' | 'floor'

export type FurnitureBox = {
  kind: FurnitureKind
  /** Centre in world units. */
  x: number
  y: number
  z: number
  /** Full size along each axis. */
  sx: number
  sy: number
  sz: number
  /** Per-instance colour override (mattress state, floor tone). */
  color?: number
}

export type FurnitureRoom = {
  x: number
  z: number
  width: number
  depth: number
  capacity: number | null
  occupied: number
  frozen: boolean
}

export const FURNITURE_COLORS = {
  frame: 0x475569,
  mattressFree: 0xf1f5f9,
  mattressTaken: 0x6366f1,
  mattressFrozen: 0x94a3b8,
  pillow: 0xffffff,
  wood: 0xc49a6c,
  chair: 0x334155,
} as const

const MARGIN = 0.04
const BUNK = { len: 0.7, width: 0.32, post: 0.025, lowerY: 0.1, upperY: 0.42, deck: 0.02 }
const MATTRESS = { len: 0.64, width: 0.28, thick: 0.04 }
const WARDROBE = { len: 0.36, depth: 0.2, height: 0.72 }
const DESK = { depth: 0.22, height: 0.27, top: 0.025, maxLen: 0.6 }
const CHAIR = { seat: 0.14, seatY: 0.16, back: 0.16 }
/** Visual cap: a 10-bed hall would not fit the maket anyway. */
const MAX_BUNKS = 4

/** Bunk count for a room: capacity/2 rounded up; unknown capacity draws a standard 4-place room. */
export function bunkCount(capacity: number | null) {
  if (capacity === null || capacity <= 0) return 2
  return Math.min(MAX_BUNKS, Math.ceil(capacity / 2))
}

export function roomFurniture(room: FurnitureRoom, floorColor?: number): FurnitureBox[] {
  const out: FurnitureBox[] = []
  const L = room.width
  const W = room.depth
  // +1 when the corridor (door) is on local +X.
  const doorSign = room.x < 0 ? 1 : -1
  const windowX = -doorSign * (L / 2)
  const towardDoor = (fromWindow: number) => windowX + doorSign * fromWindow
  const add = (box: Omit<FurnitureBox, 'x' | 'z'> & { lx: number; lz: number }) => {
    const { lx, lz, ...rest } = box
    out.push({ ...rest, x: room.x + lx, z: room.z + lz })
  }

  if (floorColor !== undefined) {
    add({ kind: 'floor', lx: 0, lz: 0, y: 0.006, sx: L - 0.02, sy: 0.012, sz: W - 0.02, color: floorColor })
  }

  const bunks = bunkCount(room.capacity)
  const perWallMax = Math.max(1, Math.floor((L - 2 * MARGIN - 0.1) / (BUNK.len + 0.02)))
  const wallA = Math.min(perWallMax, Math.ceil(bunks / 2))
  const wallB = Math.min(perWallMax, bunks - wallA)
  const wallZ = W / 2 - MARGIN - BUNK.width / 2
  const places = room.capacity === null || room.capacity <= 0 ? 0 : room.capacity

  let slot = 0
  const drawBunk = (lx: number, lz: number) => {
    const h = BUNK.upperY + 0.2
    const px = BUNK.len / 2 - BUNK.post / 2
    const pz = BUNK.width / 2 - BUNK.post / 2
    for (const sxSign of [-1, 1]) {
      for (const szSign of [-1, 1]) {
        add({ kind: 'frame', lx: lx + sxSign * px, lz: lz + szSign * pz, y: h / 2, sx: BUNK.post, sy: h, sz: BUNK.post })
      }
    }
    for (const deckY of [BUNK.lowerY, BUNK.upperY]) {
      add({ kind: 'frame', lx, lz, y: deckY, sx: BUNK.len, sy: BUNK.deck, sz: BUNK.width })
      const exists = slot < places || places === 0
      const taken = slot < room.occupied && slot < places
      if (exists) {
        const color = room.frozen
          ? FURNITURE_COLORS.mattressFrozen
          : taken ? FURNITURE_COLORS.mattressTaken : FURNITURE_COLORS.mattressFree
        const mattressY = deckY + BUNK.deck / 2 + MATTRESS.thick / 2
        add({ kind: 'mattress', lx, lz, y: mattressY, sx: MATTRESS.len, sy: MATTRESS.thick, sz: MATTRESS.width, color })
        // Pillow at the window end of the bed.
        add({
          kind: 'pillow',
          lx: lx - doorSign * (MATTRESS.len / 2 - 0.06),
          lz,
          y: mattressY + MATTRESS.thick / 2 + 0.015,
          sx: 0.08, sy: 0.03, sz: 0.2,
        })
      }
      slot++
    }
    // Safety rail on the upper deck.
    add({ kind: 'frame', lx, lz: lz + (lz > 0 ? -1 : 1) * pz, y: BUNK.upperY + 0.07, sx: BUNK.len * 0.7, sy: 0.02, sz: BUNK.post })
  }

  const placeWall = (count: number, side: 1 | -1) => {
    for (let i = 0; i < count; i++) {
      drawBunk(towardDoor(MARGIN + BUNK.len / 2 + i * (BUNK.len + 0.02)), side * wallZ)
    }
    // A wall with room left at the door end gets a wardrobe there.
    const used = MARGIN + count * (BUNK.len + 0.02)
    if (L - used - MARGIN >= WARDROBE.len) {
      add({
        kind: 'wood',
        lx: doorSign * (L / 2 - MARGIN - WARDROBE.len / 2),
        lz: side * (W / 2 - MARGIN - WARDROBE.depth / 2),
        y: WARDROBE.height / 2,
        sx: WARDROBE.len, sy: WARDROBE.height, sz: WARDROBE.depth,
      })
    }
  }
  placeWall(wallA, -1)
  placeWall(wallB, 1)

  // Desk under the window, between the two bed rows.
  const aisle = W - 2 * (MARGIN + BUNK.width) - 0.06
  const deskLen = Math.min(DESK.maxLen, aisle)
  if (deskLen > 0.2) {
    const deskX = towardDoor(MARGIN + DESK.depth / 2)
    add({ kind: 'wood', lx: deskX, lz: 0, y: DESK.height - DESK.top / 2, sx: DESK.depth, sy: DESK.top, sz: deskLen })
    for (const s of [-1, 1]) {
      add({ kind: 'wood', lx: deskX, lz: s * (deskLen / 2 - 0.0125), y: (DESK.height - DESK.top) / 2, sx: DESK.depth, sy: DESK.height - DESK.top, sz: 0.025 })
    }
    const chairs = deskLen >= 0.4 ? 2 : 1
    const chairX = towardDoor(MARGIN + DESK.depth + CHAIR.seat / 2 + 0.02)
    for (let c = 0; c < chairs; c++) {
      const lz = chairs === 1 ? 0 : (c === 0 ? -1 : 1) * deskLen / 4
      add({ kind: 'chair', lx: chairX, lz, y: CHAIR.seatY, sx: CHAIR.seat, sy: 0.02, sz: CHAIR.seat })
      add({ kind: 'chair', lx: chairX, lz, y: CHAIR.seatY / 2, sx: 0.03, sy: CHAIR.seatY, sz: 0.03 })
      add({
        kind: 'chair',
        lx: chairX + doorSign * (CHAIR.seat / 2 - 0.01),
        lz,
        y: CHAIR.seatY + CHAIR.back / 2,
        sx: 0.02, sy: CHAIR.back, sz: CHAIR.seat,
      })
    }
  }

  return out
}
