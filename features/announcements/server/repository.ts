import 'server-only'
import { getServiceSupabase } from '@/lib/server-supabase'
import type { AnnouncementRow } from '@/types/database.generated'

const AUTHORED_COLUMNS =
  'id, title, text, type, audience, faculty, is_published, created_by, created_at, updated_at, published_at'

export function createAnnouncementRepository() {
  const supabase = getServiceSupabase()
  return {
    async findAudienceProfile(userId: string) {
      const { data, error } = await supabase
        .from('users')
        .select('faculty, room_number, gender, assigned_floor')
        .eq('id', userId)
        .maybeSingle()
      if (error) throw error
      return data
    },
    async listPublished() {
      const { data, error } = await supabase
        .from('elonlar')
        .select('id, title, text, type, audience, faculty, is_published, created_at, published_at, created_by, target_floor, target_gender')
        .eq('is_published', true)
        .neq('title', 'HAFTALIK_NAVBATCHILIK_JADVALI')
        .order('published_at', { ascending: false })
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
    // A dekan manages every faculty announcement of THEIR faculty, not just
    // the ones they personally created — so a replacement dekan inherits the
    // outgoing one's announcements instead of being locked out of them.
    // Scoped to audience='faculty' so a tarbiyachi's floor notice or an
    // admin's dorm-wide one never lands in a dekan's editable list.
    async listByFaculty(faculty: string) {
      const { data, error } = await supabase
        .from('elonlar')
        .select(AUTHORED_COLUMNS)
        .eq('audience', 'faculty')
        .ilike('faculty', faculty)
        .neq('title', 'HAFTALIK_NAVBATCHILIK_JADVALI')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
    // Superadmin — every tizim-wide announcement, regardless of the
    // placeholder faculty stored on the row.
    async listByAudience(audience: string) {
      const { data, error } = await supabase
        .from('elonlar')
        .select(AUTHORED_COLUMNS)
        .eq('audience', audience)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },

    async updateSystemById(id: string, updates: Partial<AnnouncementRow>) {
      const { data, error } = await supabase
        .from('elonlar')
        .update(updates)
        .eq('id', id)
        .eq('audience', 'system')
        .select(AUTHORED_COLUMNS)
        .maybeSingle()
      if (error) throw error
      return data
    },

    async deleteSystemById(id: string) {
      const { data, error } = await supabase
        .from('elonlar')
        .delete()
        .eq('id', id)
        .eq('audience', 'system')
        .select('id')
        .maybeSingle()
      if (error) throw error
      return data
    },

    async insertAuthored(row: {
      title: string
      text: string
      type: string
      audience: string
      faculty: string | null
      is_published: boolean
      created_by: string
      published_at: string | null
    }) {
      const { data, error } = await supabase.from('elonlar').insert(row).select(AUTHORED_COLUMNS).single()
      if (error) throw error
      return data
    },
    async updateByFaculty(id: string, faculty: string, updates: Partial<AnnouncementRow>) {
      const { data, error } = await supabase
        .from('elonlar')
        .update(updates)
        .eq('id', id)
        .eq('audience', 'faculty')
        .ilike('faculty', faculty)
        .select(AUTHORED_COLUMNS)
        .maybeSingle()
      if (error) throw error
      return data
    },
    async deleteByFaculty(id: string, faculty: string) {
      const { data, error } = await supabase
        .from('elonlar')
        .delete()
        .eq('id', id)
        .eq('audience', 'faculty')
        .ilike('faculty', faculty)
        .select('id')
        .maybeSingle()
      if (error) throw error
      return data
    },
    async listStudentCreators(ids: string[]) {
      if (!ids.length) return []
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, is_floor_captain, assigned_floor')
        .in('id', ids)
      if (error) throw error
      return data ?? []
    },
    async listStaffCreators(ids: string[]) {
      if (!ids.length) return []
      const { data, error } = await supabase.from('staff').select('id, full_name').in('id', ids)
      if (error) throw error
      return data ?? []
    },
  }
}

export type AnnouncementRepository = ReturnType<typeof createAnnouncementRepository>
