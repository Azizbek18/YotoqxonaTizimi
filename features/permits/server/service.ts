import 'server-only'
import { ApiError } from '@/server/http/api-error'
import type { ZamdekanOverview } from '../types'
import { createPermitAdminRepository, type PermitAdminRepository } from './repository'

function sameFaculty(value: string | null, faculty: string) {
  return (value ?? '').trim().toLocaleLowerCase() === faculty.trim().toLocaleLowerCase()
}

export function createPermitAdminService(repository: PermitAdminRepository = createPermitAdminRepository()) {
  return {
    async overview(facultyValue: string | null): Promise<ZamdekanOverview> {
      const faculty = facultyValue?.trim()
      if (!faculty) throw new ApiError(403, 'Zamdekan fakulteti biriktirilmagan')
      const { permits, users } = await repository.load()
      const students = users.filter((user) => user.role === 'talaba')
      const scoped = permits.filter((permit) => sameFaculty(permit.faculty, faculty))
      const userByPassport = new Map(students.filter((user) => user.passport_series).map((user) => [user.passport_series, user]))
      const userByJshshir = new Map(students.filter((user) => user.jshshir).map((user) => [user.jshshir, user]))
      const requests = scoped.map((permit) => {
        const linked = userByPassport.get(permit.passport_series) ?? userByJshshir.get(permit.jshshir)
        return { ...permit, warning_count: linked?.warning_count ?? 0, blacklisted: linked?.blacklisted ?? false }
      })
      const usersWithRooms = students.filter((user) => Boolean(user.room_number)).map((user) => ({
        id: user.id,
        full_name: user.full_name,
        passport_series: user.passport_series,
        jshshir: user.jshshir,
        phone_number: user.phone_number,
        gender: user.gender,
        faculty: user.faculty,
        direction: user.direction,
        course: user.course,
        room_number: user.room_number,
        warning_count: user.warning_count,
      }))
      const approvedPermitsWithRooms = permits.filter((permit) => permit.status === 'approved' && permit.room_number)
      const roomOccupancy: Record<string, number> = {}
      usersWithRooms.forEach((user) => {
        if (user.room_number) roomOccupancy[user.room_number] = (roomOccupancy[user.room_number] ?? 0) + 1
      })
      approvedPermitsWithRooms.forEach((permit) => {
        if (permit.room_number) roomOccupancy[permit.room_number] = (roomOccupancy[permit.room_number] ?? 0) + 1
      })
      const courses: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 }
      const faculties: Record<string, number> = {}
      const addDistribution = (course: number | null, targetFaculty: string | null) => {
        if (course && courses[course] !== undefined) courses[course]++
        if (targetFaculty) faculties[targetFaculty] = (faculties[targetFaculty] ?? 0) + 1
      }
      permits.filter((permit) => permit.status === 'approved' || permit.status === 'registered')
        .forEach((permit) => addDistribution(permit.course, permit.faculty))
      usersWithRooms.forEach((user) => addDistribution(user.course, user.faculty))
      return {
        faculty,
        requests,
        roomOccupancy,
        usersWithRooms,
        approvedPermitsWithRooms,
        dashboard: {
          pendingCount: scoped.filter((permit) => permit.status === 'pending').length,
          approvedCount: scoped.filter((permit) => permit.status === 'approved').length,
          rejectedCount: scoped.filter((permit) => permit.status === 'rejected').length,
          registeredCount: scoped.filter((permit) => permit.status === 'registered').length,
          activeStudentsCount: students.filter((user) => user.status === 'active').length,
          totalOccupiedBeds: usersWithRooms.length + approvedPermitsWithRooms.length,
          courseDistribution: Object.entries(courses).map(([course, talabalar]) => ({ course: `${course}-kurs`, talabalar })),
          facultyDistribution: Object.entries(faculties).map(([name, talabalar]) => ({ name, talabalar })),
          recentRequests: scoped.filter((permit) => permit.status === 'pending').slice(0, 5),
        },
      }
    },

    async update(facultyValue: string | null, value: unknown) {
      const faculty = facultyValue?.trim()
      if (!faculty) throw new ApiError(403, 'Zamdekan fakulteti biriktirilmagan')
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ApiError(400, 'So\'rov noto\'g\'ri')
      const input = value as Record<string, unknown>
      const id = typeof input.id === 'string' ? input.id.trim() : ''
      const action = input.action
      if (!id || (action !== 'approve' && action !== 'reject')) throw new ApiError(400, 'So\'rov noto\'g\'ri')
      const existing = await repository.find(id)
      if (!existing) throw new ApiError(404, 'Yo\'llanma topilmadi')
      if (!sameFaculty(existing.faculty, faculty)) throw new ApiError(403, 'Boshqa fakultet yo\'llanmasini boshqarib bo\'lmaydi')
      if (action === 'approve') {
        const roomNumber = typeof input.roomNumber === 'string' ? input.roomNumber.trim().slice(0, 20) : ''
        if (!roomNumber) throw new ApiError(400, 'Xona tanlanmagan')
        if (await repository.roomOccupancy(roomNumber) >= 4) throw new ApiError(409, 'Bu xonada bo\'sh joy yo\'q')
        const request = await repository.update(id, { status: 'approved', room_number: roomNumber, reject_reason: null })
        return { success: true as const, request }
      }
      const reason = typeof input.reason === 'string' ? input.reason.trim().slice(0, 2000) : ''
      if (!reason) throw new ApiError(400, 'Rad etish sababi talab qilinadi')
      const request = await repository.update(id, { status: 'rejected', room_number: null, reject_reason: reason })
      return { success: true as const, request }
    },
  }
}
