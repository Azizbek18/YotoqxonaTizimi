import { NextRequest, NextResponse } from 'next/server'
import { requireCouncilChair } from '@/server/auth/council'
import { createDormRepository } from '@/features/dorms/server/repository'
import { createRoomLayoutRepository } from '@/features/room-layout/server/repository'
import { roomIdentity } from '@/lib/room-identity'
import type { CouncilRoom } from '@/features/council/rooms'

export async function GET(request: NextRequest) {
  try {
    const scoped = await requireCouncilChair(request, 'students.view')
    if (scoped.error) return scoped.error
    const { faculty, serviceSupabase } = scoped
    const dormRepository = createDormRepository()
    const layoutRepository = createRoomLayoutRepository()
    const ids = await dormRepository.facultyDormIds(faculty)
    const rooms: CouncilRoom[] = []
    for (const dormId of ids) {
      const { data: dorm, error } = await serviceSupabase.from('dorms')
        .select('number, layout_kind, default_room_capacity').eq('id', dormId).single()
      if (error) throw error
      let rows
      if (dorm.layout_kind === 'blocked') {
        const sections = (await dormRepository.listSections(dormId)).filter((s) => s.faculty === faculty)
        const { data, error: layoutError } = await serviceSupabase.from('floor_room_layout')
          .select('room_number, floor_number, block, capacity, frozen').eq('dorm_id', dormId)
        if (layoutError) throw layoutError
        rows = (data ?? []).filter((r) => sections.some((s) => s.block === r.block && s.floor_number === r.floor_number))
      } else {
        rows = await layoutRepository.listAllRooms(faculty, dormId)
      }
      for (const row of rows) {
        const address = { dorm_id: dormId, block: row.block ?? null, floor_number: row.floor_number, room_number: row.room_number }
        rooms.push({ ...address, key: roomIdentity(address), dormNumber: dorm.number,
          roomNumber: row.room_number, floor: row.floor_number,
          capacity: row.capacity ?? dorm.default_room_capacity, frozen: row.frozen })
      }
    }
    rooms.sort((a, b) => a.dormNumber.localeCompare(b.dormNumber, undefined, { numeric: true })
      || (a.block ?? '').localeCompare(b.block ?? '') || a.floor - b.floor
      || a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true }))
    return NextResponse.json({ rooms })
  } catch (error) {
    console.error('Council room lookup failed:', error)
    return NextResponse.json({ error: 'Xonalarni yuklab bo‘lmadi' }, { status: 500 })
  }
}
