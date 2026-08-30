import 'server-only'
import { getServiceSupabase } from '@/lib/server-supabase'
import type { SuperadminStudentsQuery } from '../types'

const LIST_COLUMNS =
  'id, full_name, email, phone_number, faculty, direction, course, status, room_number, assigned_floor, blacklisted, created_at'

export function createSuperadminStudentsRepository() {
  const supabase = getServiceSupabase()

  return {
    async list(q: SuperadminStudentsQuery) {
      let query = supabase
        .from('users')
        .select(LIST_COLUMNS, { count: 'exact' })
        .eq('role', 'talaba')

      if (q.faculty) query = query.ilike('faculty', q.faculty)
      if (q.status) query = query.eq('status', q.status)
      if (typeof q.blacklisted === 'boolean') query = query.eq('blacklisted', q.blacklisted)
      if (q.placement === 'placed') query = query.not('room_number', 'is', null)
      if (q.placement === 'roomless') query = query.is('room_number', null)
      if (q.search) {
        const s = q.search.replace(/[%,()]/g, ' ').trim()
        if (s) query = query.or(`full_name.ilike.%${s}%,email.ilike.%${s}%,phone_number.ilike.%${s}%`)
      }

      const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .range(q.offset, q.offset + q.limit - 1)
      if (error) throw error
      return { rows: data ?? [], total: count ?? 0 }
    },

    // Faculty breakdown over every student — one lightweight column scan.
    // TODO(scale): move to a grouped count RPC past ~a few thousand rows.
    async facultyTallies(): Promise<Map<string, number>> {
      const { data, error } = await supabase.from('users').select('faculty').eq('role', 'talaba')
      if (error) throw error
      const map = new Map<string, number>()
      for (const row of data ?? []) {
        const key = String(row.faculty ?? '').trim().toLowerCase()
        map.set(key, (map.get(key) ?? 0) + 1)
      }
      return map
    },

    async findStudent(id: string) {
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, email, faculty, role, status, blacklisted, room_number')
        .eq('id', id)
        .maybeSingle()
      if (error) throw error
      return data
    },

    async updateStudent(id: string, patch: Record<string, unknown>) {
      const { data, error } = await supabase
        .from('users')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('role', 'talaba')
        .select('id, faculty, status, blacklisted, room_number')
        .maybeSingle()
      if (error) throw error
      return data
    },
  }
}

export type SuperadminStudentsRepository = ReturnType<typeof createSuperadminStudentsRepository>
