import 'server-only'
import { ApiError } from '@/server/http/api-error'
import type { Json } from '@/types/database.generated'
import { normalizeCleaningSchedule } from '../domain/validation'
import { createCleaningScheduleRepository, type CleaningScheduleRepository } from './repository'

export function createCleaningScheduleService(repository: CleaningScheduleRepository = createCleaningScheduleRepository()) {
  async function room(studentId: string) {
    const roomNumber = await repository.getRoomNumber(studentId)
    if (!roomNumber) throw new ApiError(409, 'Talabaga xona biriktirilmagan')
    return roomNumber
  }
  return {
    async get(studentId: string) {
      const roomNumber = await room(studentId)
      const data = await repository.get(roomNumber)
      return { success: true as const, roomNumber, schedule: data?.schedule ?? null, updatedAt: data?.updated_at ?? null }
    },
    async save(studentId: string, value: unknown) {
      const roomNumber = await room(studentId)
      const schedule = normalizeCleaningSchedule(value)
      const data = await repository.save(roomNumber, schedule as Json)
      return { success: true as const, roomNumber, schedule: data.schedule, updatedAt: data.updated_at }
    },
  }
}
