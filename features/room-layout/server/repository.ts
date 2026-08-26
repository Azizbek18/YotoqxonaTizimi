import 'server-only'
import { getServiceSupabase } from '@/lib/server-supabase'
import type { RoomLayoutBlock } from '../types'

export function createRoomLayoutRepository() {
  const supabase = getServiceSupabase()
  return {
    // Whole-building room -> floor map. Small by nature (one row per room,
    // a few hundred at most) so it's fetched unpaginated and cached by the
    // caller rather than queried per room.
    async listAllRooms() {
      const { data, error } = await supabase
        .from('floor_room_layout')
        .select('room_number, floor_number, side, frozen, frozen_reason')
        .order('floor_number', { ascending: true })
        .order('room_number', { ascending: true })
      if (error) throw error
      return data ?? []
    },

    async insertRooms(rows: { floor_number: number; room_number: string; side: string; position: number; size: string }[]) {
      if (rows.length === 0) return
      const { error } = await supabase.from('floor_room_layout').insert(rows)
      if (error) throw error
    },

    async listFloor(floorNumber: number) {
      const { data, error } = await supabase
        .from('floor_room_layout')
        .select('room_number, side, position, size')
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
    async replaceFloor(floorNumber: number, blocks: RoomLayoutBlock[]) {
      const rows = blocks.map((block) => ({
        roomNumber: block.roomNumber,
        side: block.side,
        position: block.position,
        size: block.size,
      }))
      const { error } = await supabase.rpc('replace_floor_room_layout', {
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
    async setFrozen(roomNumber: string, frozen: boolean, reason: string | null) {
      const { data, error } = await supabase
        .from('floor_room_layout')
        .update({ frozen, frozen_reason: reason })
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
    // Only the floor being saved is re-synced. That is enough: a room can
    // only live on one floor (unique room_number), and the RPC refuses to
    // drop an occupied room from the layout, so the sole way a resident's
    // floor changes is the room re-appearing on the floor that is saved next.
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
