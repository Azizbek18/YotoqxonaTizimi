import 'server-only'
import { getServiceSupabase } from '@/lib/server-supabase'

export function createSuperadminDekanRepository() {
  const supabase = getServiceSupabase()

  return {
    async loadAll() {
      const [dekansResult, educatorsResult, studentsResult, permitsResult, facultyDormResult, dormsResult] = await Promise.all([
        supabase
          .from('staff')
          .select('id, full_name, email, phone_number, faculty, status, created_at')
          .eq('role', 'dekan')
          .order('created_at', { ascending: false }),
        supabase
          .from('staff')
          .select('faculty, status')
          .eq('role', 'tarbiyachi'),
        supabase
          .from('users')
          .select('faculty, status, room_number')
          .eq('role', 'talaba'),
        supabase
          .from('permit_requests')
          .select('faculty, status'),
        supabase
          .from('faculty_dorm')
          .select('faculty, dorm_id'),
        supabase
          .from('dorms')
          .select('id, number, name'),
      ])

      const failed = [dekansResult, educatorsResult, studentsResult, permitsResult, facultyDormResult, dormsResult]
        .find((result) => result.error)
      if (failed?.error) throw failed.error

      return {
        dekans: dekansResult.data ?? [],
        educators: educatorsResult.data ?? [],
        students: studentsResult.data ?? [],
        permits: permitsResult.data ?? [],
        facultyDorms: facultyDormResult.data ?? [],
        dorms: dormsResult.data ?? [],
      }
    },
  }
}

export type SuperadminDekanRepository = ReturnType<typeof createSuperadminDekanRepository>
