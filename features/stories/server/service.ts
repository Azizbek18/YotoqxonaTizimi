import 'server-only'
import { ApiError } from '@/server/http/api-error'
import type { AnnouncementStoryRow } from '@/types/database.generated'
import { ANNOUNCEMENT_TYPES, type StaffStory, type Story, type StoryInput, type StoryType } from '../types'
import { createStoryRepository, type StoryRepository } from './repository'

const TYPE_SET = new Set<string>(ANNOUNCEMENT_TYPES)

function toStory(row: AnnouncementStoryRow): Story {
  return {
    id: row.id,
    title: row.title,
    caption: row.caption,
    type: (TYPE_SET.has(row.type) ? row.type : 'Yangilik') as StoryType,
    image_url: row.image_url,
    link_url: row.link_url,
    author_name: row.author_name || "Ma'muriyat",
    created_at: row.created_at,
    expires_at: row.expires_at,
  }
}

/**
 * Validates the text fields of a new story. The image itself is validated and
 * uploaded by the Route Handler (magic-byte check, size cap) — by the time we
 * get here `image_url` / `image_path` are trusted server-produced strings.
 */
export function parseStoryInput(value: unknown): StoryInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ApiError(400, "So'rov noto'g'ri")
  }
  const input = value as Record<string, unknown>

  const title = typeof input.title === 'string' ? input.title.trim() : ''
  if (title.length < 2 || title.length > 120) {
    throw new ApiError(400, "Sarlavha 2–120 belgidan iborat bo'lishi kerak")
  }

  const rawCaption = typeof input.caption === 'string' ? input.caption.trim() : ''
  if (rawCaption.length > 500) {
    throw new ApiError(400, "Qisqacha ma'lumot 500 belgidan oshmasligi kerak")
  }
  const caption = rawCaption.length > 0 ? rawCaption : null

  const type = typeof input.type === 'string' ? input.type : ''
  if (!TYPE_SET.has(type)) throw new ApiError(400, "Yangilik turi noto'g'ri")

  const rawLink = typeof input.link_url === 'string' ? input.link_url.trim() : ''
  if (rawLink && !/^https?:\/\/\S+$/.test(rawLink)) {
    throw new ApiError(400, "Havola http:// yoki https:// bilan boshlanishi kerak")
  }
  const link_url = rawLink || null

  const image_url = typeof input.image_url === 'string' ? input.image_url : ''
  const image_path = typeof input.image_path === 'string' ? input.image_path : ''
  if (!image_url || !image_path) throw new ApiError(400, 'Rasm yuklanmadi')

  return { title, caption, type: type as StoryType, link_url, image_url, image_path }
}

export function createStoryService(repository: StoryRepository = createStoryRepository()) {
  return {
    /** Signed-out or faculty-less reader → empty list, never an error. */
    async listForStudent(facultyValue: string | null): Promise<Story[]> {
      const faculty = facultyValue?.trim()
      if (!faculty) return []
      const rows = await repository.listActiveByFaculty(faculty)
      return rows.map(toStory)
    },

    async listAuthored(facultyValue: string | null): Promise<StaffStory[]> {
      const faculty = facultyValue?.trim()
      if (!faculty) throw new ApiError(403, 'Xodim fakulteti biriktirilmagan')
      const rows = await repository.listActiveByFaculty(faculty)
      return rows.map((row) => ({ ...toStory(row), created_by: row.created_by }))
    },

    async create(
      creatorId: string,
      authorName: string | null,
      facultyValue: string | null,
      value: unknown,
    ): Promise<AnnouncementStoryRow> {
      const faculty = facultyValue?.trim().toLocaleLowerCase()
      if (!faculty) throw new ApiError(403, 'Xodim fakulteti biriktirilmagan')
      const input = parseStoryInput(value)
      return repository.insert({
        title: input.title,
        caption: input.caption,
        type: input.type,
        image_path: input.image_path,
        image_url: input.image_url,
        link_url: input.link_url,
        faculty,
        created_by: creatorId,
        author_name: authorName?.trim() || null,
      })
    },

    /** Returns the deleted row's storage path so the route can clean up the file. */
    async remove(
      facultyValue: string | null,
      idValue: string | null,
      authorId?: string,
    ): Promise<{ image_path: string }> {
      const faculty = facultyValue?.trim()
      if (!faculty) throw new ApiError(403, 'Xodim fakulteti biriktirilmagan')
      const id = (idValue ?? '').trim()
      if (!id) throw new ApiError(400, 'Yangilik tanlanmagan')
      const deleted = await repository.deleteByFaculty(id, faculty, authorId)
      if (!deleted) throw new ApiError(404, 'Yangilik topilmadi')
      return { image_path: deleted.image_path }
    },
  }
}

export type StoryService = ReturnType<typeof createStoryService>
