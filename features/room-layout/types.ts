export type RoomBlockSide = 'left' | 'right'
export type RoomBlockSize = 'small' | 'medium' | 'large'

export type RoomLayoutBlock = {
  roomNumber: string
  side: RoomBlockSide
  position: number
  size: RoomBlockSize
  /** Per-room bed count override. null/undefined = inherit
   *  dorms.default_room_capacity (migration 202609180000). */
  capacity?: number | null
}

// Which floor a room sits on, exactly as the admin entered it in the
// Qavat tarxi quruvchisi. This is the app's only real answer to "qaysi
// xona qaysi qavatda" — every other floor number in the UI used to be
// guessed from the room number (see extractFloor in lib/floor.ts).
export type RoomFloor = {
  roomNumber: string
  floor: number
}

// RoomFloor plus its ta'mirlash (renovation) freeze state. A separate type
// from RoomFloor rather than adding these fields there: RoomFloor also
// describes rooms that don't exist yet (see planRoomNumbers in plan.ts),
// where "frozen" has no meaning.
export type RoomFloorStatus = RoomFloor & {
  /** True while a dekan has taken this room out of circulation (e.g. ta'mirlash). */
  frozen: boolean
  /** Free-text reason shown alongside the frozen state; null when not frozen. */
  frozenReason: string | null
  /** Per-room bed count override; null = inherit dorms.default_room_capacity. */
  capacity: number | null
}

/** How many rooms each floor should get when generating a layout from scratch. */
export type FloorRoomPlan = {
  floor: number
  rooms: number
}

/**
 * 'sequential' — 1..30 on floor 1, 31..60 on floor 2 (this building's
 * existing numbering: occupied rooms run 3..150 across five floors).
 * 'per-floor' — 101..130, 201..230, the other common dormitory scheme.
 */
export type RoomNumbering = 'sequential' | 'per-floor'
