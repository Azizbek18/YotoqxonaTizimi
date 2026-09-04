import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/server/http/api-error'

const requireActiveStaff = vi.fn()

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
  chain.then = (resolve: (v: unknown) => unknown) => resolve(terminal)
  return chain
}

const from = vi.fn(() => makeChain())

vi.mock('@/server/auth/guards', () => ({ requireActiveStaff: (...a: unknown[]) => requireActiveStaff(...a) }))
vi.mock('@/lib/server-supabase', () => ({ getServiceSupabase: () => ({ from }) }))

const { GET, PATCH } = await import('./route')

const AMIT_DEKAN = { id: 'dekan-1', full_name: 'D', email: 'd@x.uz', role: 'dekan', status: 'active', faculty: 'amit' }
const AMIT_TARBIYACHI = { id: 't-1', full_name: 'T', email: 't@x.uz', role: 'tarbiyachi', status: 'active', faculty: 'amit' }
const ROGUE_TARBIYACHI = { ...AMIT_TARBIYACHI, id: 't-2', faculty: null }
const AUTH = (staff: unknown) => ({ user: { id: (staff as { id: string }).id }, staff })

function req(method: string, body?: unknown) {
  return new NextRequest('http://localhost/api/admin/arizalar', {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

const argsOf = (method: string) => calls.filter((c) => c.method === method).map((c) => c.args)

beforeEach(() => {
  vi.clearAllMocks()
  calls.length = 0
  terminal = { data: null, error: null }
})

describe('GET', () => {
  it('scopes a tarbiyachi to their own faculty', async () => {
    requireActiveStaff.mockResolvedValue(AUTH(AMIT_TARBIYACHI))
    terminal = { data: [], error: null }
    const res = await GET(req('GET'))
    expect(res.status).toBe(200)
    expect(argsOf('eq').some(([col, val]) => col === 'faculty' && val === 'amit')).toBe(true)
  })

  it('403s a tarbiyachi with no faculty (no silent primary-building fallback)', async () => {
    requireActiveStaff.mockResolvedValue(AUTH(ROGUE_TARBIYACHI))
    const res = await GET(req('GET'))
    expect(res.status).toBe(403)
    expect(from).not.toHaveBeenCalled()
  })
})

describe('PATCH', () => {
  it('lets a tarbiyachi approve a pending ariza, pinned to status=pending', async () => {
    requireActiveStaff.mockResolvedValue(AUTH(AMIT_TARBIYACHI))
    terminal = { data: { id: 'a1' }, error: null }
    const res = await PATCH(req('PATCH', { id: 'a1', status: 'approved', level: 'critical' }))
    expect(res.status).toBe(200)
    const update = argsOf('update')[0][0] as Record<string, unknown>
    expect(update.status).toBe('approved')
    // severity edits are ignored for a tarbiyachi
    expect(update).not.toHaveProperty('level')
    // and the row must still be pending
    expect(argsOf('eq').some(([col, val]) => col === 'status' && val === 'pending')).toBe(true)
  })

  it('403s a tarbiyachi trying to re-open an ariza to pending', async () => {
    requireActiveStaff.mockResolvedValue(AUTH(AMIT_TARBIYACHI))
    const res = await PATCH(req('PATCH', { id: 'a1', status: 'pending' }))
    expect(res.status).toBe(403)
  })

  it('still lets a dekan set severity and re-open to pending', async () => {
    requireActiveStaff.mockResolvedValue(AUTH(AMIT_DEKAN))
    terminal = { data: { id: 'a1' }, error: null }
    const res = await PATCH(req('PATCH', { id: 'a1', status: 'pending', level: 'warning' }))
    expect(res.status).toBe(200)
    const update = argsOf('update')[0][0] as Record<string, unknown>
    expect(update.level).toBe('warning')
    expect(argsOf('eq').some(([col, val]) => col === 'status' && val === 'pending')).toBe(false)
  })
})
