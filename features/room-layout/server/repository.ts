import 'server-only'
import { getServiceSupabase } from '@/lib/server-supabase'
import { PRIMARY_FACULTY } from '@/lib/faculties'
import type { RoomLayoutBlock } from '../types'

// Since P3 (202609160000) rooms belong to a DORM. A faculty resolves to
// its dorm through faculty_dorm, and — in a shared building — to just the
// floors it has confirmed in dorm_floor. `floors === null` means "no floor
// restriction" (the faculty is alone in the dorm, the common case).
export type RoomScope = { dormId: string | null; floors: number[] | null }

export function createRoomLayoutRepository() {
  const supabase = getServiceSupabase()

  async function scopeFor(faculty: string): Promise<RoomScope> {
    const { data: link } = await supabase
      .from('faculty_dorm')
      .select('dorm_id')
      .eq('faculty', faculty)
      .maybeSingle()

    let dormId = link?.dorm_id ?? null
    if (!dormId && faculty !== PRIMARY_FACULTY) {
      const { data: fb } = await supabase
        .from('faculty_dorm')
        .select('dorm_id')
        .eq('faculty', PRIMARY_FACULTY)
        .maybeSingle()
      dormId = fb?.dorm_id ?? null
    }
    if (!dormId) return { dormId: null, floors: null }

    const { data: floorRows } = await supabase
      .from('dorm_floor')
      .select('floor_number, faculty')
      .eq('dorm_id', dormId)
    const owners = new Set((floorRows ?? []).map((r) => r.faculty).filter(Boolean))
    // Sole faculty (or an unpartitioned building) — see every floor.
    if (owners.size <= 1) return { dormId, floors: null }
    return {
      dormId,
      floors: (floorRows ?? []).filter((r) => r.faculty === faculty).map((r) => r.floor_number),
    }
  }

  return {
    scopeFor,

    async listAllRooms(faculty: string) {
      const scope = await scopeFor(faculty)
      let query = supabase
        .from('floor_room_layout')
        .select('room_number, floor_number, side, position, size, frozen, frozen_reason, capacity, gender')
        .order('floor_number', { ascending: true })
        .order('room_number', { ascending: true })
      if (scope.dormId) query = query.eq('dorm_id', scope.dormId)
      if (scope.floors) query = query.in('floor_number', scope.floors.length ? scope.floors : [-1])
      const { data, error } = await query
      if (error) throw error
      return data ?? []
    },

    async insertRooms(
      faculty: string,
      rows: { floor_number: number; room_number: string; side: string; position: number; size: string; capacity?: number | null }[],
    ) {
      if (rows.length === 0) return
      const scope = await scopeFor(faculty)
      if (!scope.dormId) throw new Error(`Fakultetга yotoqxona biriktirilmagan: ${faculty}`)
      const allowed = scope.floors ? new Set(scope.floors) : null
      const withDorm = rows
        .filter((row) => !allowed || allowed.has(row.floor_number))
        .map((row) => ({ ...row, faculty, dorm_id: scope.dormId }))
      if (withDorm.length === 0) return
      const { error } = await supabase.from('floor_room_layout').insert(withDorm)
      if (error) throw error
    },

    // Room numbers in this dorm that currently hold a resident or an approved
    // permit — the "sync floors" trim must never delete one of these (the RPC
    // guards it too, but we want the preview/summary to be accurate first).
    async occupiedRoomNumbers(faculty: string): Promise<Set<string>> {
      const scope = await scopeFor(faculty)

      let usersQuery = supabase
        .from('users')
        .select('room_number')
        .eq('role', 'talaba')
        .not('room_number', 'is', null)
      if (scope.dormId) usersQuery = usersQuery.eq('dorm_id', scope.dormId)

      let permitsQuery = supabase
        .from('permit_requests')
        .select('room_number')
        .eq('status', 'approved')
        .not('room_number', 'is', null)
      if (scope.dormId) permitsQuery = permitsQuery.eq('dorm_id', scope.dormId)

      const [{ data: users }, { data: permits }] = await Promise.all([usersQuery, permitsQuery])
      const occupied = new Set<string>()
      for (const row of users ?? []) if (row.room_number) occupied.add(row.room_number)
      for (const row of permits ?? []) if (row.room_number) occupied.add(row.room_number)
      return occupied
    },

    async listFloor(faculty: string, floorNumber: number) {
      const scope = await scopeFor(faculty)
      let query = supabase
        .from('floor_room_layout')
        .select('room_number, side, position, size, capacity, frozen')
        .eq('floor_number', floorNumber)
        .order('side', { ascending: true })
        .order('position', { ascending: true })
      if (scope.dormId) query = query.eq('dorm_id', scope.dormId)
      const { data, error } = await query
      if (error) throw error
      return data ?? []
    },

    // Renumbers the whole building to match a "nechta xona per qavat" target
    // (migration 20260902080254). Occupied rooms are pinned at their current
    // number; only empty rooms move / are added / are removed. Raises P0003
    // (with a room list) if a resident's room can't keep its number.
    async applyBuildingLayout(
      faculty: string,
      numbering: 'sequential' | 'per-floor',
      plans: { floor: number; rooms: number }[],
    ): Promise<{ created: number; removed: number; renumbered: number }> {
      const { data, error } = await supabase.rpc('apply_building_layout', {
        p_faculty: faculty,
        p_numbering: numbering,
        p_floors: plans,
      })
      if (error) throw error
      return (data ?? { created: 0, removed: 0, renumbered: 0 }) as {
        created: number
        removed: number
        renumbered: number
      }
    },

    async replaceFloor(faculty: string, floorNumber: number, blocks: RoomLayoutBlock[]) {
      const rows = blocks.map((block) => ({
        roomNumber: block.roomNumber,
        side: block.side,
        position: block.position,
        size: block.size,
        // Always present so the RPC treats it as authoritative (an explicit
        // null clears a prior override).
        capacity: block.capacity ?? null,
      }))
      const { error } = await supabase.rpc('replace_floor_room_layout', {
        p_faculty: faculty,
        p_floor_number: floorNumber,
        p_rows: rows,
      })
      if (error) throw error
    },

    // Per-room capacity override (null = back to the dorm default). Scoped to
    // this dorm's rows — mirrors setFrozen. Returns whether a row was hit.
    async setCapacity(faculty: string, roomNumber: string, capacity: number | null) {
      const scope = await scopeFor(faculty)
      let query = supabase
        .from('floor_room_layout')
        .update({ capacity })
        .eq('room_number', roomNumber)
      if (scope.dormId) query = query.eq('dorm_id', scope.dormId)
      const { data, error } = await query.select('room_number').maybeSingle()
      if (error) throw error
      return Boolean(data)
    },

    async bulkSetCapacity(faculty: string, roomNumbers: string[], capacity: number | null) {
      if (roomNumbers.length === 0) return 0
      const scope = await scopeFor(faculty)
      let query = supabase
        .from('floor_room_layout')
        .update({ capacity })
        .in('room_number', roomNumbers)
      if (scope.dormId) query = query.eq('dorm_id', scope.dormId)
      const { data, error } = await query.select('room_number')
      if (error) throw error
      return data?.length ?? 0
    },

    // Declared room gender (null = undeclared). Scoped to this dorm's rows —
    // mirrors setCapacity / setFrozen. Enforced inside assign_*_room_atomic.
    async setGender(faculty: string, roomNumber: string, gender: 'male' | 'female' | null) {
      const scope = await scopeFor(faculty)
      let query = supabase
        .from('floor_room_layout')
        .update({ gender })
        .eq('room_number', roomNumber)
      if (scope.dormId) query = query.eq('dorm_id', scope.dormId)
      const { data, error } = await query.select('room_number').maybeSingle()
      if (error) throw error
      return Boolean(data)
    },

    async bulkSetGender(faculty: string, roomNumbers: string[], gender: 'male' | 'female' | null) {
      if (roomNumbers.length === 0) return 0
      const scope = await scopeFor(faculty)
      let query = supabase
        .from('floor_room_layout')
        .update({ gender })
        .in('room_number', roomNumbers)
      if (scope.dormId) query = query.eq('dorm_id', scope.dormId)
      const { data, error } = await query.select('room_number')
      if (error) throw error
      return data?.length ?? 0
    },

    async setFrozen(faculty: string, roomNumber: string, frozen: boolean, reason: string | null) {
      const scope = await scopeFor(faculty)
      let query = supabase
        .from('floor_room_layout')
        .update({ frozen, frozen_reason: reason })
        .eq('room_number', roomNumber)
      if (scope.dormId) query = query.eq('dorm_id', scope.dormId)
      const { data, error } = await query.select('room_number').maybeSingle()
      if (error) throw error
      return Boolean(data)
    },

    // Denormalised users.assigned_floor follows the physical floor. Scoped
    // strictly to this dorm's residents — room numbers are only unique per
    // dorm, so a NULL-/other-dorm resident in the same-numbered room must not
    // have their floor stomped by this dorm's layout save.
    async syncAssignedFloors(dormId: string | null, floorNumber: number, roomNumbers: string[]) {
      if (roomNumbers.length === 0) return
      let query = supabase
        .from('users')
        .update({ assigned_floor: floorNumber })
        .eq('role', 'talaba')
        .in('room_number', roomNumbers)
      if (dormId) query = query.eq('dorm_id', dormId)
      const { error } = await query
      if (error) throw error
    },
  }
}

export type RoomLayoutRepository = ReturnType<typeof createRoomLayoutRepository>
