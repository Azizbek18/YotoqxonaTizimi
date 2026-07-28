import 'server-only'
import { ApiError } from '@/server/http/api-error'
import { createAppSettingsService } from '@/features/app-settings/server/service'
import type { FacultyStudentRow } from '../types'
import { createRoomAssignmentRepository, type RoomAssignmentRepository } from './repository'

function sameFaculty(value: string | null | undefined, faculty: string) {
  return (value ?? '').trim().toLocaleLowerCase() === faculty.trim().toLocaleLowerCase()
}

export function createRoomAssignmentService(repository: RoomAssignmentRepository = createRoomAssignmentRepository()) {
  return {
    async listStudents(facultyValue: string | null): Promise<FacultyStudentRow[]> {
      const faculty = facultyValue?.trim()
      if (!faculty) throw new ApiError(403, 'Zamdekan fakulteti biriktirilmagan')
      return (await repository.listFacultyStudents(faculty)) as FacultyStudentRow[]
    },

    async assignRoom(facultyValue: string | null, value: unknown) {
      const faculty = facultyValue?.trim()
      if (!faculty) throw new ApiError(403, 'Zamdekan fakulteti biriktirilmagan')
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ApiError(400, "So'rov noto'g'ri")
      const input = value as Record<string, unknown>

      const studentId = typeof input.studentId === 'string' ? input.studentId.trim() : ''
      if (!studentId) throw new ApiError(400, "Talaba tanlanmagan")
      const roomNumber = typeof input.roomNumber === 'string' ? input.roomNumber.trim().slice(0, 20) : ''

      const student = await repository.findStudent(studentId)
      if (!student) throw new ApiError(404, 'Talaba topilmadi')
      if (student.role !== 'talaba') throw new ApiError(403, "Faqat talaba akkountlarini joylashtirish mumkin")
      if (!sameFaculty(student.faculty, faculty)) throw new ApiError(403, 'Boshqa fakultet talabasini joylashtirib bo\'lmaydi')

      if (!roomNumber) {
        await repository.clearStudentRoom(studentId)
        return { success: true as const }
      }

      if (roomNumber === student.room_number) {
        return { success: true as const }
      }

      const { defaultRoomCapacity } = await createAppSettingsService().get()
      // Room existence is checked inside the RPC itself (same advisory
      // lock/transaction as the capacity check) — a separate SELECT here
      // first would leave a window where the room could be deleted from
      // floor_room_layout between the check and the actual assignment.
      try {
        const assigned = await repository.assignRoomAtomic(studentId, roomNumber, defaultRoomCapacity)
        if (!assigned) {
          throw new ApiError(409, "Bu xonada bo'sh joy yo'q yoki xonada boshqa jinsdagi talaba(lar) bor")
        }
      } catch (error) {
        if ((error as { code?: string } | null)?.code === 'P0002') {
          throw new ApiError(404, 'Bunday xona xonalar sxemasida topilmadi')
        }
        throw error
      }
      return { success: true as const }
    },
  }
}
