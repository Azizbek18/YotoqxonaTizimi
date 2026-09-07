/**
 * Shared-dorm tenancy DTOs. A dorm is a building shell; its floors are
 * partitioned between faculties by a two-sided dekan handshake (P1).
 * Plan: https://claude.ai/code/artifact/abdee3c8-1065-4b46-ad6c-77de82844da3
 */

/** A floor's state as seen by the dekan looking at it. */
export type DormFloorState =
  | 'mine'          // confirmed to my faculty
  | 'mine_pending'  // I proposed it — waiting on the co-dekan
  | 'incoming'      // another faculty proposed it and I need to confirm/reject
  | 'other_pending' // another faculty proposed it; not mine to resolve
  | 'other'         // confirmed to another faculty
  | 'free'          // unclaimed

export type DormFloor = {
  floor: number
  ownerFaculty: string | null
  pendingFaculty: string | null
  state: DormFloorState
}

export type IncomingClaim = {
  floor: number
  faculty: string
  at: string
}

/** Building-wide yo'qlama (attendance) config — shared by every faculty in
 *  the dorm, edited once from Sozlamalar. */
export type DormAttendanceConfig = {
  latitude: number | null
  longitude: number | null
  radiusM: number
  enabled: boolean
  /** HH:MM, local Tashkent time. */
  openTime: string
  closeTime: string
}

export type DekanDorm = {
  dormId: string
  number: string
  name: string
  floorCount: number
  faculty: string
  floors: DormFloor[]
  /** Faculties other than mine confirmed on at least one floor. */
  coFaculties: string[]
  /** Floors another faculty proposed that I must confirm or reject. */
  incoming: IncomingClaim[]
  attendance: DormAttendanceConfig
  /** Whether this is my faculty's primary building — the one every
   *  "which dorm?" lookup that can't name one resolves to (many-to-many,
   *  202609300000). A faculty with one building always has isPrimary: true
   *  here; this only matters once a second building exists. */
  isPrimary: boolean
}

/** What the onboarding floor-picker needs before the dekan commits. */
export type DormPreview = {
  exists: boolean
  number: string
  name: string
  floorCount: number
  /** Per floor: who holds it and whether it's already spoken for. */
  floors: Array<{
    floor: number
    ownerFaculty: string | null
    pendingFaculty: string | null
    taken: boolean
  }>
}

/** One building as the superadmin sees it — full settings + partition. */
export type SuperadminDorm = {
  id: string
  number: string
  name: string
  address: string
  floorCount: number
  defaultRoomCapacity: number
  /** 'simple' — floor partition via dorm_floor. 'blocked' — A/B wings, section
   *  (block+floor) ownership via dorm_section, per-floor room numbering. */
  layoutKind: 'simple' | 'blocked'
  blockCount: number
  ttjName: string
  tarbiyachiName: string
  tarbiyachiPhone: string
  komendantName: string
  komendantPhone: string
  doctorName: string
  doctorPhone: string
  securityPhone: string
  faculties: string[]
  floors: Array<{ floor: number; faculty: string | null; pendingFaculty: string | null }>
  residentCount: number
}

// ---- blocked-layout dorm (6-yotoqxona) ----
// Fixed per the hand drawing: every block, every floor has 9 rooms numbered
// 1–9 with these bed counts. Room 1 = 4, room 5 = 8 (four bunk beds), the
// rest = 6 (three bunk beds). One section (block+floor) = 54 beds.
export const BLOCKED_ROOM_CAPACITIES: readonly number[] = [4, 6, 6, 6, 8, 6, 6, 6, 6]
export const BLOCKED_BEDS_PER_SECTION = BLOCKED_ROOM_CAPACITIES.reduce((a, b) => a + b, 0)

/** One section of a blocked dorm as the superadmin grid shows it. */
export type DormSection = {
  block: string
  floor: number
  /** null = not yet handed to any faculty. */
  faculty: string | null
  /** Whole section reserved for one gender, or null = mixed. */
  gender: 'male' | 'female' | null
  residentCount: number
}

// ---- dekan's read + assign view of the blocked-dorm rooms they own ----
export type BlockedRoomOccupant = {
  name: string
  gender: 'male' | 'female' | null
  /** 'user' = registered resident · 'permit' = approved, room reserved, not yet registered. */
  kind: 'user' | 'permit'
}

export type BlockedRoom = {
  roomNumber: string
  capacity: number
  frozen: boolean
  gender: 'male' | 'female' | null
  occupants: BlockedRoomOccupant[]
}

export type BlockedRoomSection = {
  block: string
  floor: number
  gender: 'male' | 'female' | null
  rooms: BlockedRoom[]
}

export type BlockedRoomMapDorm = {
  dormId: string
  number: string
  name: string
  blockCount: number
  floorCount: number
  /** Only the sections this faculty owns, sorted by block then floor. */
  sections: BlockedRoomSection[]
}

/** The full A1…B12 ownership grid for a blocked building. */
export type BlockedDormGrid = {
  dormId: string
  number: string
  name: string
  blockCount: number
  floorCount: number
  roomsPerSection: number
  bedsPerSection: number
  /** blockCount × floorCount entries; unassigned sections have faculty: null. */
  sections: DormSection[]
}

export type DormSetupInput = {
  /** Building number the dekan types. */
  number: string
  /** Only used when this number creates a brand-new dorm shell. */
  floorCount?: number
  roomCapacity?: number
  /** Floors this dekan claims. Empty = claim every floor (auto-confirms
   *  only if the faculty is alone in the building). */
  floors: number[]
  /** True: claim this building ALONGSIDE the faculty's existing one(s) —
   *  never unlinks anything. False/omitted: the original single-dorm
   *  behaviour (first-time setup links this as primary; naming a different
   *  building than the current one MOVES to it, refused once residents
   *  exist). */
  additional?: boolean
}
