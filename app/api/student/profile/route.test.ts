import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { ApiError } from '@/server/http/api-error'

const mocks = vi.hoisted(() => ({
  requireActiveStudent: vi.fn(),
  getProfile: vi.fn(),
}))

vi.mock('@/server/auth/guards', () => ({ requireActiveStudent: mocks.requireActiveStudent }))
vi.mock('@/features/profile/server/service', () => ({
  createProfileService: () => ({ getProfile: mocks.getProfile }),
}))

const { GET } = await import('./route')

function req() {
  return new NextRequest('https://example.test/api/student/profile')
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.requireActiveStudent.mockResolvedValue({ student: { id: 's1' } })
})

describe('GET /api/student/profile', () => {
  it('401s without a session', async () => {
    mocks.requireActiveStudent.mockRejectedValue(new ApiError(401, 'Autentifikatsiya talab qilinadi', 'UNAUTHENTICATED'))
    const res = await GET(req())
    expect(res.status).toBe(401)
  })

  it('is reachable for a blacklisted (expelled) student', async () => {
    mocks.getProfile.mockResolvedValue({ id: 's1', blacklisted: true })
    const res = await GET(req())
    expect(res.status).toBe(200)
    expect(mocks.requireActiveStudent).toHaveBeenCalledWith(expect.anything(), { allowBlacklisted: true })
  })

  it('500s when the service throws unexpectedly', async () => {
    mocks.getProfile.mockRejectedValue(new Error('db down'))
    const res = await GET(req())
    expect(res.status).toBe(500)
  })

  it('returns the profile on success', async () => {
    mocks.getProfile.mockResolvedValue({ id: 's1', full_name: 'Ali' })
    const res = await GET(req())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ id: 's1', full_name: 'Ali' })
  })
})
