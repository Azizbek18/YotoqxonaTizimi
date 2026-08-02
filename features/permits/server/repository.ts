import 'server-only'
import { getServiceSupabase } from '@/lib/server-supabase'

export function createPermitAdminRepository() {
  const supabase = getServiceSupabase()
  return {
    async load() {
      const [permitsResult, usersResult] = await Promise.all([
        supabase.from('permit_requests').select('*').order('created_at', { ascending: false }),
        supabase.from('users').select('id, full_name, passport_series, jshshir, phone_number, gender, faculty, direction, course, room_number, warning_count, blacklisted, role, status'),
      ])
      if (permitsResult.error) throw permitsResult.error
      if (usersResult.error) throw usersResult.error
      return { permits: permitsResult.data ?? [], users: usersResult.data ?? [] }
    },
    async find(id: string) {
      const { data, error } = await supabase.from('permit_requests').select('*').eq('id', id).maybeSingle()
      if (error) throw error
      return data
    },
    async update(id: string, updates: { status: string; room_number: string | null; reject_reason: string | null }) {
      const { data, error } = await supabase
        .from('permit_requests')
        .update(updates)
        .eq('id', id)
        .eq('status', 'pending')
        .select()
        .maybeSingle()
      if (error) throw error
      return data
    },
  }
}

export type PermitAdminRepository = ReturnType<typeof createPermitAdminRepository>
