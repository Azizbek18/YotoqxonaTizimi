import 'server-only'
import { getServiceSupabase } from '@/lib/server-supabase'
import { PRIMARY_FACULTY } from '@/lib/faculties'
import { ApiError } from '@/server/http/api-error'
import type { RoomLayoutBlock } from '../types'

// Since P3 (202609160000) rooms belong to a DORM. A faculty resolves to
// its dorm through faculty_dorm, and — in a shared building — to just the
// floors it has confirmed in dorm_floor. `floors === null` means "no floor
// restriction" (the faculty is alone in the dorm, the common case).
export type RoomScope = {
  dormId: string | null
  /** null = the faculty sees every floor (sole occupant / unpartitioned). */
  floors: number[] | null
  /** true once the building is partitioned OR has any room-level grant OR the
   *  faculty is a guest here — the room map read then scopes room by room
   *  instead of trusting the dorm. */
  shared: boolean
  /** Rooms granted to this faculty (dorm_room_grant, 202609300012) — visible
   *  even if on another faculty's floor. */
  grantedToMe: string[]
  /** Rooms granted away from this faculty — hidden even if on its own floor. */
  grantedAway: string[]
}

/**
 * The floor/grant scoping decision, pure so it can be reasoned about in
 * isolation. `floorOwners` is the dorm_floor faculty per floor; `grants` is
 * dorm_room_grant (room -> faculty). See RoomScope for the `floors` meaning.
 */
export function decideRoomScope(
  faculty: string,
  floorOwners: { floor_number: number; faculty: string | null }[],
  grants: { room_number: string; faculty: string }[],
): Omit<RoomScope, 'dormId'> {
  const owners = new Set(floorOwners.map((r) => r.faculty).filter(Boolean) as string[])
  const grantedToMe = grants.filter((g) => g.faculty === faculty).map((g) => g.room_number)
  const grantedAway = grants.filter((g) => g.faculty !== faculty).map((g) => g.room_number)
  const partitioned = owners.size > 1
  const iOwnBuilding = owners.size === 0 || (owners.size === 1 && owners.has(faculty))
  // Linked here but holds neither the building nor any floor → guest: only
  // granted rooms, even with none (then nothing). Without this a guest with
  // no grants falls through to `floors = null` and sees the whole dorm.
  const isGuest = !iOwnBuilding && !owners.has(faculty)
  const shared = partitioned || grants.length > 0 || isGuest

  let floors: number[] | null
  if (!shared) floors = null
  else if (partitioned && owners.has(faculty)) {
    floors = floorOwners.filter((r) => r.faculty === faculty).map((r) => r.floor_number)
  } else if (iOwnBuilding) {
    floors = null
  } else {
    floors = []
  }
  return { floors, shared, grantedToMe, grantedAway }
}

export function createRoomLayoutRepository() {
  const supabase = getServiceSupabase()

  // `dormId` picks a SPECIFIC one of the faculty's buildings (many-to-many,
  // 202609300000) — must be one it actually holds, or a stale/foreign id
  // could read/write another faculty's rooms. Omitted resolves to primary,
  // exactly as before this parameter existed (so every caller that doesn't
  // pass it — the vast majority — is unaffected).
  async function scopeFor(faculty: string, dormId?: string): Promise<RoomScope> {
    let resolved: string | null
    if (dormId) {
      const { data: mine } = await supabase
        .from('faculty_dorm')
        .select('dorm_id')
        .eq('faculty', faculty)
        .eq('dorm_id', dormId)
        .maybeSingle()
      if (!mine) throw new ApiError(403, 'Bu yotoqxona sizga tegishli emas')
      resolved = mine.dorm_id
    } else {
      const { data: link } = await supabase
        .from('faculty_dorm')
        .select('dorm_id')
        .eq('faculty', faculty)
        .eq('is_primary', true)
        .maybeSingle()
      resolved = link?.dorm_id ?? null
      if (!resolved && faculty !== PRIMARY_FACULTY) {
        const { data: fb } = await supabase
          .from('faculty_dorm')
          .select('dorm_id')
          .eq('faculty', PRIMARY_FACULTY)
          .eq('is_primary', true)
          .maybeSingle()
        resolved = fb?.dorm_id ?? null
      }
    }
    if (!resolved) return { dormId: null, floors: null, shared: false, grantedToMe: [], grantedAway: [] }
    const dorm = resolved

    const [{ data: floorRows }, { data: grantRows }] = await Promise.all([
      supabase.from('dorm_floor').select('floor_number, faculty').eq('dorm_id', dorm),
      supabase.from('dorm_room_grant').select('room_number, faculty').eq('dorm_id', dorm),
    ])
    return {
      dormId: dorm,
      ...decideRoomScope(
        faculty,
        (floorRows ?? []) as { floor_number: number; faculty: string | null }[],
        (grantRows ?? []) as { room_number: string; faculty: string }[],
      ),
    }
  }

  return {
    scopeFor,

    async listAllRooms(faculty: string, dormId?: string) {
      const scope = await scopeFor(faculty, dormId)
      if (!scope.dormId) return []
      const { data, error } = await supabase
        .from('floor_room_layout')
        .select('room_number, floor_number, block, side, position, size, frozen, frozen_reason, capacity, gender')
        .eq('dorm_id', scope.dormId)
        .order('floor_number', { ascending: true })
        .order('room_number', { ascending: true })
      if (error) throw error
      // This whole feature (map + 3D builder + generator) is for 'simple'
      // dorms, where room_number is unique per building. A blocked-layout
      // dorm's rooms repeat the number per floor/wing and are managed from
      // /dekan/blok-xonalar — never surface them here.
      let rows = (data ?? []).filter((r) => !(r as { block?: string | null }).block)
      // Shared building: scope to what this faculty actually manages —
      // its floors + rooms granted to it, minus rooms granted away. A dorm
      // has ~200 rooms at most, so the filter is done in memory.
      if (scope.shared) {
        const away = new Set(scope.grantedAway)
        const mine = new Set(scope.grantedToMe)
        const floors = scope.floors ? new Set(scope.floors) : null
        rows = rows.filter((r) =>
          !away.has(r.room_number)
          && (mine.has(r.room_number) || floors === null || floors.has(r.floor_number)))
      }
      return rows
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
    async occupiedRoomNumbers(faculty: string, dormId?: string): Promise<Set<string>> {
      const scope = await scopeFor(faculty, dormId)

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

    async listFloor(faculty: string, floorNumber: number, dormId?: string) {
      const scope = await scopeFor(faculty, dormId)
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

    // Numeric-room count per floor for the WHOLE building (not scoped to the
    // faculty's own floors). The generator preview needs this so sequential
    // numbering flows past another faculty's floors exactly as
    // apply_building_layout will. Counts only — no room data, no PII.
    async buildingFloorCounts(faculty: string, dormId?: string): Promise<Record<number, number>> {
      const scope = await scopeFor(faculty, dormId)
      if (!scope.dormId) return {}
      const { data, error } = await supabase
        .from('floor_room_layout')
        .select('floor_number, room_number')
        .eq('dorm_id', scope.dormId)
        .is('block', null)
      if (error) throw error
      const counts: Record<number, number> = {}
      for (const r of data ?? []) {
        if (/^\d+$/.test(String(r.room_number).trim())) {
          counts[r.floor_number] = (counts[r.floor_number] ?? 0) + 1
        }
      }
      return counts
    },

    // Renumbers the whole building to match a "nechta xona per qavat" target
    // (migration 20260902080254). Occupied rooms are pinned at their current
    // number; only empty rooms move / are added / are removed. Raises P0003
    // (with a room list) if a resident's room can't keep its number.
    // `dormId` (validated against the faculty's own list — the RPC re-checks
    // this itself too, defense in depth) targets a specific building;
    // omitted resolves to primary inside the RPC, unchanged.
    async applyBuildingLayout(
      faculty: string,
      numbering: 'sequential' | 'per-floor',
      plans: { floor: number; rooms: number }[],
      dormId?: string,
    ): Promise<{ created: number; removed: number; renumbered: number }> {
      if (dormId) await scopeFor(faculty, dormId) // 403s if not ours
      const { data, error } = await supabase.rpc('apply_building_layout', {
        p_faculty: faculty,
        p_numbering: numbering,
        p_floors: plans,
        p_dorm_id: dormId ?? null,
      })
      if (error) throw error
      return (data ?? { created: 0, removed: 0, renumbered: 0 }) as {
        created: number
        removed: number
        renumbered: number
      }
    },

    async replaceFloor(faculty: string, floorNumber: number, blocks: RoomLayoutBlock[], dormId?: string) {
      if (dormId) await scopeFor(faculty, dormId) // 403s if not ours
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
        p_dorm_id: dormId ?? null,
      })
      if (error) throw error
    },

    // Per-room capacity override (null = back to the dorm default). Scoped to
    // this dorm's rows — mirrors setFrozen. Returns whether a row was hit.
    async setCapacity(faculty: string, roomNumber: string, capacity: number | null, dormId?: string) {
      const scope = await scopeFor(faculty, dormId)
      let query = supabase
        .from('floor_room_layout')
        .update({ capacity })
        .eq('room_number', roomNumber)
      if (scope.dormId) query = query.eq('dorm_id', scope.dormId)
      const { data, error } = await query.select('room_number').maybeSingle()
      if (error) throw error
      return Boolean(data)
    },

    async bulkSetCapacity(faculty: string, roomNumbers: string[], capacity: number | null, dormId?: string) {
      if (roomNumbers.length === 0) return 0
      const scope = await scopeFor(faculty, dormId)
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
    async setGender(faculty: string, roomNumber: string, gender: 'male' | 'female' | null, dormId?: string) {
      const scope = await scopeFor(faculty, dormId)
      let query = supabase
        .from('floor_room_layout')
        .update({ gender })
        .eq('room_number', roomNumber)
      if (scope.dormId) query = query.eq('dorm_id', scope.dormId)
      const { data, error } = await query.select('room_number').maybeSingle()
      if (error) throw error
      return Boolean(data)
    },

    async bulkSetGender(faculty: string, roomNumbers: string[], gender: 'male' | 'female' | null, dormId?: string) {
      if (roomNumbers.length === 0) return 0
      const scope = await scopeFor(faculty, dormId)
      let query = supabase
        .from('floor_room_layout')
        .update({ gender })
        .in('room_number', roomNumbers)
      if (scope.dormId) query = query.eq('dorm_id', scope.dormId)
      const { data, error } = await query.select('room_number')
      if (error) throw error
      return data?.length ?? 0
    },

    async setFrozen(faculty: string, roomNumber: string, frozen: boolean, reason: string | null, dormId?: string) {
      const scope = await scopeFor(faculty, dormId)
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
