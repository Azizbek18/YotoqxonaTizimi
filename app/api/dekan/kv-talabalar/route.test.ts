import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/server/http/api-error'

const requireActiveStaff = vi.fn()
const requirePickedFaculty = vi.fn()

// A chainable Supabase query stub: every builder method returns `this`, and
// the chain resolves to `terminal` when a terminal method is called or when
// awaited directly (the GET list query has no .maybeSingle()).
let terminal: { data: unknown; error: unknown } = { data: null, error: null }
// The foreign_student_documents lookup resolves to this instead, when set.
let docsTerminal: { data: unknown; error: unknown } | null = null
const calls: { method: string; args: unknown[] }[] = []

function makeChain(table: string) {
  const result = () => (table === 'foreign_student_documents' && docsTerminal ? docsTerminal : terminal)
  const chain: Record<string, unknown> = {}
  const handler = (method: string) => (...args: unknown[]) => {
    calls.push({ method, args })
    if (method === 'maybeSingle') return Promise.resolve(result())
    return chain
  }
  for (const m of ['select', 'update', 'delete', 'eq', 'neq', 'in', 'ilike', 'order', 'maybeSingle']) {
    chain[m] = handler(m)
  }
  chain.then = (resolve: (v: unknown) => unknown) => resolve(result())
  return chain
}

const from = vi.fn((table: string) => makeChain(table))

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
  docsTerminal = null
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

  it('returns each student\'s current visa and propiska term for the card', async () => {
    terminal = {
      data: [
        { id: 'f1', status: 'active', full_name: 'Foreign', country: 'Turkmaniston' },
        { id: 'u1', status: 'active', full_name: 'Uzbek', country: "O'zbekiston" },
      ],
      error: null,
    }
    docsTerminal = {
      data: [
        { student_id: 'f1', doc_type: 'visa', status: 'active', expires_on: '2026-01-01' },
        { student_id: 'f1', doc_type: 'visa', status: 'renewing', expires_on: '2099-06-30' },
        { student_id: 'f1', doc_type: 'registration', status: 'active', expires_on: '2099-03-15' },
        { student_id: 'u1', doc_type: 'registration', status: 'active', expires_on: '2099-02-01' },
      ],
      error: null,
    }
    const body = await (await GET(req('GET'))).json()
    const foreign = body.active.find((s: { id: string }) => s.id === 'f1')
    const uzbek = body.active.find((s: { id: string }) => s.id === 'u1')

    // The visa that ends last is the current one.
    expect(foreign.visa).toMatchObject({ expires_on: '2099-06-30', status: 'renewing' })
    expect(foreign.registration.expires_on).toBe('2099-03-15')
    expect(foreign.needs_visa).toBe(true)
    expect(foreign.docs_worst_days).toBeLessThan(0)

    expect(uzbek.visa).toBeNull()
    expect(uzbek.needs_visa).toBe(false)
    expect(uzbek.registration.days_left).toBeGreaterThan(0)
  })

  it('scopes the query to the caller\'s own faculty', async () => {
    await GET(req('GET'))
    const ilikeCall = calls.find((c) => c.method === 'ilike')
    expect(ilikeCall?.args).toEqual(['faculty', 'amit'])
  })
})
