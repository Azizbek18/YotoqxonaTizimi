import 'server-only'
import { getServiceSupabase } from '@/lib/server-supabase'
import type { RoomLayoutBlock } from '../types'

export function createRoomLayoutRepository() {
  const supabase = getServiceSupabase()
  return {
    // One faculty's whole-building room -> floor map. Small by nature (a few
    // hundred rows at most) so it's fetched unpaginated and cached by the
    // caller rather than queried per room.
    async listAllRooms(faculty: string) {
      const { data, error } = await supabase
        .from('floor_room_layout')
        .select('room_number, floor_number, side, frozen, frozen_reason')
        .eq('faculty', faculty)
        .order('floor_number', { ascending: true })
        .order('room_number', { ascending: true })
      if (error) throw error
      return data ?? []
    },

    async insertRooms(
      faculty: string,
      rows: { floor_number: number; room_number: string; side: string; position: number; size: string }[],
    ) {
      if (rows.length === 0) return
      const { error } = await supabase
        .from('floor_room_layout')
        .insert(rows.map((row) => ({ ...row, faculty })))
      if (error) throw error
    },

    async listFloor(faculty: string, floorNumber: number) {
      const { data, error } = await supabase
        .from('floor_room_layout')
        .select('room_number, side, position, size')
        .eq('faculty', faculty)
        .eq('floor_number', floorNumber)
        .order('side', { ascending: true })
        .order('position', { ascending: true })
      if (error) throw error
      return data ?? []
    },
    // Delete-then-insert is done inside a single DB function (see
    // replace_floor_room_layout in the DB migration) so a failed insert
    // (e.g. duplicate room number) can't leave the floor's layout wiped
    // with nothing re-inserted.
    async replaceFloor(faculty: string, floorNumber: number, blocks: RoomLayoutBlock[]) {
      const rows = blocks.map((block) => ({
        roomNumber: block.roomNumber,
        side: block.side,
        position: block.position,
        size: block.size,
      }))
      const { error } = await supabase.rpc('replace_floor_room_layout', {
        p_faculty: faculty,
        p_floor_number: floorNumber,
        p_rows: rows,
      })
      if (error) throw error
    },
    // Plain UPDATE, not an RPC: unlike assignRoomAtomic/replaceFloor there's
    // no cross-row invariant to protect (capacity, gender, occupancy) — a
    // single room's frozen flag has no other row that could disagree with
    // it. Returns whether a row actually matched, so the service can tell
    // "room doesn't exist" apart from "already in that state".
    async setFrozen(faculty: string, roomNumber: string, frozen: boolean, reason: string | null) {
      const { data, error } = await supabase
        .from('floor_room_layout')
        .update({ frozen, frozen_reason: reason })
        .eq('faculty', faculty)
        .eq('room_number', roomNumber)
        .select('room_number')
        .maybeSingle()
      if (error) throw error
      return Boolean(data)
    },

    // users.assigned_floor is a denormalized copy of the layout, written
    // once when a student is placed in a room. Server-side floor targeting
    // (elonlar audience, navbatchilik jadvali, tarbiyachi scope) reads that
    // column, so moving a room to another floor in the layout builder has to
    // move its residents with it — otherwise they keep receiving the old
    // floor's announcements forever.
    //
    // Matched by room_number alone, not by the students' academic faculty:
    // during the multi-faculty transition mixed-faculty students still live
    // in the one AMIT building, and their assigned_floor has to track the
    // physical floor regardless of which faculty they study at.
    async syncAssignedFloors(floorNumber: number, roomNumbers: string[]) {
      if (roomNumbers.length === 0) return
      const { error } = await supabase
        .from('users')
        .update({ assigned_floor: floorNumber })
        .eq('role', 'talaba')
        .in('room_number', roomNumbers)
      if (error) throw error
    },
  }
}

export type RoomLayoutRepository = ReturnType<typeof createRoomLayoutRepository>
