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

describe('permitsInDorm', () => {
  const permits = [
    { id: 'a', dorm_id: 'd12', room_number: '1' },
    { id: 'b', dorm_id: 'd3', room_number: '2' },
    { id: 'pending', dorm_id: null, room_number: null },
  ]
  it('keeps unplaced permits visible on every building tab', async () => {
    const { permitsInDorm } = await import('./dorm-scope')
    expect(permitsInDorm(permits, 'd12').map((p) => p.id)).toEqual(['a', 'pending'])
    expect(permitsInDorm(permits, 'd3').map((p) => p.id)).toEqual(['b', 'pending'])
    expect(permitsInDorm(permits, undefined)).toEqual([])
  })
})
