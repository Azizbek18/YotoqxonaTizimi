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

export type DormSetupInput = {
  /** Building number the dekan types. */
  number: string
  /** Only used when this number creates a brand-new dorm shell. */
  floorCount?: number
  roomCapacity?: number
  /** Floors this dekan claims. Empty = claim every floor (auto-confirms
   *  only if the faculty is alone in the building). */
  floors: number[]
}
