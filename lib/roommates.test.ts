import { describe, expect, it } from 'vitest'
import { isRoommate } from './roommates'

const selected = { id: 'self', room_number: '22', dorm_id: 'dorm-1', block: null, assigned_floor: 2, status: 'active' }
const other = { ...selected, id: 'other' }

describe('roommate residence identity', () => {
  it('includes an active resident of the same room, excluding self', () => {
    expect(isRoommate(other, selected)).toBe(true)
    expect(isRoommate(selected, selected)).toBe(false)
  })
  it('excludes the same room number in another building or block', () => {
    expect(isRoommate({ ...other, dorm_id: 'dorm-2' }, selected)).toBe(false)
    expect(isRoommate({ ...other, block: 'A' }, selected)).toBe(false)
  })
  it('distinguishes floors in blocked buildings', () => {
    const blocked = { ...selected, block: 'A' }
    expect(isRoommate({ ...other, block: 'A' }, blocked)).toBe(true)
    expect(isRoommate({ ...other, block: 'A', assigned_floor: 3 }, blocked)).toBe(false)
    expect(isRoommate({ ...other, block: 'B' }, blocked)).toBe(false)
  })
  it('does not guess roommates when residence information is missing', () => {
    expect(isRoommate(other, { ...selected, dorm_id: null })).toBe(false)
    expect(isRoommate(other, { ...selected, room_number: null })).toBe(false)
    expect(isRoommate(other, { ...selected, block: 'A', assigned_floor: null })).toBe(false)
  })
  it('excludes inactive residents and inactive selected accounts', () => {
    expect(isRoommate({ ...other, status: 'rejected' }, selected)).toBe(false)
    expect(isRoommate(other, { ...selected, status: 'pending' })).toBe(false)
  })
})
