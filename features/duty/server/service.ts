import 'server-only'
import { ApiError } from '@/server/http/api-error'
import type { Json } from '@/types/database.generated'
import { normalizeCleaningSchedule } from '../domain/validation'
import { createCleaningScheduleRepository, type CleaningScheduleRepository } from './repository'

export function createCleaningScheduleService(repository: CleaningScheduleRepository = createCleaningScheduleRepository()) {
  async function room(studentId: string) {
    const { roomNumber, faculty } = await repository.getRoomAndFaculty(studentId)
    if (!roomNumber) throw new ApiError(409, 'Talabaga xona biriktirilmagan')
    return { roomNumber, faculty }
  }
  return {
    async get(studentId: string) {
      const { roomNumber, faculty } = await room(studentId)
      const data = await repository.get(faculty, roomNumber)
      return { success: true as const, roomNumber, schedule: data?.schedule ?? null, updatedAt: data?.updated_at ?? null }
    },
    async save(studentId: string, value: unknown) {
      const { roomNumber, faculty } = await room(studentId)
      const schedule = normalizeCleaningSchedule(value)

      // An assignee's id must be a real student actually assigned to this
      // room — otherwise any resident could enter an arbitrary id/name pair
      // (a made-up person, or someone else's id with a fake display name)
      // as the "on duty" roommate. The stored name always comes from the
      // roommate lookup, never the client's copy, so a real roommate's
      // display name can't be spoofed either.
      const roommates = await repository.getRoommates(faculty, roomNumber)
      const roommateNames = new Map(roommates.map((r) => [r.id, r.full_name]))
      for (const assignee of Object.values(schedule)) {
        if (!assignee) continue
        if (!roommateNames.has(assignee.id)) {
          throw new ApiError(400, 'Faqat shu xonaga biriktirilgan talabalarni navbatchi qilib belgilash mumkin')
        }
        assignee.name = roommateNames.get(assignee.id) || assignee.name
      }

      const data = await repository.save(faculty, roomNumber, schedule as Json)
      return { success: true as const, roomNumber, schedule: data.schedule, updatedAt: data.updated_at }
    },
  }
}
