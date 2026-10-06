import { NextRequest, NextResponse } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { roomIdentity } from '@/lib/room-identity'

const mocks = vi.hoisted(() => ({ guard: vi.fn(), ids: vi.fn(), sections: vi.fn(), simpleRooms: vi.fn() }))
vi.mock('@/server/auth/council', () => ({ requireCouncilChair: mocks.guard }))
vi.mock('@/features/dorms/server/repository', () => ({ createDormRepository: () => ({ facultyDormIds: mocks.ids, listSections: mocks.sections }) }))
vi.mock('@/features/room-layout/server/repository', () => ({ createRoomLayoutRepository: () => ({ listAllRooms: mocks.simpleRooms }) }))
const { GET } = await import('./route')
const request = () => new NextRequest('http://localhost/api/kengash/rooms')

beforeEach(() => vi.resetAllMocks())
describe('council rooms across buildings', () => {
  it('keeps distinct addresses and inherits each building capacity; limits blocked rooms to owned sections', async () => {
    mocks.ids.mockResolvedValue(['girls', 'boys', 'blocked'])
    mocks.simpleRooms.mockResolvedValue([{ room_number: '8', floor_number: 1, block: null, capacity: null, frozen: false }])
    mocks.sections.mockResolvedValue([{ block: 'A', floor_number: 11, faculty: 'amit' }])
    const dorms = {
      girls: { number: '3', layout_kind: 'simple', default_room_capacity: 2 },
      boys: { number: '4', layout_kind: 'simple', default_room_capacity: 10 },
      blocked: { number: '7', layout_kind: 'blocked', default_room_capacity: 4 },
    }
    const blockedRooms = [
      { room_number: '8', floor_number: 11, block: 'A', capacity: 5, frozen: false },
      { room_number: '8', floor_number: 12, block: 'A', capacity: null, frozen: false },
      { room_number: '8', floor_number: 11, block: 'B', capacity: null, frozen: false },
    ]
    const from = vi.fn((table: string) => ({ select: () => ({ eq: (_: string, id: keyof typeof dorms) =>
      table === 'dorms' ? { single: async () => ({ data: dorms[id], error: null }) }
        : Promise.resolve({ data: blockedRooms, error: null }) }) }))
    mocks.guard.mockResolvedValue({ faculty: 'amit', serviceSupabase: { from } })
    const response = await GET(request())
    const { rooms } = await response.json()
    expect(response.status).toBe(200)
    expect(rooms).toHaveLength(3)
    expect(rooms.map((r: { capacity: number }) => r.capacity)).toEqual([2, 10, 5])
    expect(new Set(rooms.map((r: { key: string }) => r.key)).size).toBe(3)
    expect(rooms[2].key).toBe(roomIdentity({ dorm_id: 'blocked', block: 'A', floor_number: 11, room_number: '8' }))
  })
  it('checks the revocable council permission before looking up rooms', async () => {
    mocks.guard.mockResolvedValue({ error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) })
    expect((await GET(request())).status).toBe(403)
    expect(mocks.ids).not.toHaveBeenCalled()
    expect(mocks.guard).toHaveBeenCalledWith(expect.anything(), 'students.view')
  })
})
