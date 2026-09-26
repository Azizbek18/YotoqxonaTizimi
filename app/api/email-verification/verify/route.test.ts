import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'test-secret-key-for-email-proof'

const mocks = vi.hoisted(() => ({ checkRateLimit: vi.fn() }))
vi.mock('@/lib/security', () => ({ checkRateLimit: mocks.checkRateLimit, getClientIp: () => '127.0.0.1' }))

const { POST } = await import('./route')
const { hasEmailProof, issueEmailChallenge } = await import('@/lib/email-proof')

function req(body: unknown) {
  return new NextRequest('https://example.test/api/email-verification/verify', { method: 'POST', body: JSON.stringify(body) })
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.checkRateLimit.mockResolvedValue({ allowed: true, remaining: 4 })
})

describe('POST /api/email-verification/verify', () => {
  it('exchanges a correct code for a proof of that email', async () => {
    const { code, challenge } = issueEmailChallenge('ali@example.com')
    const res = await POST(req({ challenge, code }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.email).toBe('ali@example.com')
    expect(hasEmailProof(body.proof, 'ali@example.com')).toBe(true)
  })

  it('400s a wrong code', async () => {
    const { code, challenge } = issueEmailChallenge('ali@example.com')
    const wrong = String((Number(code) + 1) % 1_000_000).padStart(6, '0')
    const res = await POST(req({ challenge, code: wrong }))
    expect(res.status).toBe(400)
  })

  it('429s once the challenge has used its guesses — even with the right code', async () => {
    mocks.checkRateLimit.mockResolvedValueOnce({ allowed: false, remaining: 0 })
    const { code, challenge } = issueEmailChallenge('ali@example.com')
    const res = await POST(req({ challenge, code }))
    expect(res.status).toBe(429)
  })

  it('400s garbage', async () => {
    const res = await POST(req({ challenge: 'x', code: '123456' }))
    expect(res.status).toBe(400)
  })
})
