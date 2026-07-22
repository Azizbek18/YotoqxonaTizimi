import 'server-only'
import { extractFloor } from '@/lib/floor'
import type { StudentAnnouncementsPayload } from '../types'
import { createAnnouncementRepository, type AnnouncementRepository } from './repository'

export function createAnnouncementService(repository: AnnouncementRepository = createAnnouncementRepository()) {
  return {
    async listForUser(userId: string | null): Promise<StudentAnnouncementsPayload> {
      const profile = userId ? await repository.findAudienceProfile(userId) : null
      const currentFaculty = profile?.faculty?.trim() || null
      const userFloor = profile?.assigned_floor || extractFloor(profile?.room_number ?? null)
      const userGender = profile?.gender || null
      const rows = await repository.listPublished()
      const creatorIds = Array.from(new Set(rows.map((row) => row.created_by).filter(Boolean))) as string[]
      const [students, staff] = await Promise.all([
        repository.listStudentCreators(creatorIds),
        repository.listStaffCreators(creatorIds),
      ])
      const creators = new Map<string, { name: string; isCaptain: boolean; floor?: number }>()
      students.forEach((student) => creators.set(student.id, {
        name: student.full_name || 'Talaba',
        isCaptain: Boolean(student.is_floor_captain),
        floor: student.assigned_floor ?? undefined,
      }))
      staff.forEach((employee) => creators.set(employee.id, {
        name: employee.full_name,
        isCaptain: false,
      }))

      const elonlar = rows
        .filter((row) => {
          if (row.audience === 'all') return true
          if (row.audience === 'faculty') return Boolean(currentFaculty && row.faculty === currentFaculty)
          if (row.audience === 'floor') {
            return Boolean(
              userFloor
              && (row.target_floor === null || row.target_floor === userFloor)
              && (row.target_gender === null || row.target_gender === userGender),
            )
          }
          return false
        })
        .map((row) => {
          const creator = creators.get(row.created_by || '')
          return {
            id: row.id,
            title: row.title,
            text: row.text,
            type: row.type as 'Muhim' | 'Tadbir' | 'Yangilik' | 'Ogohlantirish',
            audience: row.audience as 'all' | 'faculty' | 'floor',
            faculty: row.faculty,
            created_at: row.created_at,
            published_at: row.published_at,
            author_name: creator?.name ?? "Tizim ma'muri",
            is_from_captain: creator?.isCaptain ?? false,
            captain_floor: creator?.floor,
          }
        })
      return { elonlar, currentFaculty }
    },
  }
}
