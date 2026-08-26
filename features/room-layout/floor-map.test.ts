import { describe, expect, it } from 'vitest'
import { buildRoomFloorMap, resolveFloor } from './floor-map'

describe('resolveFloor', () => {
  const map = buildRoomFloorMap([
    { roomNumber: '101', floor: 1 },
    { roomNumber: '205', floor: 2 },
    // Deliberately contradicts the (room - 1) / 30 guess, which would put
    // room 7 on floor 1: the admin's layout has to win.
    { roomNumber: '7', floor: 3 },
  ])

  it('uses the floor the admin entered, not the room-number guess', () => {
    expect(resolveFloor(map, '7')).toBe(3)
    expect(resolveFloor(map, '205')).toBe(2)
  })

  it('ignores surrounding whitespace in the room number', () => {
    expect(resolveFloor(map, ' 101 ')).toBe(1)
  })

  it('falls back to the room-number guess for rooms missing from the layout', () => {
    expect(resolveFloor(map, '45')).toBe(2)
  })

  it('degrades to the guess while the map is still loading', () => {
    expect(resolveFloor(null, '7')).toBe(1)
  })

  it('returns null without a room number', () => {
    expect(resolveFloor(map, null)).toBeNull()
    expect(resolveFloor(map, '')).toBeNull()
  })
})
