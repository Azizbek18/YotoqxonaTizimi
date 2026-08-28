import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/server/http/api-error'

const requireActiveStaff = vi.fn()
const checkRateLimit = vi.fn()

// A chainable Supabase query stub: every builder method returns `this`, and the
// chain resolves to `terminal` when awaited or when a terminal method is called.
let terminal: { data: unknown; error: unknown } = { data: null, error: null }
const calls: { method: string; args: unknown[] }[] = []

function makeChain() {
  const chain: Record<string, unknown> = {}
  const handler = (method: string) => (...args: unknown[]) => {
    calls.push({ method, args })
    if (method === 'single' || method === 'maybeSingle') return Promise.resolve(terminal)
    return chain
  }
  for (const m of ['select', 'insert', 'update', 'delete', 'eq', 'ilike', 'in', 'neq', 'order', 'single', 'maybeSingle']) {
    chain[m] = handler(m)
  }
  // `await chain` (no terminal method, e.g. the GET list query) resolves here.
  chain.then = (resolve: (v: unknown) => unknown) => resolve(terminal)
  return chain
}

const from = vi.fn(() => makeChain())

vi.mock('@/server/auth/guards', () => ({ requireActiveStaff: (...a: unknown[]) => requireActiveStaff(...a) }))
vi.mock('@/lib/security', () => ({ checkRateLimit: (...a: unknown[]) => checkRateLimit(...a) }))
vi.mock('@/lib/server-supabase', () => ({ getServiceSupabase: () => ({ from }) }))

const { GET, POST, PATCH, DELETE } = await import('./route')

const AMIT_ADMIN = { id: 'admin-1', full_name: 'Admin', email: 'a@x.uz', role: 'admin', status: 'active', faculty: null }
const KIMYO_DEKAN = { id: 'dekan-9', full_name: 'Dekan', email: 'd@x.uz', role: 'dekan', status: 'active', faculty: 'kimyo' }
const AUTH = (staff: unknown) => ({ user: { id: (staff as { id: string }).id }, staff })

function req(method: string, body?: unknown, search = '') {
  return new NextRequest(`http://localhost/api/admin/elonlar${search}`, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

const argsOf = (method: string) => calls.filter((c) => c.method === method).map((c) => c.args)

beforeEach(() => {
  vi.clearAllMocks()
  calls.length = 0
  terminal = { data: null, error: null }
  checkRateLimit.mockResolvedValue({ allowed: true, remaining: 19 })
})

describe('auth', () => {
  it('rejects a non-staff caller before any query', async () => {
    requireActiveStaff.mockRejectedValue(new ApiError(403, 'yo\'q', 'FORBIDDEN'))
    const res = await GET(req('GET'))
    expect(res.status).toBe(403)
    expect(from).not.toHaveBeenCalled()
  })
})

describe('GET', () => {
  it('scopes the list to the caller\'s faculty and to staff audiences', async () => {
    requireActiveStaff.mockResolvedValue(AUTH(KIMYO_DEKAN))
    terminal = { data: [{ id: 'e1' }], error: null }
    const res = await GET(req('GET'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ elonlar: [{ id: 'e1' }] })
    expect(argsOf('ilike')).toContainEqual(['faculty', 'kimyo'])
    expect(argsOf('in')).toContainEqual(['audience', ['all', 'faculty']])
  })

  it('falls back to the primary faculty for an admin with no faculty', async () => {
    requireActiveStaff.mockResolvedValue(AUTH(AMIT_ADMIN))
    terminal = { data: [], error: null }
    await GET(req('GET'))
    expect(argsOf('ilike')).toContainEqual(['faculty', 'amit'])
  })
})

describe('POST', () => {
  it('pins the announcement to the caller\'s faculty, ignoring the body', async () => {
    requireActiveStaff.mockResolvedValue(AUTH(KIMYO_DEKAN))
    terminal = { data: { id: 'new' }, error: null }
    const res = await POST(req('POST', {
      title: 'Suv o\'chiriladi',
      text: 'Ertaga suv bo\'lmaydi.',
      type: 'Muhim',
      audience: 'all',
      faculty: 'amit',
      created_by: 'someone-else',
    }))
    expect(res.status).toBe(201)
    const inserted = argsOf('insert')[0][0] as Record<string, unknown>
    expect(inserted.faculty).toBe('kimyo')
    expect(inserted.created_by).toBe('dekan-9')
    expect(inserted.audience).toBe('all')
  })

  it('rate-limits creation per user', async () => {
    requireActiveStaff.mockResolvedValue(AUTH(KIMYO_DEKAN))
    checkRateLimit.mockResolvedValue({ allowed: false, remaining: 0 })
    const res = await POST(req('POST', { title: 'aaa', text: 'bbbbb', type: 'Muhim' }))
    expect(res.status).toBe(429)
    expect(from).not.toHaveBeenCalled()
  })

  it('rejects an invalid type', async () => {
    requireActiveStaff.mockResolvedValue(AUTH(KIMYO_DEKAN))
    const res = await POST(req('POST', { title: 'aaa', text: 'bbbbb', type: 'Nope' }))
    expect(res.status).toBe(400)
  })
})

describe('PATCH', () => {
  it('cannot re-target audience or faculty', async () => {
    requireActiveStaff.mockResolvedValue(AUTH(KIMYO_DEKAN))
    terminal = { data: { id: 'e1' }, error: null }
    await PATCH(req('PATCH', { id: 'e1', title: 'Yangi sarlavha', audience: 'faculty', faculty: 'amit' }))
    const updated = argsOf('update')[0][0] as Record<string, unknown>
    expect(updated).not.toHaveProperty('audience')
    expect(updated).not.toHaveProperty('faculty')
    expect(updated.title).toBe('Yangi sarlavha')
    expect(argsOf('ilike')).toContainEqual(['faculty', 'kimyo'])
  })

  it('404s when the row is outside the caller\'s faculty', async () => {
    requireActiveStaff.mockResolvedValue(AUTH(KIMYO_DEKAN))
    terminal = { data: null, error: null }
    const res = await PATCH(req('PATCH', { id: 'other', title: 'Yangi sarlavha' }))
    expect(res.status).toBe(404)
  })
})

describe('DELETE', () => {
  it('scopes the delete to the caller\'s faculty', async () => {
    requireActiveStaff.mockResolvedValue(AUTH(KIMYO_DEKAN))
    terminal = { data: { id: 'e1' }, error: null }
    const res = await DELETE(req('DELETE', undefined, '?id=e1'))
    expect(res.status).toBe(200)
    expect(argsOf('eq')).toContainEqual(['id', 'e1'])
    expect(argsOf('ilike')).toContainEqual(['faculty', 'kimyo'])
  })

  it('404s a delete outside the caller\'s faculty', async () => {
    requireActiveStaff.mockResolvedValue(AUTH(KIMYO_DEKAN))
    terminal = { data: null, error: null }
    const res = await DELETE(req('DELETE', undefined, '?id=other'))
    expect(res.status).toBe(404)
  })
})
