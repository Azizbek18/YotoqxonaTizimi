import { NextRequest } from 'next/server'
import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ auth: vi.fn(), client: vi.fn() }))
vi.mock('@/lib/server-auth', () => ({ getRequestUser: mocks.auth }))
vi.mock('@/lib/server-supabase', () => ({ getServiceSupabase: mocks.client }))
const { GET } = await import('./route')

describe('student duty schedule building scope', () => {
  it.each([null, 'B'])('reads only the resident building and block %s', async (block) => {
    mocks.auth.mockResolvedValue({ id: 's1' })
    const filters: Record<string, [string, unknown][]> = { users: [], elonlar: [] }
    let userReads = 0
    mocks.client.mockReturnValue({ from: (table: string) => {
      const profileQuery = table === 'users' && userReads++ === 0
      const chain = {
        select: () => chain,
        eq: (column: string, value: unknown) => { filters[table].push([column, value]); return chain },
        is: (column: string, value: unknown) => { filters[table].push([column, value]); return chain },
        maybeSingle: async () => ({ data: profileQuery ? { id: 's1', role: 'talaba', status: 'active', faculty: 'amit',
          gender: 'male', assigned_floor: 12, room_number: '8', dorm_id: 'resident-dorm', block } : null, error: null }),
        then: (resolve: (value: unknown) => unknown) => resolve({ data: [], error: null }),
      }
      return chain
    } })
    const response = await GET(new NextRequest('http://localhost/api/student/duty-schedule'))
    expect(response.status).toBe(200)
    for (const table of ['users', 'elonlar']) expect(filters[table]).toContainEqual(['dorm_id', 'resident-dorm'])
    expect(filters.users).toContainEqual(['block', block])
    expect(filters.elonlar).toContainEqual(['target_block', block])
    expect(filters.elonlar).toContainEqual(['target_floor', 12])
  })
})
