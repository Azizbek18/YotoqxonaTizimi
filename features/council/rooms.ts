import { roomIdentity } from '@/lib/room-identity'

export type CouncilRoom = {
  key: string
  dorm_id: string
  dormNumber: string
  block: string | null
  floor_number: number
  room_number: string
  roomNumber: string
  floor: number
  capacity: number
  frozen: boolean
}

/** Only complete physical addresses can contribute to room occupancy. */
export function occupantsByPhysicalRoom<T extends {
  dorm_id: string | null; block: string | null; assigned_floor: number | null; room_number: string | null
}>(students: T[]): Map<string, T[]> {
  const result = new Map<string, T[]>()
  for (const student of students) {
    if (!student.dorm_id || !student.room_number || (student.block && student.assigned_floor == null)) continue
    const key = roomIdentity(student)
    const occupants = result.get(key) ?? []
    occupants.push(student)
    result.set(key, occupants)
  }
  return result
}

export function councilRoomLabel(room: CouncilRoom): string {
  return `${room.dormNumber}-yotoqxona${room.block ? ` · ${room.block}-blok` : ''} · ${room.floor}-qavat · ${room.roomNumber}-xona`
}
