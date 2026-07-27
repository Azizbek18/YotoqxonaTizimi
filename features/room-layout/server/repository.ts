import 'server-only'
import { getServiceSupabase } from '@/lib/server-supabase'
import type { RoomLayoutBlock } from '../types'

export function createRoomLayoutRepository() {
  const supabase = getServiceSupabase()
  return {
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
  }
}

export type RoomLayoutRepository = ReturnType<typeof createRoomLayoutRepository>
