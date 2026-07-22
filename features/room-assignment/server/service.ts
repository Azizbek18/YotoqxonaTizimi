import 'server-only'
import { ApiError } from '@/server/http/api-error'
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
        await repository.updateStudentRoom(studentId, null)
        return { success: true as const }
      }

      if (roomNumber === student.room_number) {
        return { success: true as const }
      }

      if (await repository.roomOccupants(roomNumber) >= 4) {
        throw new ApiError(409, "Bu xonada bo'sh joy yo'q")
      }

      const existingGenders = await repository.roomGenders(roomNumber)
      if (student.gender && existingGenders.some((gender) => gender !== student.gender)) {
        throw new ApiError(409, 'Xonada boshqa jinsdagi talaba(lar) bor')
      }

      await repository.updateStudentRoom(studentId, roomNumber)
      return { success: true as const }
    },
  }
}
