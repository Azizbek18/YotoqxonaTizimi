import { describe, expect, it } from 'vitest'
import { occupantsByPhysicalRoom } from './rooms'
import { roomIdentity } from '@/lib/room-identity'

const resident = (id: string, dorm_id: string | null, block: string | null = null, assigned_floor: number | null = 1) =>
  ({ id, dorm_id, block, assigned_floor, room_number: '8' })

describe('physical room occupancy', () => {
  it('separates the four girls and four boys in room 8 of different dorms', () => {
    const girls = Array.from({ length: 4 }, (_, i) => resident(`g${i}`, 'girls-dorm'))
    const boys = Array.from({ length: 4 }, (_, i) => resident(`b${i}`, 'boys-dorm'))
    const rooms = occupantsByPhysicalRoom([...girls, ...boys])
    expect(rooms.size).toBe(2)
    expect(rooms.get(roomIdentity(girls[0]))).toEqual(girls)
    expect(rooms.get(roomIdentity(boys[0]))).toEqual(boys)
  })
  it('separates repeated numbers by both block and floor', () => {
    const people = [resident('a11', 'd1', 'A', 11), resident('a12', 'd1', 'A', 12), resident('b11', 'd1', 'B', 11)]
    const rooms = occupantsByPhysicalRoom(people)
    expect(rooms.size).toBe(3)
    for (const person of people) expect(rooms.get(roomIdentity(person))).toEqual([person])
  })
  it('does not guess a dorm or floor for incomplete addresses', () => {
    expect(occupantsByPhysicalRoom([resident('missing-dorm', null), resident('missing-floor', 'd1', 'A', null)]).size).toBe(0)
  })
  it('matches simple rooms even when the resident has an outdated floor', () => {
    const person = resident('s1', 'd1', null, 2)
    const layout = { dorm_id: 'd1', block: null, floor_number: 1, room_number: '8' }
    expect(occupantsByPhysicalRoom([person]).get(roomIdentity(layout))).toEqual([person])
  })
})
