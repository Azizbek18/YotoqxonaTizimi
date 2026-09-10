import 'server-only'
import { getServiceSupabase } from '@/lib/server-supabase'
import type { ForeignStudentDocumentRow } from '@/types/database.generated'

const DOC_COLUMNS =
  'id, student_id, doc_type, number, issued_on, expires_on, status, registration_basis, address, file_path, note, verified_at, verified_by, created_by_role, created_at, updated_at'

// Talaba/xodim tomonidan yoziladigan maydonlar (id, student_id, audit
// ustunlaridan tashqari).
export type DocWriteFields = Partial<
  Pick<
    ForeignStudentDocumentRow,
    | 'doc_type'
    | 'number'
    | 'issued_on'
    | 'expires_on'
    | 'status'
    | 'registration_basis'
    | 'address'
    | 'note'
    | 'file_path'
    | 'verified_at'
    | 'verified_by'
  >
>

export type StudentContextRow = {
  full_name: string | null
  faculty: string | null
  country: string | null
  course: number | null
  room_number: string | null
}

export type DashboardDocRow = ForeignStudentDocumentRow & { users: StudentContextRow | null }

export type ReminderDocRow = Pick<
  ForeignStudentDocumentRow,
  'id' | 'student_id' | 'doc_type' | 'number' | 'expires_on'
> & { users: { full_name: string | null; faculty: string | null } | null }

export function createForeignDocsRepository() {
  const supabase = getServiceSupabase()

  return {
    async listForStudent(studentId: string): Promise<ForeignStudentDocumentRow[]> {
      const { data, error } = await supabase
        .from('foreign_student_documents')
        .select(DOC_COLUMNS)
        .eq('student_id', studentId)
        .order('doc_type', { ascending: true })
        .order('expires_on', { ascending: false })
      if (error) throw error
      return (data ?? []) as ForeignStudentDocumentRow[]
    },

    async getById(id: string): Promise<ForeignStudentDocumentRow | null> {
      const { data, error } = await supabase
        .from('foreign_student_documents')
        .select(DOC_COLUMNS)
        .eq('id', id)
        .maybeSingle()
      if (error) throw error
      return (data ?? null) as ForeignStudentDocumentRow | null
    },

    async insert(
      studentId: string,
      fields: DocWriteFields,
      createdByRole: 'talaba' | 'dekan' | 'admin',
    ): Promise<ForeignStudentDocumentRow> {
      const { data, error } = await supabase
        .from('foreign_student_documents')
        .insert({ student_id: studentId, created_by_role: createdByRole, ...fields })
        .select(DOC_COLUMNS)
        .single()
      if (error) throw error
      return data as ForeignStudentDocumentRow
    },

    /** Talaba faqat o'zi yaratgan yozuvni tahrirlaydi. */
    async updateOwn(
      id: string,
      studentId: string,
      fields: DocWriteFields,
    ): Promise<ForeignStudentDocumentRow | null> {
      const { data, error } = await supabase
        .from('foreign_student_documents')
        .update({ ...fields, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('student_id', studentId)
        .eq('created_by_role', 'talaba')
        .select(DOC_COLUMNS)
        .maybeSingle()
      if (error) throw error
      return (data ?? null) as ForeignStudentDocumentRow | null
    },

    async deleteOwn(id: string, studentId: string): Promise<boolean> {
      const { data, error } = await supabase
        .from('foreign_student_documents')
        .delete()
        .eq('id', id)
        .eq('student_id', studentId)
        .eq('created_by_role', 'talaba')
        .select('id')
        .maybeSingle()
      if (error) throw error
      return Boolean(data)
    },

    /** Xodim istalgan yozuvni tahrirlaydi (fakultet tegishliligi service'da tekshiriladi). */
    async patchByStaff(id: string, fields: DocWriteFields): Promise<ForeignStudentDocumentRow | null> {
      const { data, error } = await supabase
        .from('foreign_student_documents')
        .update({ ...fields, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select(DOC_COLUMNS)
        .maybeSingle()
      if (error) throw error
      return (data ?? null) as ForeignStudentDocumentRow | null
    },

    async setFilePath(id: string, filePath: string | null): Promise<void> {
      const { error } = await supabase
        .from('foreign_student_documents')
        .update({ file_path: filePath, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },

    async findStudentContext(studentId: string): Promise<StudentContextRow | null> {
      const { data, error } = await supabase
        .from('users')
        .select('full_name, faculty, country, course, room_number')
        .eq('id', studentId)
        .eq('role', 'talaba')
        .maybeSingle()
      if (error) throw error
      return (data ?? null) as StudentContextRow | null
    },

    /** Dekan dashboardi — bir fakultetning barcha hujjatlari + talaba konteksti. */
    async listForFaculty(faculty: string): Promise<DashboardDocRow[]> {
      const { data, error } = await supabase
        .from('foreign_student_documents')
        .select(`${DOC_COLUMNS}, users!inner(full_name, faculty, country, course, room_number)`)
        .ilike('users.faculty', faculty)
        .order('expires_on', { ascending: true })
      if (error) throw error
      return (data ?? []) as unknown as DashboardDocRow[]
    },

    // ── Eslatma cron ──────────────────────────────────────────────────────
    async listActiveForReminders(): Promise<ReminderDocRow[]> {
      const { data, error } = await supabase
        .from('foreign_student_documents')
        .select('id, student_id, doc_type, number, expires_on, users!inner(full_name, faculty, status, role)')
        .eq('status', 'active')
        .eq('users.role', 'talaba')
        .eq('users.status', 'active')
      if (error) throw error
      return (data ?? []) as unknown as ReminderDocRow[]
    },

    async listRemindersFor(documentIds: string[]): Promise<{ document_id: string; milestone: number }[]> {
      if (documentIds.length === 0) return []
      const { data, error } = await supabase
        .from('foreign_document_reminders')
        .select('document_id, milestone')
        .in('document_id', documentIds)
      if (error) throw error
      return data ?? []
    },

    async insertReminders(rows: { document_id: string; milestone: number }[]): Promise<void> {
      if (rows.length === 0) return
      const { error } = await supabase
        .from('foreign_document_reminders')
        .upsert(rows, { onConflict: 'document_id,milestone', ignoreDuplicates: true })
      if (error) throw error
    },
  }
}

export type ForeignDocsRepository = ReturnType<typeof createForeignDocsRepository>
