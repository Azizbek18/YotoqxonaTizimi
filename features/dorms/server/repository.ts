import 'server-only'
import { getServiceSupabase } from '@/lib/server-supabase'

export type DormRow = { id: string; number: string; name: string; floor_count: number }
export type DormDetailRow = DormRow & {
  latitude: number | null
  longitude: number | null
  checkin_radius_m: number
  attendance_enabled: boolean
  attendance_open_time: string
  attendance_close_time: string
}
export type DormFloorRow = {
  floor_number: number
  faculty: string | null
  pending_faculty: string | null
  pending_at: string | null
}

export type DormSectionRow = {
  block: string
  floor_number: number
  faculty: string
  gender: 'male' | 'female' | null
}

export function createDormRepository() {
  const supabase = getServiceSupabase()

  return {
    // The faculty's primary dorm — the one every "which dorm?" lookup that
    // can't name a building resolves to. A faculty always has exactly one.
    async facultyDormId(faculty: string): Promise<string | null> {
      const { data, error } = await supabase
        .from('faculty_dorm')
        .select('dorm_id')
        .eq('faculty', faculty)
        .eq('is_primary', true)
        .maybeSingle()
      if (error) throw error
      return data?.dorm_id ?? null
    },

    // Every dorm this faculty is housed in, primary first. Callers that let
    // the dekan pick a building validate the pick against this list.
    async facultyDormIds(faculty: string): Promise<string[]> {
      const { data, error } = await supabase
        .from('faculty_dorm')
        .select('dorm_id, is_primary')
        .eq('faculty', faculty)
        .order('is_primary', { ascending: false })
      if (error) throw error
      return (data ?? []).map((r) => r.dorm_id as string)
    },

    async getDorm(dormId: string): Promise<DormDetailRow | null> {
      const { data, error } = await supabase
        .from('dorms')
        .select('id, number, name, floor_count, latitude, longitude, checkin_radius_m, attendance_enabled, attendance_open_time, attendance_close_time')
        .eq('id', dormId)
        .maybeSingle()
      if (error) throw error
      return (data as DormDetailRow) ?? null
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

    // ---- blocked-layout dorms (6-yotoqxona) — 202609300010 / 202609300011 ----

    async getDormLayout(
      dormId: string,
    ): Promise<{ layoutKind: 'simple' | 'blocked'; blockCount: number; floorCount: number } | null> {
      const { data, error } = await supabase
        .from('dorms')
        .select('layout_kind, block_count, floor_count')
        .eq('id', dormId)
        .maybeSingle()
      if (error) throw error
      if (!data) return null
      return {
        layoutKind: (data.layout_kind as 'simple' | 'blocked') ?? 'simple',
        blockCount: data.block_count ?? 1,
        floorCount: data.floor_count ?? 0,
      }
    },

    async listSections(dormId: string): Promise<DormSectionRow[]> {
      const { data, error } = await supabase
        .from('dorm_section')
        .select('block, floor_number, faculty, gender')
        .eq('dorm_id', dormId)
      if (error) throw error
      return (data as DormSectionRow[]) ?? []
    },

    // Residents per section, keyed `${block}-${floor}` — for the superadmin grid.
    async sectionResidentCounts(dormId: string): Promise<Map<string, number>> {
      const { data, error } = await supabase
        .from('users')
        .select('block, assigned_floor')
        .eq('role', 'talaba')
        .eq('dorm_id', dormId)
        .not('block', 'is', null)
        .not('room_number', 'is', null)
      if (error) throw error
      const counts = new Map<string, number>()
      for (const row of data ?? []) {
        if (!row.block || row.assigned_floor == null) continue
        const key = `${row.block}-${row.assigned_floor}`
        counts.set(key, (counts.get(key) ?? 0) + 1)
      }
      return counts
    },

    async buildBlockedLayout(dormId: string) {
      const { data, error } = await supabase.rpc('dorm_build_blocked_layout', { p_dorm_id: dormId })
      if (error) throw error
      return (data ?? { created: 0, blocks: 0, floors: 0, rooms_per_section: 9 }) as {
        created: number; blocks: number; floors: number; rooms_per_section: number
      }
    },

    async assignSection(dormId: string, block: string, floor: number, faculty: string, staffId: string) {
      const { data, error } = await supabase.rpc('dorm_assign_section', {
        p_dorm_id: dormId,
        p_block: block,
        p_floor: floor,
        p_faculty: faculty,
        p_staff_id: staffId,
      })
      if (error) throw error
      return data as { block: string; floor: number; faculty: string }
    },

    async clearSection(dormId: string, block: string, floor: number) {
      const { data, error } = await supabase.rpc('dorm_clear_section', {
        p_dorm_id: dormId,
        p_block: block,
        p_floor: floor,
      })
      if (error) throw error
      return data as { block: string; floor: number; cleared: boolean }
    },

    // Bind a faculty to a dorm. Primary linking is delegated entirely to the
    // RPC so inserting the link and switching the unique `is_primary` flag
    // happen in one database transaction. Writing `is_primary: true` here
    // first would collide with faculty_dorm_one_primary before the RPC could
    // demote the old primary.
    async linkFaculty(
      faculty: string,
      dormId: string,
      opts: { primary?: boolean } = {},
    ): Promise<void> {
      const primary = opts.primary ?? true
      if (primary) {
        const { error: rpcError } = await supabase.rpc('set_primary_dorm', {
          p_faculty: faculty,
          p_dorm_id: dormId,
        })
        if (rpcError) throw rpcError
        return
      }

      const { error } = await supabase
        .from('faculty_dorm')
        .upsert(
          { faculty, dorm_id: dormId, is_primary: false },
          // A repeated "additional" request for the current primary must be
          // a no-op. Updating the conflict to false would leave the faculty
          // with no primary at all; DO NOTHING also makes this safe against
          // a concurrent primary switch for the same building.
          { onConflict: 'faculty,dorm_id', ignoreDuplicates: true },
        )
      if (error) throw error
    },

    // Drop a faculty↔dorm link entirely (used when a resident-free faculty
    // moves buildings). Never leaves a faculty with zero links — the caller
    // links the new dorm first.
    async unlinkFaculty(faculty: string, dormId: string): Promise<void> {
      const { error } = await supabase
        .from('faculty_dorm')
        .delete()
        .eq('faculty', faculty)
        .eq('dorm_id', dormId)
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

    // Residents this faculty has placed — across every building it holds by
    // default, or scoped to one `dormId` (used to check a single building is
    // clear before unlinking it, as opposed to "is it safe to move at all").
    async facultyResidentCount(faculty: string, dormId?: string): Promise<number> {
      let query = supabase
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'talaba')
        .eq('faculty', faculty)
        .not('room_number', 'is', null)
      if (dormId) query = query.eq('dorm_id', dormId)
      const { count, error } = await query
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
      const { data, error } = await supabase.from('faculty_dorm').select('faculty, dorm_id, is_primary')
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

    async createDormShell(input: {
      number: string
      name: string
      floorCount: number
      roomCapacity: number
      layoutKind?: 'simple' | 'blocked'
      blockCount?: number
    }) {
      const { data, error } = await supabase
        .from('dorms')
        .insert({
          number: input.number,
          name: input.name,
          floor_count: input.floorCount,
          default_room_capacity: input.roomCapacity,
          layout_kind: input.layoutKind ?? 'simple',
          block_count: input.layoutKind === 'blocked' ? (input.blockCount ?? 2) : 1,
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
