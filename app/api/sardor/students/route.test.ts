import { NextRequest } from 'next/server'
import { describe, expect, it, vi } from 'vitest'

const guard = vi.hoisted(() => vi.fn())
vi.mock('@/server/auth/sardor', () => ({ requireFloorCaptain: guard }))
const { GET } = await import('./route')

describe('captain students physical scope', () => {
  it.each([null, 'A'])('pins the query to the captain building and block %s', async (block) => {
    const filters: [string, unknown][] = []
    const chain = {
      select: () => chain,
      eq: (column: string, value: unknown) => { filters.push([column, value]); return chain },
      is: (column: string, value: unknown) => { filters.push([column, value]); return chain },
      then: (resolve: (value: unknown) => unknown) => resolve({ data: [], error: null }),
    }
    guard.mockResolvedValue({ caller: { assigned_floor: 11, gender: 'female', dorm_id: 'actual-dorm', block },
      faculty: 'amit', serviceSupabase: { from: () => chain } })
    const response = await GET(new NextRequest('http://localhost/api/sardor/students?dormId=foreign'))
    expect(response.status).toBe(200)
    expect(filters).toContainEqual(['dorm_id', 'actual-dorm'])
    expect(filters).toContainEqual(['block', block])
    expect(filters).toContainEqual(['assigned_floor', 11])
    expect(filters).toContainEqual(['is_off_campus', false])
  })
})
