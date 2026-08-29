import 'server-only'
import { getServiceSupabase } from '@/lib/server-supabase'

export type DormRow = { id: string; number: string; name: string; floor_count: number }
export type DormFloorRow = {
  floor_number: number
  faculty: string | null
  pending_faculty: string | null
  pending_at: string | null
}

export function createDormRepository() {
  const supabase = getServiceSupabase()

  return {
    async facultyDormId(faculty: string): Promise<string | null> {
      const { data, error } = await supabase
        .from('faculty_dorm')
        .select('dorm_id')
        .eq('faculty', faculty)
        .maybeSingle()
      if (error) throw error
      return data?.dorm_id ?? null
    },

    async getDorm(dormId: string): Promise<DormRow | null> {
      const { data, error } = await supabase
        .from('dorms')
        .select('id, number, name, floor_count')
        .eq('id', dormId)
        .maybeSingle()
      if (error) throw error
      return (data as DormRow) ?? null
    },

    // Number uniqueness is on lower(trim(number)); dorm numbers are digits
    // in practice, so an exact match on the trimmed value is enough.
    async findDormByNumber(number: string): Promise<DormRow | null> {
      const { data, error } = await supabase
        .from('dorms')
        .select('id, number, name, floor_count')
        .eq('number', number)
        .maybeSingle()
      if (error) throw error
      return (data as DormRow) ?? null
    },

    async createDorm(input: { number: string; floorCount: number; roomCapacity: number }): Promise<DormRow> {
      const { data, error } = await supabase
        .from('dorms')
        .insert({
          number: input.number,
          floor_count: input.floorCount,
          default_room_capacity: input.roomCapacity,
        })
        .select('id, number, name, floor_count')
        .single()
      if (error) throw error
      return data as DormRow
    },

    async linkFaculty(faculty: string, dormId: string): Promise<void> {
      const { error } = await supabase
        .from('faculty_dorm')
        .upsert({ faculty, dorm_id: dormId }, { onConflict: 'faculty' })
      if (error) throw error
    },

    async setStaffDorm(staffId: string, dormId: string): Promise<void> {
      const { error } = await supabase.from('staff').update({ dorm_id: dormId }).eq('id', staffId)
      if (error) throw error
    },

    async listFloors(dormId: string): Promise<DormFloorRow[]> {
      const { data, error } = await supabase
        .from('dorm_floor')
        .select('floor_number, faculty, pending_faculty, pending_at')
        .eq('dorm_id', dormId)
      if (error) throw error
      return (data as DormFloorRow[]) ?? []
    },

    async facultyResidentCount(faculty: string): Promise<number> {
      const { count, error } = await supabase
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'talaba')
        .eq('faculty', faculty)
        .not('room_number', 'is', null)
      if (error) throw error
      return count ?? 0
    },

    async claimFloors(dormId: string, faculty: string, floors: number[], staffId: string) {
      const { data, error } = await supabase.rpc('dorm_claim_floors', {
        p_dorm_id: dormId,
        p_faculty: faculty,
        p_floors: floors,
        p_staff_id: staffId,
      })
      if (error) throw error
      return (data ?? { confirmed: [], proposed: [] }) as { confirmed: number[]; proposed: number[] }
    },

    async resolveFloor(dormId: string, floor: number, staffId: string, accept: boolean) {
      const { data, error } = await supabase.rpc('dorm_resolve_floor', {
        p_dorm_id: dormId,
        p_floor: floor,
        p_staff_id: staffId,
        p_accept: accept,
      })
      if (error) throw error
      return data as { floor: number; outcome: string; faculty?: string }
    },

    async withdrawFloors(dormId: string, faculty: string, floors: number[]): Promise<void> {
      const { error } = await supabase.rpc('dorm_withdraw_floors', {
        p_dorm_id: dormId,
        p_faculty: faculty,
        p_floors: floors,
      })
      if (error) throw error
    },
  }
}

export type DormRepository = ReturnType<typeof createDormRepository>
