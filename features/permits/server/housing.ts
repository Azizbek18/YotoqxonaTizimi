import 'server-only'
import { createDormRepository } from '@/features/dorms/server/repository'
import { createRoomLayoutRepository } from '@/features/room-layout/server/repository'
import { createAppSettingsService } from '@/features/app-settings/server/service'

export type HousingRoom = {
  dorm_id?: string | null
  block?: string | null
  room_number: string
  floor_number: number
  frozen: boolean
  capacity: number | null
  gender: 'male' | 'female' | null
}

export function housingKey(row: { dorm_id?: string | null; block?: string | null; room_number?: string | null; assigned_floor?: number | null; floor_number?: number | null }) {
  return JSON.stringify([row.dorm_id ?? null, row.block ?? null, row.block ? (row.assigned_floor ?? row.floor_number ?? null) : null, row.room_number ?? null])
}

/** All assigned buildings, with each building's own capacity and access scope. */
export async function loadFacultyHousing(faculty: string): Promise<HousingRoom[]> {
  const dorms = createDormRepository()
  const layout = createRoomLayoutRepository()
  const settings = createAppSettingsService()
  const ids = await dorms.facultyDormIds(faculty)
  const buildings = await Promise.all(ids.map(async dormId => {
    const [simple, blocked, sections, config] = await Promise.all([
      layout.listAllRooms(faculty, dormId),
      dorms.blockedDormRooms(dormId),
      dorms.listSections(dormId),
      settings.get(faculty, dormId),
    ])
    const mine = new Set(sections.filter(s => s.faculty === faculty).map(s => `${s.block}:${s.floor_number}`))
    return [...simple, ...blocked.filter(r => mine.has(`${r.block}:${r.floor_number}`))].map(r => ({
      ...r, dorm_id: dormId, capacity: r.capacity ?? config.defaultRoomCapacity,
    }))
  }))
  return buildings.flat()
}
