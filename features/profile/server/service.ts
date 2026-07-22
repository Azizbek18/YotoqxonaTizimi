import 'server-only'
import { ApiError } from '@/server/http/api-error'
import type { UserRow } from '@/types/database.generated'
import type { StudentProfilePayload, StudentProfileUpdate } from '../types'
import { createProfileRepository, type ProfileRepository } from './repository'

function optionalText(value: unknown, maxLength: number) {
  if (value === undefined) return undefined
  const text = String(value).trim()
  return text ? text.slice(0, maxLength) : null
}

export function createProfileService(repository: ProfileRepository = createProfileRepository()) {
  return {
    async getProfile(studentId: string): Promise<StudentProfilePayload> {
      const profile = await repository.findStudent(studentId)
      if (!profile) throw new ApiError(404, 'Talaba profili topilmadi')
      const roommates = profile.room_number
        ? await repository.listRoommates(studentId, profile.room_number)
        : []
      const floor = profile.assigned_floor
        ?? (typeof profile.room_number === 'string' ? Number(profile.room_number.match(/^\d/)?.[0]) || null : null)
      const floorCaptain = floor && profile.gender
        ? await repository.findFloorCaptain(floor, profile.gender)
        : null
      return {
        success: true,
        profile,
        roommates,
        roommatesCount: roommates.length,
        floorCaptain,
      }
    },

    async update(studentId: string, input: StudentProfileUpdate) {
      const updates: Partial<UserRow> = {}
      const fullName = optionalText(input.full_name, 160)
      const phone = optionalText(input.phone, 32)
      const group = optionalText(input.group, 40)
      if (fullName !== undefined) updates.full_name = fullName
      if (phone !== undefined) updates.phone_number = phone
      if (group !== undefined) updates.group = group
      if (Object.keys(updates).length === 0) {
        throw new ApiError(400, 'Yangilash uchun ruxsat etilgan ma’lumot topilmadi')
      }
      const data = await repository.updateStudent(studentId, updates)
      if (!data) throw new ApiError(404, 'Talaba profili topilmadi')
      return { success: true as const, data, message: 'Profil muvaffaqiyatli yangilandi' }
    },
  }
}
