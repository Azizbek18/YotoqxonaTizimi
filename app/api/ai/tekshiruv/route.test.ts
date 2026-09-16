import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { ApiError } from '@/server/http/api-error'

const mocks = vi.hoisted(() => ({
  requireActiveStudent: vi.fn(),
  checkRateLimit: vi.fn(),
  getClientIp: vi.fn(),
  readMultipartForm: vi.fn(),
  aiVisionConfigured: vi.fn(),
  aiVisionJson: vi.fn(),
  signFileClaim: vi.fn(),
  from: vi.fn(),
}))

vi.mock('@/server/auth/guards', () => ({ requireActiveStudent: mocks.requireActiveStudent }))
vi.mock('@/lib/security', () => ({ checkRateLimit: mocks.checkRateLimit, getClientIp: mocks.getClientIp }))
vi.mock('@/lib/upload-limits', () => ({
  readMultipartForm: mocks.readMultipartForm,
  MAX_UPLOAD_SIZE_BYTES: 4 * 1024 * 1024,
}))
vi.mock('@/lib/ai', () => ({ aiVisionConfigured: mocks.aiVisionConfigured, aiVisionJson: mocks.aiVisionJson }))
vi.mock('@/lib/receipt-claim', () => ({ signFileClaim: mocks.signFileClaim }))
vi.mock('@/lib/server-supabase', () => ({ getServiceSupabase: () => ({ from: mocks.from }) }))

const { POST } = await import('./route')

// A real JPEG signature (0xFF 0xD8 0xFF) so hasAllowedSignature passes for image/jpeg.
const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, ...new Array(20).fill(0)])

const tableState: Record<string, { data: unknown; error: unknown }> = {}

function resetTableState() {
  tableState.tolovlar = { data: [], error: null }
  tableState.payment_receipt_transactions = { data: [], error: null }
}

function chain(table: string) {
  const b: Record<string, unknown> & PromiseLike<{ data: unknown; error: unknown }> = {
    select: () => b, eq: () => b, neq: () => b, limit: () => b,
    then: (resolve: (v: { data: unknown; error: unknown }) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(tableState[table]).then(resolve, reject),
  } as never
  return b
}

function req(form: Map<string, unknown>) {
  mocks.readMultipartForm.mockResolvedValue(form)
  return new NextRequest('https://example.test/api/ai/tekshiruv', { method: 'POST' })
}

function validForm(overrides: Partial<{ file: File; amount: string }> = {}) {
  return new Map<string, unknown>([
    ['file', overrides.file ?? new File([jpegBytes], 'chek.jpg', { type: 'image/jpeg' })],
    ['amount', overrides.amount ?? '150000'],
  ])
}

beforeEach(() => {
  vi.resetAllMocks()
  resetTableState()
  mocks.from.mockImplementation((table: string) => chain(table))
  mocks.getClientIp.mockReturnValue('127.0.0.1')
  mocks.checkRateLimit.mockResolvedValue({ allowed: true })
  mocks.requireActiveStudent.mockResolvedValue({ student: { id: 's1' } })
  mocks.aiVisionConfigured.mockReturnValue(true)
  mocks.signFileClaim.mockReturnValue('signed-claim-token')
})

describe('POST /api/ai/tekshiruv', () => {
  it('401s without a session', async () => {
    mocks.requireActiveStudent.mockRejectedValue(new ApiError(401, 'Autentifikatsiya talab qilinadi', 'UNAUTHENTICATED'))
    const res = await POST(req(validForm()))
    expect(res.status).toBe(401)
  })

  it('429s when the check rate limit is exceeded', async () => {
    mocks.checkRateLimit.mockResolvedValue({ allowed: false })
    const res = await POST(req(validForm()))
    expect(res.status).toBe(429)
  })

  it('400s an invalid declared amount (PaymentValidationError shape)', async () => {
    const res = await POST(req(validForm({ amount: '0' })))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.valid).toBe(false)
  })

  it('400s a missing file', async () => {
    const res = await POST(req(new Map([['amount', '150000']])))
    expect(res.status).toBe(400)
  })

  it('400s an unsupported file mime type', async () => {
    const res = await POST(req(validForm({ file: new File([jpegBytes], 'x.gif', { type: 'image/gif' }) })))
    expect(res.status).toBe(400)
  })

  it('413s an oversized file', async () => {
    const bigFile = new File([new Uint8Array(5 * 1024 * 1024)], 'chek.jpg', { type: 'image/jpeg' })
    const res = await POST(req(validForm({ file: bigFile })))
    expect(res.status).toBe(413)
  })

  it('400s a file whose bytes don’t match its declared mime type (fake extension)', async () => {
    const fakeJpeg = new File([new Uint8Array(20).fill(0)], 'chek.jpg', { type: 'image/jpeg' })
    const res = await POST(req(validForm({ file: fakeJpeg })))
    expect(res.status).toBe(400)
  })

  it('500s when the exact-hash duplicate lookup errors', async () => {
    tableState.tolovlar = { data: null, error: new Error('db down') }
    const res = await POST(req(validForm()))
    expect(res.status).toBe(500)
  })

  it('flags an exact-file duplicate without ever calling the AI', async () => {
    tableState.tolovlar = { data: [{ id: 'p1', created_at: '2026-01-01T00:00:00Z' }], error: null }
    const res = await POST(req(validForm()))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.valid).toBe(false)
    expect(body.is_duplicate).toBe(true)
    expect(mocks.aiVisionJson).not.toHaveBeenCalled()
  })

  it('degrades to manual review when no AI provider is configured', async () => {
    mocks.aiVisionConfigured.mockReturnValue(false)
    const res = await POST(req(validForm()))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.valid).toBe(true)
    expect(body.aiSkipped).toBe(true)
    expect(body.claim).toBe('signed-claim-token')
    expect(mocks.signFileClaim).toHaveBeenCalledWith('payment-unverified', expect.any(String), { userId: 's1', amount: 150000 })
  })

  it('degrades to manual review when the AI call itself throws', async () => {
    mocks.aiVisionJson.mockRejectedValue(new Error('provider down'))
    const res = await POST(req(validForm()))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.valid).toBe(true)
    expect(body.aiSkipped).toBe(true)
  })

  function aiResult(overrides: Record<string, unknown> = {}) {
    return {
      candidates: [{ content: { parts: [{ text: JSON.stringify({
        confidence: 95, extracted_amount: 150000, transaction_id: 'CLK7284915',
        payment_date: '2026-01-15', analysis: 'OK', amount_match: true,
        ...overrides,
      }) }] } }],
    }
  }

  it('rejects with no claim when the AI can’t read a transaction id at all', async () => {
    mocks.aiVisionJson.mockResolvedValue(aiResult({ transaction_id: null }))
    const res = await POST(req(validForm()))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.valid).toBe(false)
    expect(body.is_suspicious_id).toBe(true)
    expect(body.claim).toBeNull()
  })

  it('rejects a placeholder/suspicious transaction id', async () => {
    mocks.aiVisionJson.mockResolvedValue(aiResult({ transaction_id: 'TEST' }))
    const res = await POST(req(validForm()))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.valid).toBe(false)
    expect(body.is_suspicious_id).toBe(true)
  })

  it('500s when the transaction-id duplicate lookup errors', async () => {
    mocks.aiVisionJson.mockResolvedValue(aiResult())
    tableState.payment_receipt_transactions = { data: null, error: new Error('db down') }
    const res = await POST(req(validForm()))
    expect(res.status).toBe(500)
  })

  it('rejects a transaction id already used on a different receipt', async () => {
    mocks.aiVisionJson.mockResolvedValue(aiResult())
    tableState.payment_receipt_transactions = {
      data: [{ receipt_hash: 'other-hash', updated_at: '2026-01-01T00:00:00Z' }],
      error: null,
    }
    const res = await POST(req(validForm()))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.valid).toBe(false)
    expect(body.is_duplicate).toBe(true)
    expect(body.claim).toBeNull()
  })

  it('rejects when the AI-extracted amount doesn’t match the declared amount', async () => {
    mocks.aiVisionJson.mockResolvedValue(aiResult({ extracted_amount: 500000, amount_match: false }))
    const res = await POST(req(validForm({ amount: '150000' })))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.valid).toBe(false)
    expect(body.amount_match).toBe(false)
    expect(body.claim).toBeNull()
  })

  it('issues a signed claim binding user + amount + transaction id when everything checks out', async () => {
    mocks.aiVisionJson.mockResolvedValue(aiResult())
    const res = await POST(req(validForm({ amount: '150000' })))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.valid).toBe(true)
    expect(body.claim).toBe('signed-claim-token')
    expect(mocks.signFileClaim).toHaveBeenCalledWith('payment', expect.any(String), {
      userId: 's1', amount: 150000, transactionId: 'CLK7284915',
    })
  })
})
