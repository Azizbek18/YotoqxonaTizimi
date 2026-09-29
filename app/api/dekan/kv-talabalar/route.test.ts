import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/server/http/api-error'

const requireActiveStaff = vi.fn()
const requirePickedFaculty = vi.fn()

// A chainable Supabase query stub: every builder method returns `this`, and
// the chain resolves to `terminal` when a terminal method is called or when
// awaited directly (the GET list query has no .maybeSingle()).
let terminal: { data: unknown; error: unknown } = { data: null, error: null }
const calls: { method: string; args: unknown[] }[] = []

function makeChain() {
  const chain: Record<string, unknown> = {}
  const handler = (method: string) => (...args: unknown[]) => {
    calls.push({ method, args })
    if (method === 'maybeSingle') return Promise.resolve(terminal)
    return chain
  }
  for (const m of ['select', 'update', 'delete', 'eq', 'ilike', 'order', 'maybeSingle']) {
    chain[m] = handler(m)
  }
  chain.then = (resolve: (v: unknown) => unknown) => resolve(terminal)
  return chain
}

const from = vi.fn(() => makeChain())

vi.mock('@/server/auth/guards', () => ({ requireActiveStaff: (...a: unknown[]) => requireActiveStaff(...a) }))
vi.mock('@/server/auth/faculty', () => ({ requirePickedFaculty: (...a: unknown[]) => requirePickedFaculty(...a) }))
vi.mock('@/lib/server-supabase', () => ({ getServiceSupabase: () => ({ from }) }))

const { GET } = await import('./route')

const DEKAN = { id: 'dekan-1', role: 'dekan', status: 'active', faculty: 'amit' }

function req(method: string, body?: unknown) {
  return new NextRequest('http://localhost/api/dekan/kv-talabalar', {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  calls.length = 0
  terminal = { data: null, error: null }
  requireActiveStaff.mockResolvedValue({ user: { id: DEKAN.id }, staff: DEKAN })
  requirePickedFaculty.mockReturnValue('amit')
})

describe('GET /api/dekan/kv-talabalar', () => {
  it('rejects a non-staff caller before any query', async () => {
    requireActiveStaff.mockRejectedValue(new ApiError(403, "yo'q", 'FORBIDDEN'))
    const res = await GET(req('GET'))
    expect(res.status).toBe(403)
    expect(from).not.toHaveBeenCalled()
  })

  it('splits rows into pending and active by status', async () => {
    terminal = {
      data: [
        { id: 's1', status: 'pending', full_name: 'A' },
        { id: 's2', status: 'active', full_name: 'B' },
      ],
      error: null,
    }
    const res = await GET(req('GET'))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.pending).toHaveLength(1)
    expect(body.active).toHaveLength(1)
    expect(body.pending[0].id).toBe('s1')
  })

  it('scopes the query to the caller\'s own faculty', async () => {
    await GET(req('GET'))
    const ilikeCall = calls.find((c) => c.method === 'ilike')
    expect(ilikeCall?.args).toEqual(['faculty', 'amit'])
  })
})
