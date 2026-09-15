import 'server-only'
import { createDormRepository } from '@/features/dorms/server/repository'
import { createRoomLayoutRepository } from '@/features/room-layout/server/repository'

/** Include only the faculty's sections when the selected building is blocked. */
export async function overviewHousing(faculty: string, dormId: string) {
  const repository = createDormRepository()
  const layout = await repository.getDormLayout(dormId)
  if (layout?.layoutKind !== 'blocked') return createRoomLayoutRepository().listAllRooms(faculty, dormId)
  const [rooms, sections] = await Promise.all([repository.blockedDormRooms(dormId), repository.listSections(dormId)])
  const mine = new Set(sections.filter((section) => section.faculty === faculty)
    .map((section) => JSON.stringify([section.block, section.floor_number])))
  return rooms.filter((room) => mine.has(JSON.stringify([room.block, room.floor_number])))
}
