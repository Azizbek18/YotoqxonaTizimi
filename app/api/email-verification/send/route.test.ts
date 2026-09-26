import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'test-secret-key-for-email-proof'

const mocks = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  sendEmailVerificationCode: vi.fn(),
}))

vi.mock('@/lib/security', () => ({ checkRateLimit: mocks.checkRateLimit, getClientIp: () => '127.0.0.1' }))
vi.mock('@/lib/email', () => ({ sendEmailVerificationCode: mocks.sendEmailVerificationCode }))

const { POST } = await import('./route')
const { verifyEmailChallenge } = await import('@/lib/email-proof')

function req(body: unknown) {
  return new NextRequest('https://example.test/api/email-verification/send', { method: 'POST', body: JSON.stringify(body) })
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.checkRateLimit.mockResolvedValue({ allowed: true, remaining: 2 })
  mocks.sendEmailVerificationCode.mockResolvedValue({ ok: true })
})

describe('POST /api/email-verification/send', () => {
  it('mails a code that verifies against the returned challenge, without echoing the code', async () => {
    const res = await POST(req({ email: 'Ali@Example.com' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.devCode).toBeUndefined()
    const [to, code] = mocks.sendEmailVerificationCode.mock.calls[0]
    expect(to).toBe('ali@example.com')
    expect(verifyEmailChallenge(body.challenge, code)).toBe('ali@example.com')
  })

  it('400s a malformed email', async () => {
    const res = await POST(req({ email: 'nope' }))
    expect(res.status).toBe(400)
    expect(mocks.sendEmailVerificationCode).not.toHaveBeenCalled()
  })

  it('429s when the per-email send budget is spent', async () => {
    mocks.checkRateLimit
      .mockResolvedValueOnce({ allowed: true, remaining: 5 })
      .mockResolvedValueOnce({ allowed: false, remaining: 0 })
    const res = await POST(req({ email: 'ali@example.com' }))
    expect(res.status).toBe(429)
    expect(mocks.sendEmailVerificationCode).not.toHaveBeenCalled()
  })

  it('502s in production when the mail cannot be sent (never leaks the code)', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    mocks.sendEmailVerificationCode.mockResolvedValue({ ok: false })
    try {
      const res = await POST(req({ email: 'ali@example.com' }))
      expect(res.status).toBe(502)
      expect(await res.json()).not.toHaveProperty('devCode')
    } finally {
      vi.unstubAllEnvs()
    }
  })
})
