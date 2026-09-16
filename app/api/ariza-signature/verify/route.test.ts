import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { ApiError } from '@/server/http/api-error'

const mocks = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  getClientIp: vi.fn(),
  verifyByCode: vi.fn(),
}))

vi.mock('@/lib/security', () => ({ checkRateLimit: mocks.checkRateLimit, getClientIp: mocks.getClientIp }))
vi.mock('@/features/applications/server/service', () => ({
  createApplicationService: () => ({ verifyByCode: mocks.verifyByCode }),
}))

const { GET } = await import('./route')

function req(url: string) {
  return new NextRequest(url)
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.getClientIp.mockReturnValue('127.0.0.1')
  mocks.checkRateLimit.mockResolvedValue({ allowed: true })
})

describe('GET /api/ariza-signature/verify', () => {
  it('429s when the verify rate limit is exceeded', async () => {
    mocks.checkRateLimit.mockResolvedValue({ allowed: false })
    const res = await GET(req('https://example.test/api/ariza-signature/verify?code=ABC123'))
    expect(res.status).toBe(429)
    expect(mocks.verifyByCode).not.toHaveBeenCalled()
  })

  it('400s an unknown/malformed code (service enforces it)', async () => {
    mocks.verifyByCode.mockRejectedValue(new ApiError(400, 'Kod topilmadi'))
    const res = await GET(req('https://example.test/api/ariza-signature/verify?code=bad'))
    expect(res.status).toBe(400)
  })

  it('500s when the service throws unexpectedly', async () => {
    mocks.verifyByCode.mockRejectedValue(new Error('db down'))
    const res = await GET(req('https://example.test/api/ariza-signature/verify?code=ABC123'))
    expect(res.status).toBe(500)
  })

  it('returns the signer/document info on success', async () => {
    mocks.verifyByCode.mockResolvedValue({ signerName: 'Aliyev Ali', documentTitle: 'Ariza', signedAt: '2026-01-01' })
    const res = await GET(req('https://example.test/api/ariza-signature/verify?code=ABC123'))
    expect(res.status).toBe(200)
    expect(mocks.verifyByCode).toHaveBeenCalledWith('ABC123')
  })

  it('passes a null code through when missing (service decides how to respond)', async () => {
    mocks.verifyByCode.mockRejectedValue(new ApiError(400, 'Kod kerak'))
    const res = await GET(req('https://example.test/api/ariza-signature/verify'))
    expect(res.status).toBe(400)
    expect(mocks.verifyByCode).toHaveBeenCalledWith(null)
  })
})
