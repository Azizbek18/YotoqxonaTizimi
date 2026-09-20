import 'server-only'
import { getServiceSupabase } from '@/lib/server-supabase'
import type { AnnouncementStoryRow } from '@/types/database.generated'

const COLUMNS =
  'id, title, caption, type, image_path, image_url, link_url, faculty, target_gender, created_by, author_name, created_at, expires_at'

export function createStoryRepository() {
  const supabase = getServiceSupabase()
  return {
    /**
     * Active (not expired) stories for a faculty, newest first.
     * `gender`, when given, additionally excludes stories targeted at the
     * other gender only (a kengash raisi's) — pass it for the student-facing
     * feed; omit it for staff management views, which see everything.
     */
    async listActiveByFaculty(faculty: string, gender?: string) {
      let query = supabase
        .from('announcement_stories')
        .select(COLUMNS)
        .ilike('faculty', faculty)
        .gt('expires_at', new Date().toISOString())
      if (gender) query = query.or(`target_gender.is.null,target_gender.eq.${gender}`)
      const { data, error } = await query.order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as AnnouncementStoryRow[]
    },

    async insert(row: {
      title: string
      caption: string | null
      type: string
      image_path: string
      image_url: string
      link_url: string | null
      faculty: string
      target_gender: string | null
      created_by: string
      author_name: string | null
    }) {
      const { data, error } = await supabase
        .from('announcement_stories')
        .insert(row)
        .select(COLUMNS)
        .single()
      if (error) throw error
      return data as AnnouncementStoryRow
    },

    // `authorId`, when given, additionally pins the row to its creator — a
    // tarbiyachi may only delete stories they posted, while a dekan / admin
    // (no `authorId`) manages every story of their faculty.
    async deleteByFaculty(id: string, faculty: string, authorId?: string) {
      let query = supabase
        .from('announcement_stories')
        .delete()
        .eq('id', id)
        .ilike('faculty', faculty)
      if (authorId) query = query.eq('created_by', authorId)
      const { data, error } = await query.select('id, image_path').maybeSingle()
      if (error) throw error
      return data as { id: string; image_path: string } | null
    },

    /** Active students of a faculty (id + faculty), for broadcast targeting. */
    async listActiveStudentIdsByFaculty(faculty: string, gender?: string | null) {
      let query = supabase
        .from('users')
        .select('id')
        .eq('role', 'talaba')
        .eq('status', 'active')
        .ilike('faculty', faculty)
      if (gender) query = query.eq('gender', gender)
      const { data, error } = await query
      if (error) throw error
      return (data ?? []).map((r) => r.id as string)
    },

    /** Linked Telegram chat ids for the given students. */
    async listTelegramChatIds(studentIds: string[]) {
      if (studentIds.length === 0) return []
      const { data, error } = await supabase
        .from('student_telegram_links')
        .select('chat_id')
        .in('student_id', studentIds)
        .not('chat_id', 'is', null)
      if (error) throw error
      return (data ?? [])
        .map((r) => r.chat_id as number | null)
        .filter((id): id is number => id != null)
    },
  }
}

export type StoryRepository = ReturnType<typeof createStoryRepository>
