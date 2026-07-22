import 'server-only'
import { getServiceSupabase } from '@/lib/server-supabase'

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
