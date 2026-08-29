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

    // ---- superadmin ----
    async listAllDorms() {
      const { data, error } = await supabase
        .from('dorms')
        .select('*')
        .order('number', { ascending: true })
      if (error) throw error
      return data ?? []
    },

    async listAllFloors() {
      const { data, error } = await supabase
        .from('dorm_floor')
        .select('dorm_id, floor_number, faculty, pending_faculty')
      if (error) throw error
      return data ?? []
    },

    async listFacultyDorm() {
      const { data, error } = await supabase.from('faculty_dorm').select('faculty, dorm_id')
      if (error) throw error
      return data ?? []
    },

    async residentCountByDorm() {
      const { data, error } = await supabase
        .from('users')
        .select('dorm_id')
        .eq('role', 'talaba')
        .not('room_number', 'is', null)
      if (error) throw error
      const counts = new Map<string, number>()
      for (const row of data ?? []) {
        if (row.dorm_id) counts.set(row.dorm_id, (counts.get(row.dorm_id) ?? 0) + 1)
      }
      return counts
    },

    async createDormShell(input: { number: string; name: string; floorCount: number; roomCapacity: number }) {
      const { data, error } = await supabase
        .from('dorms')
        .insert({
          number: input.number,
          name: input.name,
          floor_count: input.floorCount,
          default_room_capacity: input.roomCapacity,
        })
        .select('id')
        .single()
      if (error) throw error
      return data.id as string
    },

    async patchDorm(dormId: string, patch: Record<string, unknown>) {
      const { error } = await supabase
        .from('dorms')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', dormId)
      if (error) throw error
    },

    // Superadmin arbitration: force a floor to a faculty, clearing any
    // pending claim. Blocked if the losing faculty still has residents there.
    async forceFloor(dormId: string, floor: number, faculty: string | null) {
      if (faculty === null) {
        const { error } = await supabase
          .from('dorm_floor')
          .delete()
          .eq('dorm_id', dormId)
          .eq('floor_number', floor)
        if (error) throw error
        return
      }
      const { count } = await supabase
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'talaba')
        .eq('dorm_id', dormId)
        .eq('assigned_floor', floor)
        .neq('faculty', faculty)
      if ((count ?? 0) > 0) {
        return { blocked: count ?? 0 }
      }
      const { error } = await supabase
        .from('dorm_floor')
        .upsert(
          {
            dorm_id: dormId,
            floor_number: floor,
            faculty,
            pending_faculty: null,
            pending_by: null,
            pending_at: null,
            confirmed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'dorm_id,floor_number' },
        )
      if (error) throw error
      return { blocked: 0 }
    },
  }
}

export type DormRepository = ReturnType<typeof createDormRepository>
