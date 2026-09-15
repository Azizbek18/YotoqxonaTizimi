import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const requireCouncilChair = vi.fn()
vi.mock('@/server/auth/council', () => ({
  requireCouncilChair: (...args: unknown[]) => requireCouncilChair(...args),
}))

// A chain that records every .eq()/.in() call so a test can assert the
// captain-only filter was (or wasn't) applied, and resolves to whichever
// table's canned rows it was built for.
function makeChain(rows: unknown[], eqCalls: [string, unknown][]) {
  const chain: Record<string, unknown> = {}
  const record = (method: string) => (...args: [string, unknown]) => {
    if (method === 'eq' || method === 'in') eqCalls.push(args)
    return chain
  }
  chain.select = () => chain
  chain.eq = record('eq')
  chain.in = record('in')
  chain.ilike = () => chain
  chain.order = () => Promise.resolve({ data: rows, error: null })
  chain.then = (resolve: (v: unknown) => unknown) => resolve({ data: rows, error: null })
  return chain
}

const { GET } = await import('./route')

describe('GET /api/kengash/students', () => {
  beforeEach(() => { vi.resetAllMocks() })

  it('tallies each student’s ariza/tushuntirish count without leaking other application types', async () => {
    const usersEq: [string, unknown][] = []
    const appsEq: [string, unknown][] = []
    const from = vi.fn((table: string) => {
      if (table === 'users') {
        return makeChain([
          { id: 's-1', full_name: 'Ali', is_floor_captain: false },
          { id: 's-2', full_name: 'Vali', is_floor_captain: false },
        ], usersEq)
      }
      return makeChain([
        { student_id: 's-1', type: 'ariza' },
        { student_id: 's-1', type: 'ariza' },
        { student_id: 's-1', type: 'tushuntirish' },
        { student_id: 's-1', type: 'chat' }, // must not count
        { student_id: 's-2', type: 'ogohlantirish' }, // must not count
      ], appsEq)
    })
    requireCouncilChair.mockResolvedValue({
      serviceSupabase: { from },
      faculty: 'amit',
      gender: 'male',
    })

    const response = await GET(new NextRequest('http://localhost/api/kengash/students'))
    const body = await response.json()

    expect(body.students).toEqual([
      expect.objectContaining({ id: 's-1', arizaCount: 2, tushuntirishCount: 1 }),
      expect.objectContaining({ id: 's-2', arizaCount: 0, tushuntirishCount: 0 }),
    ])
  })

  it('?role=captain scopes the users query to floor captains only', async () => {
    const usersEq: [string, unknown][] = []
    const from = vi.fn((table: string) =>
      table === 'users' ? makeChain([], usersEq) : makeChain([], []))
    requireCouncilChair.mockResolvedValue({
      serviceSupabase: { from },
      faculty: 'amit',
      gender: 'male',
    })

    await GET(new NextRequest('http://localhost/api/kengash/students?role=captain'))

    expect(usersEq).toContainEqual(['is_floor_captain', true])
  })

  it('propagates the guard rejecting a revoked students.view', async () => {
    const { NextResponse } = await import('next/server')
    requireCouncilChair.mockResolvedValue({
      error: NextResponse.json({ error: 'Bu bo‘lim uchun dekan ruxsat bermagan', code: 'PERMISSION_REVOKED' }, { status: 403 }),
    })
    const response = await GET(new NextRequest('http://localhost/api/kengash/students'))
    expect(response.status).toBe(403)
    expect(requireCouncilChair).toHaveBeenCalledWith(expect.anything(), 'students.view')
  })
})
