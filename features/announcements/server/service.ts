import 'server-only'
import { extractFloor } from '@/lib/floor'
import { PRIMARY_FACULTY } from '@/lib/faculties'
import { ApiError } from '@/server/http/api-error'
import type { AnnouncementRow } from '@/types/database.generated'
import { ANNOUNCEMENT_TYPES, type AnnouncementType, type AuthoredAnnouncement, type StudentAnnouncementsPayload } from '../types'
import { createAnnouncementRepository, type AnnouncementRepository } from './repository'

const TYPE_SET = new Set<string>(ANNOUNCEMENT_TYPES)

function parseAnnouncementInput(value: unknown, partial = false) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ApiError(400, "So'rov noto'g'ri")
  const input = value as Record<string, unknown>
  const result: { title?: string; text?: string; type?: AnnouncementType; is_published?: boolean } = {}

  if (!partial || 'title' in input) {
    const title = typeof input.title === 'string' ? input.title.trim() : ''
    if (title.length < 3 || title.length > 160) throw new ApiError(400, "Sarlavha 3–160 belgidan iborat bo'lishi kerak")
    result.title = title
  }
  if (!partial || 'text' in input) {
    const text = typeof input.text === 'string' ? input.text.trim() : ''
    if (text.length < 5 || text.length > 20_000) throw new ApiError(400, "Xabar matni 5–20000 belgidan iborat bo'lishi kerak")
    result.text = text
  }
  if (!partial || 'type' in input) {
    const type = typeof input.type === 'string' ? input.type : ''
    if (!TYPE_SET.has(type)) throw new ApiError(400, "E'lon turi noto'g'ri")
    result.type = type as AnnouncementType
  }
  if (!partial || 'is_published' in input) {
    result.is_published = input.is_published !== false
  }
  return result
}

// A faculty-scoped announcement only reaches a student when the codes on the
// two rows match. They come from different tables (staff.faculty vs
// users.faculty) and the admin panel can edit users.faculty as free text, so
// compare them the same forgiving way the rest of the dekan scoping does —
// otherwise a stray capital letter silently makes an announcement invisible
// to exactly the students it was written for.
export function sameFacultyCode(a: string | null | undefined, b: string | null | undefined) {
  const left = (a ?? '').trim().toLocaleLowerCase()
  const right = (b ?? '').trim().toLocaleLowerCase()
  return left.length > 0 && left === right
}

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
          if (row.audience === 'faculty') return sameFacultyCode(row.faculty, currentFaculty)
          if (row.audience === 'floor') {
            // A floor notice is a sardor's, and a sardor belongs to one
            // faculty's building — so it must not reach the same physical
            // floor number in another faculty's dorm. Faculty-less housed
            // students are treated as the primary building's during the
            // transition (they can only be in the AMIT building today).
            return Boolean(
              userFloor
              && sameFacultyCode(row.faculty, currentFaculty ?? PRIMARY_FACULTY)
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

    async listAuthored(facultyValue: string | null): Promise<AuthoredAnnouncement[]> {
      const faculty = facultyValue?.trim()
      if (!faculty) throw new ApiError(403, 'Dekan fakulteti biriktirilmagan')
      return (await repository.listByFaculty(faculty)) as AuthoredAnnouncement[]
    },

    /**
     * Dekan e'loni har doim o'z fakultetiga yo'naltiriladi — auditoriyani
     * so'rov tanlamaydi. Fakultet kodi trim+lowercase holida saqlanadi, ya'ni
     * talabaning users.faculty qiymati bilan bir xil ko'rinishda (qarang:
     * sameFacultyCode) — shu bilan e'lon aynan o'sha fakultet talabalariga
     * yetib borishi kafolatlanadi.
     */
    async createForFaculty(creatorId: string, facultyValue: string | null, value: unknown) {
      const faculty = facultyValue?.trim().toLocaleLowerCase()
      if (!faculty) throw new ApiError(403, 'Dekan fakulteti biriktirilmagan')
      const input = parseAnnouncementInput(value)
      const isPublished = input.is_published !== false

      return (await repository.insertAuthored({
        title: input.title!,
        text: input.text!,
        type: input.type!,
        audience: 'faculty',
        faculty,
        is_published: isPublished,
        created_by: creatorId,
        published_at: isPublished ? new Date().toISOString() : null,
      })) as AuthoredAnnouncement
    },

    async updateAuthored(facultyValue: string | null, value: unknown) {
      const faculty = facultyValue?.trim()
      if (!faculty) throw new ApiError(403, 'Dekan fakulteti biriktirilmagan')
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ApiError(400, "So'rov noto'g'ri")
      const body = value as Record<string, unknown>
      const id = typeof body.id === 'string' ? body.id.trim() : ''
      if (!id) throw new ApiError(400, "E'lon tanlanmagan")

      const input = parseAnnouncementInput(body, true)
      const updates: Partial<AnnouncementRow> = {}
      if (input.title !== undefined) updates.title = input.title
      if (input.text !== undefined) updates.text = input.text
      if (input.type !== undefined) updates.type = input.type
      if (input.is_published !== undefined) {
        updates.is_published = input.is_published
        // published_at faqat e'lon chop etilganda yangilanadi; qaytarib
        // qo'yilganda eski sana saqlanadi, shunda talaba tarixi buzilmaydi.
        if (input.is_published) updates.published_at = new Date().toISOString()
      }
      if (Object.keys(updates).length === 0) throw new ApiError(400, "Yangilash uchun ma'lumot yo'q")

      const updated = await repository.updateByFaculty(id, faculty, updates)
      if (!updated) throw new ApiError(404, "E'lon topilmadi")
      return updated as AuthoredAnnouncement
    },

    async removeAuthored(facultyValue: string | null, idValue: string | null) {
      const faculty = facultyValue?.trim()
      if (!faculty) throw new ApiError(403, 'Dekan fakulteti biriktirilmagan')
      const id = (idValue ?? '').trim()
      if (!id) throw new ApiError(400, "E'lon tanlanmagan")
      const deleted = await repository.deleteByFaculty(id, faculty)
      if (!deleted) throw new ApiError(404, "E'lon topilmadi")
      return { ok: true as const }
    },
  }
}
