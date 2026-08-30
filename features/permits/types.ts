import type { PermitRequestRow } from '@/types/database.generated'

export type EnrichedPermitRequest = PermitRequestRow & {
  warning_count: number
  blacklisted: boolean
}

export type PermitRoomUser = {
  id: string
  full_name: string | null
  passport_series: string | null
  jshshir: string | null
  phone_number: string | null
  gender: string | null
  faculty: string | null
  direction: string | null
  course: number | null
  room_number: string | null
  warning_count: number | null
}

export type DekanOverview = {
  faculty: string
  requests: EnrichedPermitRequest[]
  usersWithRooms: PermitRoomUser[]
  approvedPermitsWithRooms: PermitRequestRow[]
  dashboard: {
    pendingCount: number
    approvedCount: number
    rejectedCount: number
    registeredCount: number
    activeStudentsCount: number
    /** Students + approved-permit reservations holding a room, this faculty's scope. */
    totalOccupiedBeds: number
    /** Beds in non-frozen rooms on this dekan's floors (per-room capacity applied). */
    availableBeds: number
    /** Unoccupied beds in those non-frozen rooms — the real "bo'sh joy". */
    freeBeds: number
    /** How many of this dekan's rooms are frozen for ta'mirlash. */
    frozenRoomCount: number
    courseDistribution: { course: string; talabalar: number }[]
    facultyDistribution: { name: string; talabalar: number }[]
    recentRequests: PermitRequestRow[]
  }
}
