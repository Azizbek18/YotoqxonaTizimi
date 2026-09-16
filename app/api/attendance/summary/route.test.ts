import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { ApiError } from '@/server/http/api-error'

const mocks = vi.hoisted(() => ({
  resolveAttendanceActor: vi.fn(),
  summary: vi.fn(),
}))

vi.mock('@/features/attendance/server/actor', () => ({ resolveAttendanceActor: mocks.resolveAttendanceActor }))
vi.mock('@/features/attendance/server/service', () => ({
  createAttendanceService: () => ({ summary: mocks.summary }),
}))

const { GET } = await import('./route')

function req() {
  return new NextRequest('https://example.test/api/attendance/summary')
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.resolveAttendanceActor.mockResolvedValue({ userId: 'u1', role: 'talaba', canWrite: false })
})

describe('GET /api/attendance/summary', () => {
  it('401s without a session', async () => {
    mocks.resolveAttendanceActor.mockRejectedValue(new ApiError(401, 'Autentifikatsiya talab qilinadi', 'UNAUTHENTICATED'))
    const res = await GET(req())
    expect(res.status).toBe(401)
  })

  it('500s when the service throws unexpectedly', async () => {
    mocks.summary.mockRejectedValue(new Error('db down'))
    const res = await GET(req())
    expect(res.status).toBe(500)
  })

  it('returns the actor’s attendance summary on success', async () => {
    mocks.summary.mockResolvedValue({ status: 'checked_in' })
    const res = await GET(req())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: 'checked_in' })
  })
})
