import 'server-only'
import type { AdminDashboardPayload } from '../types'
import { createAdminDashboardRepository, type AdminDashboardRepository } from './repository'

export function createAdminDashboardService(repository: AdminDashboardRepository = createAdminDashboardRepository()) {
  return {
    async get(): Promise<AdminDashboardPayload> {
      const { users, staff, applications } = await repository.load()
      const students = users.filter((user) => user.role === 'talaba')
      const educators = staff.filter((employee) => employee.role === 'tarbiyachi').length
        + users.filter((user) => user.role === 'tarbiyachi').length
      const admins = staff.filter((employee) => employee.role === 'admin').length
        + users.filter((user) => user.role === 'admin').length
      const status = (value: string | null) => String(value ?? '').toLowerCase()
      return {
        stats: {
          totalStudents: students.length,
          totalRequests: applications.length,
          totalUsers: users.length + staff.length,
          totalEducators: educators,
          approvedRequests: applications.filter((row) => ['approved', 'tasdiqlangan'].includes(status(row.status))).length,
          pendingRequests: applications.filter((row) => status(row.status) === 'pending').length,
          rejectedRequests: applications.filter((row) => ['rejected', 'rad etilgan'].includes(status(row.status))).length,
        },
        roleCounts: { students: students.length, educators, admins },
        users,
        students,
        applications,
      }
    },
  }
}
