import 'server-only'
import { getServiceSupabase } from '@/lib/server-supabase'
import type { CertificateRequestRow } from '@/types/database.generated'

const COLUMNS =
  'id, student_id, purpose, purpose_note, status, number, decided_by, decided_by_name, decided_at, decision_note, created_at'

export type StudentCertContext = {
  id: string
  full_name: string | null
  faculty: string | null
  direction: string | null
  course: number | null
  group: string | null
  is_off_campus: boolean | null
  status: string | null
}

export type CertificateWithStudent = CertificateRequestRow & { users: StudentCertContext | null }

export function createCertificatesRepository() {
  const supabase = getServiceSupabase()
  return {
    async listForStudent(studentId: string): Promise<CertificateRequestRow[]> {
      const { data, error } = await supabase
        .from('student_certificate_requests')
        .select(COLUMNS)
        .eq('student_id', studentId)
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) throw error
      return (data ?? []) as unknown as CertificateRequestRow[]
    },

    async countPending(studentId: string): Promise<number> {
      const { count, error } = await supabase
        .from('student_certificate_requests')
        .select('id', { count: 'exact', head: true })
        .eq('student_id', studentId)
        .eq('status', 'pending')
      if (error) throw error
      return count ?? 0
    },

    async insert(studentId: string, fields: { purpose: CertificateRequestRow['purpose']; purpose_note: string | null }): Promise<CertificateRequestRow> {
      const { data, error } = await supabase
        .from('student_certificate_requests')
        .insert({ student_id: studentId, ...fields })
        .select(COLUMNS)
        .single()
      if (error) throw error
      return data as unknown as CertificateRequestRow
    },

    async findStudent(studentId: string): Promise<StudentCertContext | null> {
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, faculty, direction, course, group, is_off_campus, status')
        .eq('id', studentId)
        .eq('role', 'talaba')
        .maybeSingle()
      if (error) throw error
      return (data ?? null) as StudentCertContext | null
    },

    async getById(id: string): Promise<CertificateWithStudent | null> {
      const { data, error } = await supabase
        .from('student_certificate_requests')
        .select(`${COLUMNS}, users!inner(id, full_name, faculty, direction, course, group, is_off_campus, status)`)
        .eq('id', id)
        .maybeSingle()
      if (error) throw error
      return (data ?? null) as unknown as CertificateWithStudent | null
    },

    async listForFaculty(faculty: string): Promise<CertificateWithStudent[]> {
      const { data, error } = await supabase
        .from('student_certificate_requests')
        .select(`${COLUMNS}, users!inner(id, full_name, faculty, direction, course, group, is_off_campus, status)`)
        .ilike('users.faculty', faculty)
        .order('created_at', { ascending: false })
        .limit(300)
      if (error) throw error
      return (data ?? []) as unknown as CertificateWithStudent[]
    },

    /** Faqat hali `pending` bo'lsa yangilaydi — ikki dekan bir vaqtda hal qilmasin. */
    async decide(
      id: string,
      fields: {
        status: 'approved' | 'rejected'
        number: string | null
        decided_by: string
        decided_by_name: string
        decided_at: string
        decision_note: string | null
      },
    ): Promise<CertificateRequestRow | null> {
      const { data, error } = await supabase
        .from('student_certificate_requests')
        .update(fields)
        .eq('id', id)
        .eq('status', 'pending')
        .select(COLUMNS)
        .maybeSingle()
      if (error) throw error
      return (data ?? null) as unknown as CertificateRequestRow | null
    },
  }
}

export type CertificatesRepository = ReturnType<typeof createCertificatesRepository>
