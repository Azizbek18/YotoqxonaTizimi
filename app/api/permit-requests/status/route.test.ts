import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  getClientIp: vi.fn(),
  issuePermitTelegramLinkSafely: vi.fn(),
  from: vi.fn(),
}))

vi.mock('@/lib/security', () => ({ checkRateLimit: mocks.checkRateLimit, getClientIp: mocks.getClientIp }))
vi.mock('@/lib/permit-telegram', () => ({ issuePermitTelegramLinkSafely: mocks.issuePermitTelegramLinkSafely }))
vi.mock('@/lib/server-supabase', () => ({ getServiceSupabase: () => ({ from: mocks.from }) }))

const { POST } = await import('./route')

type Result = { data?: unknown; error?: unknown; count?: number }

const state = {
  main: { data: null, error: null } as Result,
  ahead: { count: 0, error: null } as Result,
  total: { count: 0, error: null } as Result,
}

function mainBuilder() {
  const b: Record<string, unknown> = {
    select: () => b,
    eq: () => b,
    is: () => b,
    maybeSingle: async () => state.main,
  }
  return b
}

function countBuilder(getResult: () => Result) {
  const b: Record<string, unknown> & PromiseLike<Result> = {
    select: () => b,
    eq: () => b,
    lt: () => b,
    then: (resolve: (v: Result) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(getResult()).then(resolve, reject),
  } as never
  return b
}

let fromCalls = 0
beforeEach(() => {
  vi.resetAllMocks()
  fromCalls = 0
  state.main = { data: null, error: null }
  state.ahead = { count: 0, error: null }
  state.total = { count: 0, error: null }
  mocks.getClientIp.mockReturnValue('127.0.0.1')
  mocks.checkRateLimit.mockResolvedValue({ allowed: true })
  mocks.issuePermitTelegramLinkSafely.mockResolvedValue(null)
  mocks.from.mockImplementation(() => {
    fromCalls += 1
    if (fromCalls === 1) return mainBuilder()
    if (fromCalls === 2) return countBuilder(() => state.ahead)
    return countBuilder(() => state.total)
  })
})

function req(body: unknown) {
  return new NextRequest('https://example.test/api/permit-requests/status', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

const validYollanma = {
  passportSeries: 'AB1234567',
  jshshir: '12345678901234',
  email: 'student@example.com',
}

describe('POST /api/permit-requests/status', () => {
  it('429s when the lookup rate limit is exceeded', async () => {
    mocks.checkRateLimit.mockResolvedValue({ allowed: false })
    const res = await POST(req(validYollanma))
    expect(res.status).toBe(429)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('400s an invalid passport/jshshir/email combination', async () => {
    const res = await POST(req({ passportSeries: 'bad', jshshir: '1', email: 'not-an-email' }))
    expect(res.status).toBe(400)
  })

  it('400s an invalid imtiyozli identity', async () => {
    const res = await POST(req({ applicationType: 'imtiyozli', passportSeries: '', email: 'not-an-email' }))
    expect(res.status).toBe(400)
  })

  it('500s when the database query errors', async () => {
    state.main = { data: null, error: new Error('db down') }
    const res = await POST(req(validYollanma))
    expect(res.status).toBe(500)
  })

  it('returns data: null when nothing matches (no data leak on a wrong guess)', async () => {
    state.main = { data: null, error: null }
    const res = await POST(req(validYollanma))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ data: null })
  })

  it('returns queue position for a pending permit', async () => {
    state.main = {
      data: {
        id: 'perm1', full_name: 'Aliyev Ali', status: 'pending', faculty: 'amit',
        created_at: '2026-01-01T00:00:00Z',
      },
      error: null,
    }
    state.ahead = { count: 2, error: null }
    state.total = { count: 5, error: null }
    const res = await POST(req(validYollanma))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.status).toBe('pending')
    expect(body.data.queuePosition).toBe(3)
    expect(body.data.queueTotal).toBe(5)
  })

  it('omits queue info for a non-pending permit', async () => {
    state.main = { data: { id: 'perm1', full_name: 'Aliyev Ali', status: 'approved', faculty: 'amit' }, error: null }
    const res = await POST(req(validYollanma))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.queuePosition).toBeUndefined()
    expect(body.data.queueTotal).toBeUndefined()
  })
})
