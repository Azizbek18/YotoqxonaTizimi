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

export type ZamdekanOverview = {
  faculty: string
  requests: EnrichedPermitRequest[]
  roomOccupancy: Record<string, number>
  usersWithRooms: PermitRoomUser[]
  approvedPermitsWithRooms: PermitRequestRow[]
  dashboard: {
    pendingCount: number
    approvedCount: number
    rejectedCount: number
    registeredCount: number
    activeStudentsCount: number
    totalOccupiedBeds: number
    courseDistribution: { course: string; talabalar: number }[]
    facultyDistribution: { name: string; talabalar: number }[]
    recentRequests: PermitRequestRow[]
  }
}
