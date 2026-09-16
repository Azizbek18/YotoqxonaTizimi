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
  appSettingsGet: vi.fn(),
}))

vi.mock('@/server/auth/guards', () => ({ requireActiveStudent: mocks.requireActiveStudent }))
vi.mock('@/lib/security', () => ({ checkRateLimit: mocks.checkRateLimit, getClientIp: mocks.getClientIp }))
vi.mock('@/lib/upload-limits', () => ({
  readMultipartForm: mocks.readMultipartForm,
  MAX_UPLOAD_SIZE_BYTES: 4 * 1024 * 1024,
}))
vi.mock('@/lib/ai', () => ({ aiVisionConfigured: mocks.aiVisionConfigured, aiVisionJson: mocks.aiVisionJson }))
vi.mock('@/features/app-settings/server/service', () => ({
  createAppSettingsService: () => ({ get: mocks.appSettingsGet }),
}))

const { POST } = await import('./route')

const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, ...new Array(20).fill(0)])

function req(form: Map<string, unknown>) {
  mocks.readMultipartForm.mockResolvedValue(form)
  return new NextRequest('https://example.test/api/ai/photo-check', { method: 'POST' })
}

function formWith(file: File) {
  return new Map<string, unknown>([['file', file]])
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.getClientIp.mockReturnValue('127.0.0.1')
  mocks.checkRateLimit.mockResolvedValue({ allowed: true })
  mocks.requireActiveStudent.mockResolvedValue({ student: { id: 's1' } })
  mocks.appSettingsGet.mockResolvedValue({ maxUploadSizeMb: 4 })
  mocks.aiVisionConfigured.mockReturnValue(true)
})

describe('POST /api/ai/photo-check', () => {
  it('401s without a session', async () => {
    mocks.requireActiveStudent.mockRejectedValue(new ApiError(401, 'Autentifikatsiya talab qilinadi', 'UNAUTHENTICATED'))
    const res = await POST(req(formWith(new File([jpegBytes], 'p.jpg', { type: 'image/jpeg' }))))
    expect(res.status).toBe(401)
  })

  it('429s when the check rate limit is exceeded', async () => {
    mocks.checkRateLimit.mockResolvedValue({ allowed: false })
    const res = await POST(req(formWith(new File([jpegBytes], 'p.jpg', { type: 'image/jpeg' }))))
    expect(res.status).toBe(429)
  })

  it('400s a missing file', async () => {
    const res = await POST(req(new Map()))
    expect(res.status).toBe(400)
  })

  it('400s an unsupported mime type', async () => {
    const res = await POST(req(formWith(new File([jpegBytes], 'p.pdf', { type: 'application/pdf' }))))
    expect(res.status).toBe(400)
  })

  it('400s an oversized image', async () => {
    const bigFile = new File([new Uint8Array(5 * 1024 * 1024)], 'p.jpg', { type: 'image/jpeg' })
    const res = await POST(req(formWith(bigFile)))
    expect(res.status).toBe(400)
  })

  it('400s a file whose bytes don’t match its declared mime type', async () => {
    const fakeJpeg = new File([new Uint8Array(20).fill(0)], 'p.jpg', { type: 'image/jpeg' })
    const res = await POST(req(formWith(fakeJpeg)))
    expect(res.status).toBe(400)
  })

  it('lets the photo through when no AI provider is configured', async () => {
    mocks.aiVisionConfigured.mockReturnValue(false)
    const res = await POST(req(formWith(new File([jpegBytes], 'p.jpg', { type: 'image/jpeg' }))))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.is_human).toBe(true)
    expect(body.aiSkipped).toBe(true)
  })

  it('lets the photo through when the AI call throws', async () => {
    mocks.aiVisionJson.mockRejectedValue(new Error('provider down'))
    const res = await POST(req(formWith(new File([jpegBytes], 'p.jpg', { type: 'image/jpeg' }))))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.is_human).toBe(true)
    expect(body.aiSkipped).toBe(true)
  })

  it('accepts a human portrait on success', async () => {
    mocks.aiVisionJson.mockResolvedValue({
      candidates: [{ content: { parts: [{ text: JSON.stringify({ is_human: true, confidence: 97, description: 'Portret', reason: null }) }] } }],
    })
    const res = await POST(req(formWith(new File([jpegBytes], 'p.jpg', { type: 'image/jpeg' }))))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ is_human: true, confidence: 97, description: 'Portret', reason: null })
  })

  it('rejects a non-human photo, parsing a fenced ```json code block reply', async () => {
    const fenced = '```json\n' + JSON.stringify({ is_human: false, confidence: 90, description: 'Mushuk', reason: 'Hayvon' }) + '\n```'
    mocks.aiVisionJson.mockResolvedValue({ candidates: [{ content: { parts: [{ text: fenced }] } }] })
    const res = await POST(req(formWith(new File([jpegBytes], 'p.jpg', { type: 'image/jpeg' }))))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.is_human).toBe(false)
    expect(body.reason).toBe('Hayvon')
  })
})
