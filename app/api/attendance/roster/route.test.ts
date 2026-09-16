import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { ApiError } from '@/server/http/api-error'

const mocks = vi.hoisted(() => ({
  resolveAttendanceActor: vi.fn(),
  roster: vi.fn(),
}))

vi.mock('@/features/attendance/server/actor', () => ({ resolveAttendanceActor: mocks.resolveAttendanceActor }))
vi.mock('@/features/attendance/server/service', () => ({
  createAttendanceService: () => ({ roster: mocks.roster }),
}))

const { GET } = await import('./route')

function req(url: string) {
  return new NextRequest(url)
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.resolveAttendanceActor.mockResolvedValue({ userId: 'u1', role: 'sardor', canWrite: true })
})

describe('GET /api/attendance/roster', () => {
  it('400s a missing sessionId', async () => {
    const res = await GET(req('https://example.test/api/attendance/roster'))
    expect(res.status).toBe(400)
    expect(mocks.resolveAttendanceActor).not.toHaveBeenCalled()
  })

  it('401s without a session', async () => {
    mocks.resolveAttendanceActor.mockRejectedValue(new ApiError(401, 'Autentifikatsiya talab qilinadi', 'UNAUTHENTICATED'))
    const res = await GET(req('https://example.test/api/attendance/roster?sessionId=sess1'))
    expect(res.status).toBe(401)
  })

  it('500s when the service throws unexpectedly', async () => {
    mocks.roster.mockRejectedValue(new Error('db down'))
    const res = await GET(req('https://example.test/api/attendance/roster?sessionId=sess1'))
    expect(res.status).toBe(500)
  })

  it('returns the roster view on success', async () => {
    mocks.roster.mockResolvedValue({ residents: [], records: [] })
    const res = await GET(req('https://example.test/api/attendance/roster?sessionId=sess1'))
    expect(res.status).toBe(200)
    expect(mocks.roster).toHaveBeenCalledWith(expect.objectContaining({ role: 'sardor' }), 'sess1')
  })
})
