import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { ApiError } from '@/server/http/api-error'

const mocks = vi.hoisted(() => ({
  requireActiveStudent: vi.fn(),
  checkRateLimit: vi.fn(),
  getClientIp: vi.fn(),
  checkin: vi.fn(),
}))

vi.mock('@/server/auth/guards', () => ({ requireActiveStudent: mocks.requireActiveStudent }))
vi.mock('@/lib/security', () => ({ checkRateLimit: mocks.checkRateLimit, getClientIp: mocks.getClientIp }))
vi.mock('@/features/attendance/server/service', () => ({
  createAttendanceService: () => ({ checkin: mocks.checkin }),
}))

const { POST } = await import('./route')

function req(body?: unknown) {
  return new NextRequest('https://example.test/api/attendance/checkin', {
    method: 'POST',
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.getClientIp.mockReturnValue('127.0.0.1')
  mocks.checkRateLimit.mockResolvedValue({ allowed: true })
  mocks.requireActiveStudent.mockResolvedValue({ student: { id: 's1', faculty: 'amit' } })
})

describe('POST /api/attendance/checkin', () => {
  it('401s without a session', async () => {
    mocks.requireActiveStudent.mockRejectedValue(new ApiError(401, 'Autentifikatsiya talab qilinadi', 'UNAUTHENTICATED'))
    const res = await POST(req({ lat: 41.3, lng: 69.2 }))
    expect(res.status).toBe(401)
  })

  it('403s a blacklisted/inactive student', async () => {
    mocks.requireActiveStudent.mockRejectedValue(new ApiError(403, 'Siz yotoqxona ro‘yxatidan chiqarilgansiz.', 'BLACKLISTED'))
    const res = await POST(req({ lat: 41.3, lng: 69.2 }))
    expect(res.status).toBe(403)
  })

  it('429s when the check-in rate limit is exceeded', async () => {
    mocks.checkRateLimit.mockResolvedValue({ allowed: false })
    const res = await POST(req({ lat: 41.3, lng: 69.2 }))
    expect(res.status).toBe(429)
    expect(mocks.checkin).not.toHaveBeenCalled()
  })

  it('reports no_session for a student with no resolvable faculty (fails closed)', async () => {
    mocks.requireActiveStudent.mockResolvedValue({ student: { id: 's1', faculty: null } })
    const res = await POST(req({ lat: 41.3, lng: 69.2 }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: 'no_session' })
    expect(mocks.checkin).not.toHaveBeenCalled()
  })

  it('tolerates a malformed JSON body by treating it as empty', async () => {
    mocks.checkin.mockResolvedValue({ status: 'ok' })
    const res = await POST(new NextRequest('https://example.test/api/attendance/checkin', {
      method: 'POST',
      body: 'not json',
      headers: { 'content-type': 'application/json' },
    }))
    expect(res.status).toBe(200)
    expect(mocks.checkin).toHaveBeenCalledWith('s1', 'amit', {})
  })

  it('500s when the service throws unexpectedly', async () => {
    mocks.checkin.mockRejectedValue(new Error('db down'))
    const res = await POST(req({ lat: 41.3, lng: 69.2 }))
    expect(res.status).toBe(500)
  })

  it('checks the student in on success', async () => {
    mocks.checkin.mockResolvedValue({ status: 'checked_in' })
    const res = await POST(req({ lat: 41.3, lng: 69.2, accuracy: 15 }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: 'checked_in' })
    expect(mocks.checkin).toHaveBeenCalledWith('s1', 'amit', { lat: 41.3, lng: 69.2, accuracy: 15 })
  })
})
