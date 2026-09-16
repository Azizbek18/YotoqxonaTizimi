import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  requireScopedTarbiyachi: vi.fn(),
  from: vi.fn(),
}))

vi.mock('@/server/auth/tarbiyachi', () => ({ requireScopedTarbiyachi: mocks.requireScopedTarbiyachi }))

const { GET, PATCH } = await import('./route')

type Result = { data?: unknown; error?: unknown }

let callIndex = 0
let responses: { list?: Result; single?: Result }[] = []

function nextBuilder() {
  const idx = callIndex++
  const cfg = responses[idx] ?? {}
  const b: Record<string, unknown> & PromiseLike<Result> = {
    select: () => b,
    in: () => b,
    neq: () => b,
    order: () => b,
    eq: () => b,
    update: () => b,
    maybeSingle: async () => cfg.single ?? { data: null, error: null },
    then: (resolve: (v: Result) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(cfg.list ?? { data: null, error: null }).then(resolve, reject),
  } as never
  return b
}

function req(url: string, init?: ConstructorParameters<typeof NextRequest>[1]) {
  return new NextRequest(url, init)
}

const scopedOk = {
  serviceSupabase: undefined as unknown,
  faculty: 'amit',
  dormFaculties: ['amit', 'iqtisodiyot'],
}

beforeEach(() => {
  vi.resetAllMocks()
  callIndex = 0
  responses = []
  mocks.from.mockImplementation(() => nextBuilder())
  scopedOk.serviceSupabase = { from: mocks.from }
  mocks.requireScopedTarbiyachi.mockResolvedValue(scopedOk)
})

describe('GET /api/staff/arizalar', () => {
  it('propagates the 401/403 error response from the guard', async () => {
    mocks.requireScopedTarbiyachi.mockResolvedValue({ error: NextResponseLike(401) })
    const res = await GET(req('https://example.test/api/staff/arizalar'))
    expect(res.status).toBe(401)
  })

  it('500s when the query errors', async () => {
    responses = [{ list: { data: null, error: new Error('db down') } }]
    const res = await GET(req('https://example.test/api/staff/arizalar'))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.ok).toBe(false)
  })

  it('returns the dorm-scoped, formatted ariza list on success', async () => {
    responses = [{
      list: {
        data: [{ id: 1, student_name: null, text: null, type: null, level: null, status: null, created_at: null, response_date: null }],
        error: null,
      },
    }]
    const res = await GET(req('https://example.test/api/staff/arizalar'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.requests[0]).toEqual({
      id: '1', student_name: "Noma'lum", text: '', type: 'ariza', level: 'info',
      status: 'pending', created_at: null, response_date: null,
    })
    expect(body.scope).toEqual({ faculty: 'amit', faculties: ['amit', 'iqtisodiyot'] })
  })
})

describe('PATCH /api/staff/arizalar', () => {
  it('propagates the 401/403 error response from the guard', async () => {
    mocks.requireScopedTarbiyachi.mockResolvedValue({ error: NextResponseLike(403) })
    const res = await PATCH(req('https://example.test/api/staff/arizalar', { method: 'PATCH', body: '{}' }))
    expect(res.status).toBe(403)
  })

  it('400s a missing id', async () => {
    const res = await PATCH(req('https://example.test/api/staff/arizalar', {
      method: 'PATCH', body: JSON.stringify({ status: 'approved' }),
    }))
    expect(res.status).toBe(400)
  })

  it('400s an invalid status (e.g. trying to set draft)', async () => {
    const res = await PATCH(req('https://example.test/api/staff/arizalar', {
      method: 'PATCH', body: JSON.stringify({ id: 'a1', status: 'draft' }),
    }))
    expect(res.status).toBe(400)
  })

  it('404s an unknown ariza id', async () => {
    responses = [{ single: { data: null, error: null } }]
    const res = await PATCH(req('https://example.test/api/staff/arizalar', {
      method: 'PATCH', body: JSON.stringify({ id: 'a1', status: 'approved' }),
    }))
    expect(res.status).toBe(404)
  })

  it('403s an ariza outside the tarbiyachi’s dorm faculties', async () => {
    responses = [{ single: { data: { faculty: 'fizika' }, error: null } }]
    const res = await PATCH(req('https://example.test/api/staff/arizalar', {
      method: 'PATCH', body: JSON.stringify({ id: 'a1', status: 'approved' }),
    }))
    expect(res.status).toBe(403)
  })

  it('409s an ariza that was already decided (race guard)', async () => {
    responses = [
      { single: { data: { faculty: 'amit' }, error: null } },
      { single: { data: null, error: null } },
    ]
    const res = await PATCH(req('https://example.test/api/staff/arizalar', {
      method: 'PATCH', body: JSON.stringify({ id: 'a1', status: 'approved' }),
    }))
    expect(res.status).toBe(409)
  })

  it('500s when the update query errors', async () => {
    responses = [
      { single: { data: { faculty: 'amit' }, error: null } },
      { single: { data: null, error: new Error('db down') } },
    ]
    const res = await PATCH(req('https://example.test/api/staff/arizalar', {
      method: 'PATCH', body: JSON.stringify({ id: 'a1', status: 'approved' }),
    }))
    expect(res.status).toBe(500)
  })

  it('approves a pending ariza in-scope on success', async () => {
    responses = [
      { single: { data: { faculty: 'amit' }, error: null } },
      { single: { data: { id: 'a1' }, error: null } },
    ]
    const res = await PATCH(req('https://example.test/api/staff/arizalar', {
      method: 'PATCH', body: JSON.stringify({ id: 'a1', status: 'approved' }),
    }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })
})

function NextResponseLike(status: number) {
  return { status, json: async () => ({ ok: false, error: 'denied' }) } as Response
}
