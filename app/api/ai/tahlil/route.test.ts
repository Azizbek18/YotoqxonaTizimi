import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  getRequestUser: vi.fn(),
  checkRateLimit: vi.fn(),
  getClientIp: vi.fn(),
  aiVisionConfigured: vi.fn(),
  aiVisionJson: vi.fn(),
  storageDownload: vi.fn(),
  rpcSingle: vi.fn(),
}))

type Result = { data?: unknown; error?: unknown }
const tableState: Record<string, { single?: Result; maybeSingle?: Result; list?: Result }> = {}

function resetTableState() {
  tableState.users = { maybeSingle: { data: null, error: null } }
  tableState.staff = { maybeSingle: { data: null, error: null } }
  tableState.tolovlar = { single: { data: null, error: null }, list: { data: [], error: null } }
}

function chain(table: string) {
  const b: Record<string, unknown> & PromiseLike<Result> = {
    select: () => b, eq: () => b, neq: () => b, limit: () => b,
    single: async () => tableState[table]?.single ?? { data: null, error: null },
    maybeSingle: async () => tableState[table]?.maybeSingle ?? { data: null, error: null },
    then: (resolve: (v: Result) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(tableState[table]?.list ?? { data: null, error: null }).then(resolve, reject),
  } as never
  return b
}

vi.mock('@/lib/server-auth', () => ({ getRequestUser: mocks.getRequestUser }))
vi.mock('@/lib/security', () => ({ checkRateLimit: mocks.checkRateLimit, getClientIp: mocks.getClientIp }))
vi.mock('@/lib/ai', () => ({ aiVisionConfigured: mocks.aiVisionConfigured, aiVisionJson: mocks.aiVisionJson }))
vi.mock('@/lib/server-supabase', () => ({
  getServiceSupabase: () => ({
    from: (table: string) => chain(table),
    storage: { from: () => ({ download: mocks.storageDownload }) },
    rpc: () => ({ single: mocks.rpcSingle }),
  }),
}))

const { POST } = await import('./route')

function req(body: unknown) {
  return new NextRequest('https://example.test/api/ai/tahlil', { method: 'POST', body: JSON.stringify(body) })
}

const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, ...new Array(20).fill(0)])

beforeEach(() => {
  vi.resetAllMocks()
  resetTableState()
  mocks.getClientIp.mockReturnValue('127.0.0.1')
  mocks.checkRateLimit.mockResolvedValue({ allowed: true })
  mocks.getRequestUser.mockResolvedValue({ id: 'stu1' })
  mocks.aiVisionConfigured.mockReturnValue(true)
  tableState.users.maybeSingle = { data: { role: 'talaba', status: 'active' }, error: null }
  tableState.tolovlar.single = {
    data: {
      id: 'pay1', student_id: 'stu1', student_name: 'Ali', month: 9, year: 2026,
      amount: 300000, receipt_url: 'stu1/receipt.jpg', status: 'waiting', transaction_id: null,
    },
    error: null,
  }
  mocks.storageDownload.mockResolvedValue({ data: new Blob([jpegBytes], { type: 'image/jpeg' }), error: null })
  mocks.rpcSingle.mockResolvedValue({
    data: { applied: true, final_confidence: 95, final_analysis: 'OK' },
    error: null,
  })
})

function aiResult(overrides: Record<string, unknown> = {}) {
  return {
    candidates: [{ content: { parts: [{ text: JSON.stringify({
      confidence: 95, extracted_amount: 300000, transaction_id: 'CLK7284915', analysis: 'Haqiqiy chek',
      ...overrides,
    }) }] } }],
  }
}

describe('POST /api/ai/tahlil', () => {
  it('401s without a session', async () => {
    mocks.getRequestUser.mockResolvedValue(null)
    const res = await POST(req({ paymentId: 'pay1' }))
    expect(res.status).toBe(401)
  })

  it('429s when the analysis rate limit is exceeded', async () => {
    mocks.checkRateLimit.mockResolvedValue({ allowed: false })
    const res = await POST(req({ paymentId: 'pay1' }))
    expect(res.status).toBe(429)
  })

  it('400s a missing paymentId', async () => {
    const res = await POST(req({}))
    expect(res.status).toBe(400)
  })

  it('404s an unknown payment', async () => {
    tableState.tolovlar.single = { data: null, error: null }
    const res = await POST(req({ paymentId: 'pay1' }))
    expect(res.status).toBe(404)
  })

  it('403s a caller who is neither the payment’s own active student nor an active admin', async () => {
    mocks.getRequestUser.mockResolvedValue({ id: 'other-user' })
    tableState.staff.maybeSingle = { data: null, error: null }
    const res = await POST(req({ paymentId: 'pay1' }))
    expect(res.status).toBe(403)
  })

  it('allows an active admin to analyze someone else’s payment', async () => {
    mocks.aiVisionJson.mockResolvedValue(aiResult())
    mocks.getRequestUser.mockResolvedValue({ id: 'admin1' })
    tableState.staff.maybeSingle = { data: { role: 'admin', status: 'active' }, error: null }
    const res = await POST(req({ paymentId: 'pay1' }))
    expect(res.status).toBe(200)
  })

  it('409s a payment that has already been decided', async () => {
    tableState.tolovlar.single = { data: { ...tableState.tolovlar.single!.data as object, status: 'approved' }, error: null }
    const res = await POST(req({ paymentId: 'pay1' }))
    expect(res.status).toBe(409)
  })

  it('400s a payment with no valid receipt path (path doesn’t belong to this student)', async () => {
    tableState.tolovlar.single = { data: { ...tableState.tolovlar.single!.data as object, receipt_url: 'someone-else/receipt.jpg' }, error: null }
    const res = await POST(req({ paymentId: 'pay1' }))
    expect(res.status).toBe(400)
  })

  it('503s when no AI provider is configured', async () => {
    mocks.aiVisionConfigured.mockReturnValue(false)
    const res = await POST(req({ paymentId: 'pay1' }))
    expect(res.status).toBe(503)
  })

  it('500s when the receipt file fails to download', async () => {
    mocks.storageDownload.mockResolvedValue({ data: null, error: new Error('not found') })
    const res = await POST(req({ paymentId: 'pay1' }))
    expect(res.status).toBe(500)
  })

  it('502s when the AI call/parse fails', async () => {
    mocks.aiVisionJson.mockRejectedValue(new Error('provider down'))
    const res = await POST(req({ paymentId: 'pay1' }))
    expect(res.status).toBe(502)
  })

  it('409s when finalize_payment_analysis reports the payment was already decided concurrently', async () => {
    mocks.aiVisionJson.mockResolvedValue(aiResult())
    mocks.rpcSingle.mockResolvedValue({ data: { applied: false }, error: null })
    const res = await POST(req({ paymentId: 'pay1' }))
    expect(res.status).toBe(409)
  })

  it('500s when finalize_payment_analysis itself errors', async () => {
    mocks.aiVisionJson.mockResolvedValue(aiResult())
    mocks.rpcSingle.mockResolvedValue({ data: null, error: new Error('db down') })
    const res = await POST(req({ paymentId: 'pay1' }))
    expect(res.status).toBe(500)
  })

  it('flags a duplicate transaction id found elsewhere in the database', async () => {
    mocks.aiVisionJson.mockResolvedValue(aiResult())
    tableState.tolovlar.list = { data: [{ id: 'pay-other' }], error: null }
    mocks.rpcSingle.mockResolvedValue({ data: { applied: true, final_confidence: 10, final_analysis: 'DUPLICATE' }, error: null })
    const res = await POST(req({ paymentId: 'pay1' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ai_confidence).toBe(10)
  })

  it('finalizes a clean analysis on success', async () => {
    mocks.aiVisionJson.mockResolvedValue(aiResult())
    const res = await POST(req({ paymentId: 'pay1' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      success: true, ai_confidence: 95, ai_extracted_amount: 300000, ai_analysis: 'OK',
    })
  })
})
