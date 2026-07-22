import 'server-only'
import { getServiceSupabase } from '@/lib/server-supabase'
import type { ApplicationRow } from '@/types/database.generated'

export function createApplicationRepository() {
  const supabase = getServiceSupabase()
  return {
    async getStudentDetails(studentId: string) {
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, faculty, direction, course')
        .eq('id', studentId)
        .eq('role', 'talaba')
        .maybeSingle()
      if (error) throw error
      return data
    },

    async list(studentId: string, kind: 'documents' | 'warnings' | 'chat' | 'notifications', limit: number) {
      let query = supabase.from('arizalar').select('*').eq('student_id', studentId)
      if (kind === 'chat') query = query.eq('type', 'chat')
      if (kind === 'documents' || kind === 'notifications') {
        query = query.in('type', ['ariza', 'tushuntirish'])
      }
      if (kind === 'warnings') {
        query = query.neq('status', 'draft').neq('type', 'chat').in('level', ['warning', 'critical'])
      }
      const { data, error } = await query
        .order(kind === 'notifications' ? 'date' : 'created_at', { ascending: kind === 'chat' })
        .limit(limit)
      if (error) throw error
      return data ?? []
    },

    async create(row: Partial<ApplicationRow> & Pick<ApplicationRow, 'student_id' | 'text'>) {
      const { data, error } = await supabase.from('arizalar').insert(row).select().single()
      if (error) throw error
      return data
    },

    async updateOwned(studentId: string, id: string, updates: Partial<ApplicationRow>) {
      const { data, error } = await supabase
        .from('arizalar')
        .update(updates)
        .eq('id', id)
        .eq('student_id', studentId)
        .select()
        .maybeSingle()
      if (error) throw error
      return data
    },

    async deleteOwned(studentId: string, id: string) {
      const { data, error } = await supabase
        .from('arizalar')
        .delete()
        .eq('id', id)
        .eq('student_id', studentId)
        .select('id')
        .maybeSingle()
      if (error) throw error
      return data
    },
  }
}

export type ApplicationRepository = ReturnType<typeof createApplicationRepository>
