import 'server-only'
import { getServiceSupabase } from '@/lib/server-supabase'
import type { ApplicationRow, ArizaSignatureRow } from '@/types/database.generated'

export function createApplicationRepository() {
  const supabase = getServiceSupabase()
  return {
    async getStudentDetails(studentId: string) {
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, email, faculty, direction, course')
        .eq('id', studentId)
        .eq('role', 'talaba')
        .maybeSingle()
      if (error) throw error
      return data
    },

    async getOwnedDraft(studentId: string, id: string) {
      const { data, error } = await supabase
        .from('arizalar')
        .select('*')
        .eq('id', id)
        .eq('student_id', studentId)
        .eq('status', 'draft')
        .maybeSingle()
      if (error) throw error
      return data
    },

    async getOwned(studentId: string, id: string) {
      const { data, error } = await supabase
        .from('arizalar')
        .select('*')
        .eq('id', id)
        .eq('student_id', studentId)
        .maybeSingle()
      if (error) throw error
      return data
    },

    // ---- ariza_signatures (append-only) ----
    async insertSignature(row: Omit<ArizaSignatureRow, 'id' | 'created_at'>) {
      const { data, error } = await supabase
        .from('ariza_signatures')
        .insert(row)
        .select('*')
        .single()
      if (error) throw error
      return data as ArizaSignatureRow
    },

    async deleteSignatureByAriza(arizaId: string) {
      const { error } = await supabase.from('ariza_signatures').delete().eq('ariza_id', arizaId)
      if (error) throw error
    },

    async signatureByAriza(arizaId: string) {
      const { data, error } = await supabase
        .from('ariza_signatures').select('*').eq('ariza_id', arizaId).maybeSingle()
      if (error) throw error
      return (data as ArizaSignatureRow) ?? null
    },

    async signatureByCode(verifyCode: string) {
      const { data, error } = await supabase
        .from('ariza_signatures').select('*').eq('verify_code', verifyCode).maybeSingle()
      if (error) throw error
      return (data as ArizaSignatureRow) ?? null
    },

    async arizaById(id: string) {
      const { data, error } = await supabase
        .from('arizalar').select('id, title, type, student_name, status').eq('id', id).maybeSingle()
      if (error) throw error
      return data
    },

    async list(studentId: string, kind: 'documents' | 'warnings' | 'chat' | 'notifications', limit: number) {
      let query = supabase.from('arizalar').select('*').eq('student_id', studentId)
      if (kind === 'chat') query = query.eq('type', 'chat')
      // 'documents' is the student's own paperwork ("Murojaatlarim"), so a
      // staff-issued 'ogohlantirish' must stay out of it — but it does
      // belong in the notification bell alongside it.
      if (kind === 'documents') query = query.in('type', ['ariza', 'tushuntirish'])
      if (kind === 'notifications') query = query.in('type', ['ariza', 'tushuntirish', 'ogohlantirish'])
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

    // Only a still-draft application can be submitted — once staff/admin has
    // decided it (approved/rejected) or the student already submitted it,
    // this must not silently reset it back to 'pending'.
    async submitOwnedDraft(studentId: string, id: string) {
      const { data, error } = await supabase
        .from('arizalar')
        .update({ status: 'pending' })
        .eq('id', id)
        .eq('student_id', studentId)
        .eq('status', 'draft')
        .select()
        .maybeSingle()
      if (error) throw error
      return data
    },

    // Only a still-draft application can be deleted by the student. Once it
    // is signed + submitted it is a record they attested to — they can't
    // make it disappear.
    async deleteOwned(studentId: string, id: string) {
      const { data, error } = await supabase
        .from('arizalar')
        .delete()
        .eq('id', id)
        .eq('student_id', studentId)
        .eq('status', 'draft')
        .select('id')
        .maybeSingle()
      if (error) throw error
      return data
    },
  }
}

export type ApplicationRepository = ReturnType<typeof createApplicationRepository>
