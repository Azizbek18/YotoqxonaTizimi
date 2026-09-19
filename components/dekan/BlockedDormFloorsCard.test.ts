import { describe, expect, it } from 'vitest'
import { groupAssignedBlockedFloors } from './BlockedDormFloorsCard'
import type { BlockedRoomSection } from '@/features/dorms/types'

const section = (block: string, floor: number): BlockedRoomSection => ({
  block,
  floor,
  gender: null,
  rooms: [],
})

describe('groupAssignedBlockedFloors', () => {
  it('shows only assigned floors and merges their blocks', () => {
    expect(groupAssignedBlockedFloors([
      section('B', 3),
      section('A', 3),
      section('A', 7),
    ])).toEqual([
      { floor: 3, blocks: ['A', 'B'] },
      { floor: 7, blocks: ['A'] },
    ])
  })

  it('does not invent unassigned floors', () => {
    expect(groupAssignedBlockedFloors([section('A', 12)])).toEqual([
      { floor: 12, blocks: ['A'] },
    ])
  })
})
