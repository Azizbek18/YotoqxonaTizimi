import { describe, expect, it } from 'vitest'
import { studentsInDorm } from './dorm-scope'

const rows = [
  { id: 'a', dorm_id: '12', room_number: '22' },
  { id: 'b', dorm_id: '3', room_number: '22' },
  { id: 'c', dorm_id: '12', room_number: null },
  { id: 'd', dorm_id: null, room_number: null },
]

describe('student directory building scope', () => {
  it('keeps identical room numbers in different buildings separate', () => {
    expect(studentsInDorm(rows, '12').map((row) => row.id)).toEqual(['a', 'c'])
    expect(studentsInDorm(rows, '3').map((row) => row.id)).toEqual(['b'])
  })
  it('shows unassigned students only in the explicit unassigned view', () => {
    expect(studentsInDorm(rows, null).map((row) => row.id)).toEqual(['d'])
  })
  it('shows no students while building selection is unresolved or unknown', () => {
    expect(studentsInDorm(rows, undefined)).toEqual([])
    expect(studentsInDorm(rows, 'unknown')).toEqual([])
  })
})
