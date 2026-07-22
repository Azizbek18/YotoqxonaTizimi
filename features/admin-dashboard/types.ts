import type { ApplicationRow, UserRow } from '@/types/database.generated'

export type AdminDashboardPayload = {
  stats: {
    totalStudents: number
    totalRequests: number
    totalUsers: number
    totalEducators: number
    approvedRequests: number
    pendingRequests: number
    rejectedRequests: number
  }
  roleCounts: {
    students: number
    educators: number
    admins: number
  }
  users: UserRow[]
  students: UserRow[]
  applications: Pick<ApplicationRow, 'created_at' | 'status' | 'type'>[]
}
