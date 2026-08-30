import 'server-only'
import { getServiceSupabase } from '@/lib/server-supabase'

export function createSuperadminDekanRepository() {
  const supabase = getServiceSupabase()

  return {
    async loadAll() {
      const [dekansResult, educatorsResult, studentsResult, permitsResult, facultyDormResult, dormsResult, roomsResult] = await Promise.all([
        supabase
          .from('staff')
          .select('id, full_name, email, phone_number, faculty, status, created_at')
          .eq('role', 'dekan')
          .order('created_at', { ascending: false }),
        supabase
          .from('staff')
          .select('faculty, status')
          .eq('role', 'tarbiyachi'),
        // TODO(scale): unbounded — PostgREST caps at db-max-rows (1000).
        // Fine for the current dataset; move to count queries / an
        // aggregation RPC before the building exceeds ~1000 residents.
        supabase
          .from('users')
          .select('faculty, status, room_number')
          .eq('role', 'talaba'),
        supabase
          .from('permit_requests')
          .select('faculty, status, room_number'),
        supabase
          .from('faculty_dorm')
          .select('faculty, dorm_id'),
        supabase
          .from('dorms')
          .select('id, number, name, default_room_capacity'),
        supabase
          .from('floor_room_layout')
          .select('faculty, room_number, frozen, capacity'),
      ])

      const failed = [dekansResult, educatorsResult, studentsResult, permitsResult, facultyDormResult, dormsResult, roomsResult]
        .find((result) => result.error)
      if (failed?.error) throw failed.error

      return {
        dekans: dekansResult.data ?? [],
        educators: educatorsResult.data ?? [],
        students: studentsResult.data ?? [],
        permits: permitsResult.data ?? [],
        facultyDorms: facultyDormResult.data ?? [],
        dorms: dormsResult.data ?? [],
        rooms: roomsResult.data ?? [],
      }
    },
  }
}

export type SuperadminDekanRepository = ReturnType<typeof createSuperadminDekanRepository>
