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
    async replaceFloor(floorNumber: number, blocks: RoomLayoutBlock[]) {
      const { error: deleteError } = await supabase.from('floor_room_layout').delete().eq('floor_number', floorNumber)
      if (deleteError) throw deleteError

      if (blocks.length === 0) return

      const rows = blocks.map((block) => ({
        floor_number: floorNumber,
        room_number: block.roomNumber,
        side: block.side,
        position: block.position,
        size: block.size,
      }))
      const { error: insertError } = await supabase.from('floor_room_layout').insert(rows)
      if (insertError) throw insertError
    },
  }
}

export type RoomLayoutRepository = ReturnType<typeof createRoomLayoutRepository>
