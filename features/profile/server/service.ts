import 'server-only'
import { ApiError } from '@/server/http/api-error'
import type { UserRow } from '@/types/database.generated'
import type { StudentProfilePayload, StudentProfileUpdate } from '../types'
import { createProfileRepository, type ProfileRepository } from './repository'
import { extractFloor } from '@/lib/floor'

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
        ? await repository.listRoommates(studentId, profile.room_number, profile)
        : []
      const floor = profile.assigned_floor
        ?? extractFloor(profile.room_number)
      const floorCaptain = floor && profile.gender
        ? await repository.findFloorCaptain(floor, profile.gender, profile)
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
      const group = optionalText(input.group, 40)
      if (group !== undefined) updates.group = group

      if (input.residenceAddress !== undefined) {
        const address = optionalText(input.residenceAddress, 300)
        if (!address || address.length < 5) throw new ApiError(400, 'Manzilni kiriting (kamida 5 ta belgi)')
        const current = await repository.findStudent(studentId)
        if (!current) throw new ApiError(404, 'Talaba profili topilmadi')
        if (current.is_off_campus !== true) {
          throw new ApiError(403, 'Yashash manzili faqat kvartirada turuvchi talaba uchun')
        }
        const lat = Number(input.residenceLat)
        const lng = Number(input.residenceLng)
        const hasCoords = input.residenceLat != null && input.residenceLng != null
          && Number.isFinite(lat) && Number.isFinite(lng)
          && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
        updates.residence_address = address
        updates.residence_lat = hasCoords ? lat : null
        updates.residence_lng = hasCoords ? lng : null
      }
      if (Object.keys(updates).length === 0) {
        throw new ApiError(400, 'Yangilash uchun ruxsat etilgan ma’lumot topilmadi')
      }
      const data = await repository.updateStudent(studentId, updates)
      if (!data) throw new ApiError(404, 'Talaba profili topilmadi')
      return { success: true as const, data, message: 'Profil muvaffaqiyatli yangilandi' }
    },
  }
}
