import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  getClientIp: vi.fn(),
  readMultipartForm: vi.fn(),
  aiVisionConfigured: vi.fn(),
  aiVisionJson: vi.fn(),
  signFileClaim: vi.fn(),
  evaluatePermitDocument: vi.fn(),
}))

vi.mock('@/lib/security', () => ({ checkRateLimit: mocks.checkRateLimit, getClientIp: mocks.getClientIp }))
vi.mock('@/lib/upload-limits', () => ({
  readMultipartForm: mocks.readMultipartForm,
  MAX_UPLOAD_SIZE_BYTES: 4 * 1024 * 1024,
}))
vi.mock('@/lib/ai', () => ({ aiVisionConfigured: mocks.aiVisionConfigured, aiVisionJson: mocks.aiVisionJson }))
vi.mock('@/lib/receipt-claim', () => ({ signFileClaim: mocks.signFileClaim }))
vi.mock('@/lib/permit-document-ai', () => ({ evaluatePermitDocument: mocks.evaluatePermitDocument }))

const { POST } = await import('./route')

const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, ...new Array(20).fill(0)])

function req(form: Map<string, unknown>) {
  mocks.readMultipartForm.mockResolvedValue(form)
  return new NextRequest('https://example.test/api/ai/yollanma-tekshiruv', { method: 'POST' })
}

function validForm(overrides: Partial<{ file: File; fullName: string; jshshir: string; passportSeries: string }> = {}) {
  return new Map<string, unknown>([
    ['file', overrides.file ?? new File([pdfBytes], 'yollanma.pdf', { type: 'application/pdf' })],
    ['fullName', overrides.fullName ?? 'Aliyev Ali Aliyevich'],
    ['jshshir', overrides.jshshir ?? '12345678901234'],
    ['passportSeries', overrides.passportSeries ?? 'AB1234567'],
  ])
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.getClientIp.mockReturnValue('127.0.0.1')
  mocks.checkRateLimit.mockResolvedValue({ allowed: true })
  mocks.aiVisionConfigured.mockReturnValue(true)
  mocks.signFileClaim.mockReturnValue('signed-claim-token')
})

describe('POST /api/ai/yollanma-tekshiruv', () => {
  it('429s when the check rate limit is exceeded', async () => {
    mocks.checkRateLimit.mockResolvedValue({ allowed: false })
    const res = await POST(req(validForm()))
    expect(res.status).toBe(429)
  })

  it('400s a missing file', async () => {
    const form = validForm()
    form.delete('file')
    const res = await POST(req(form))
    expect(res.status).toBe(400)
  })

  it('400s missing applicant identity fields', async () => {
    const res = await POST(req(validForm({ fullName: '' })))
    expect(res.status).toBe(400)
  })

  it('413s an oversized file', async () => {
    const bigFile = new File([new Uint8Array(5 * 1024 * 1024)], 'yollanma.pdf', { type: 'application/pdf' })
    const res = await POST(req(validForm({ file: bigFile })))
    expect(res.status).toBe(413)
  })

  it('400s a file with an unrecognised signature', async () => {
    const badFile = new File([new Uint8Array(20).fill(0)], 'yollanma.pdf', { type: 'application/pdf' })
    const res = await POST(req(validForm({ file: badFile })))
    expect(res.status).toBe(400)
  })

  it('degrades to manual review when no AI provider is configured', async () => {
    mocks.aiVisionConfigured.mockReturnValue(false)
    const res = await POST(req(validForm()))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.valid).toBe(true)
    expect(body.aiSkipped).toBe(true)
    expect(body.claim).toBe('signed-claim-token')
    expect(mocks.signFileClaim).toHaveBeenCalledWith('permit-unverified', expect.any(String), expect.objectContaining({
      passport: 'AB1234567', jshshir: '12345678901234',
    }))
  })

  it('degrades to manual review when the AI call throws', async () => {
    mocks.aiVisionJson.mockRejectedValue(new Error('provider down'))
    const res = await POST(req(validForm()))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.aiSkipped).toBe(true)
  })

  it('degrades to manual review when the AI reply is unparsable JSON', async () => {
    mocks.aiVisionJson.mockResolvedValue({ candidates: [{ content: { parts: [{ text: 'not json' }] } }] })
    const res = await POST(req(validForm()))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.aiSkipped).toBe(true)
  })

  it('rejects a document the AI judges not to be a real referral (no claim issued)', async () => {
    mocks.aiVisionJson.mockResolvedValue({ candidates: [{ content: { parts: [{ text: '{}' }] } }] })
    mocks.evaluatePermitDocument.mockReturnValue({
      valid: false, confidence: 20, mismatches: ['document_type'],
      extracted: { fullName: '', jshshir: '', passport: '', dormitoryName: '', dormitoryAddress: '' },
      structure: {}, analysis: 'Hujjat mos emas',
    })
    const res = await POST(req(validForm()))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.valid).toBe(false)
    expect(body.claim).toBeNull()
  })

  it('issues a signed claim bound to the declared identity when the document checks out', async () => {
    mocks.aiVisionJson.mockResolvedValue({ candidates: [{ content: { parts: [{ text: '{}' }] } }] })
    mocks.evaluatePermitDocument.mockReturnValue({
      valid: true, confidence: 92, mismatches: [],
      extracted: { fullName: 'ALIYEV ALI ALIYEVICH', jshshir: '12345678901234', passport: 'AB1234567', dormitoryName: 'TTJ 7', dormitoryAddress: 'Toshkent' },
      structure: { hasQrCode: true }, analysis: 'Rasmiy hujjat',
    })
    const res = await POST(req(validForm()))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.valid).toBe(true)
    expect(body.claim).toBe('signed-claim-token')
    expect(mocks.signFileClaim).toHaveBeenCalledWith('permit', expect.any(String), expect.objectContaining({
      passport: 'AB1234567', jshshir: '12345678901234',
    }))
  })
})
