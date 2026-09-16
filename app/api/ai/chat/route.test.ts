import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { ApiError } from '@/server/http/api-error'

const mocks = vi.hoisted(() => ({
  requireActiveStudent: vi.fn(),
  checkRateLimit: vi.fn(),
  getClientIp: vi.fn(),
  aiChatConfigured: vi.fn(),
  aiChatReply: vi.fn(),
  appSettingsGet: vi.fn(),
}))

vi.mock('@/server/auth/guards', () => ({ requireActiveStudent: mocks.requireActiveStudent }))
vi.mock('@/lib/security', () => ({ checkRateLimit: mocks.checkRateLimit, getClientIp: mocks.getClientIp }))
vi.mock('@/lib/ai', () => ({ aiChatConfigured: mocks.aiChatConfigured, aiChatReply: mocks.aiChatReply }))
vi.mock('@/features/app-settings/server/service', () => ({
  createAppSettingsService: () => ({ get: mocks.appSettingsGet }),
}))

const { POST } = await import('./route')

function req(body: unknown) {
  return new NextRequest('https://example.test/api/ai/chat', { method: 'POST', body: JSON.stringify(body) })
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.getClientIp.mockReturnValue('127.0.0.1')
  mocks.checkRateLimit.mockResolvedValue({ allowed: true })
  mocks.requireActiveStudent.mockResolvedValue({ student: { id: 's1' } })
  mocks.appSettingsGet.mockResolvedValue({ monthlyFee: 300000, yearlyContractFee: 3000000 })
})

describe('POST /api/ai/chat', () => {
  it('401s without a session', async () => {
    mocks.requireActiveStudent.mockRejectedValue(new ApiError(401, 'Autentifikatsiya talab qilinadi', 'UNAUTHENTICATED'))
    const res = await POST(req({ message: 'salom' }))
    expect(res.status).toBe(401)
  })

  it('429s when the chat rate limit is exceeded', async () => {
    mocks.checkRateLimit.mockResolvedValue({ allowed: false })
    const res = await POST(req({ message: 'salom' }))
    expect(res.status).toBe(429)
  })

  it('400s a missing/blank message', async () => {
    const res = await POST(req({ message: '   ' }))
    expect(res.status).toBe(400)
  })

  it('500s when app settings fail to load', async () => {
    mocks.appSettingsGet.mockRejectedValue(new Error('db down'))
    const res = await POST(req({ message: 'salom' }))
    expect(res.status).toBe(500)
  })

  it('uses the offline keyword fallback when no AI provider is configured', async () => {
    mocks.aiChatConfigured.mockReturnValue(false)
    const res = await POST(req({ message: "to'lov qancha" }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.reply).toMatch(/300\s*000/)
  })

  it('calls the AI provider and returns its reply when configured', async () => {
    mocks.aiChatConfigured.mockReturnValue(true)
    mocks.aiChatReply.mockResolvedValue({ candidates: [{ content: { parts: [{ text: 'Salom, yordam beraman!' }] } }] })
    const res = await POST(req({ message: 'salom', history: [{ role: 'user', text: 'oldingi xabar' }] }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ reply: 'Salom, yordam beraman!' })
  })

  it('falls back to a canned outage reply when the AI call throws', async () => {
    mocks.aiChatConfigured.mockReturnValue(true)
    mocks.aiChatReply.mockRejectedValue(new Error('provider down'))
    const res = await POST(req({ message: 'salom' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.reply).toContain('AI vaqtincha ishlamayapti')
  })

  it('bounds an oversized/malformed history array instead of crashing', async () => {
    mocks.aiChatConfigured.mockReturnValue(true)
    mocks.aiChatReply.mockResolvedValue({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] })
    const hugeHistory = Array.from({ length: 100 }, (_, i) => ({ role: 'user', text: `msg ${i}` }))
    const res = await POST(req({ message: 'salom', history: hugeHistory }))
    expect(res.status).toBe(200)
  })
})
