import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { ApiError } from '@/server/http/api-error'

const mocks = vi.hoisted(() => ({
  resolveAttendanceActor: vi.fn(),
  history: vi.fn(),
}))

vi.mock('@/features/attendance/server/actor', () => ({ resolveAttendanceActor: mocks.resolveAttendanceActor }))
vi.mock('@/features/attendance/server/service', () => ({
  createAttendanceService: () => ({ history: mocks.history }),
}))

const { GET } = await import('./route')

const VALID_STUDENT_ID = '11111111-2222-3333-4444-555555555555'

function req(url: string) {
  return new NextRequest(url)
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.resolveAttendanceActor.mockResolvedValue({ userId: 'u1', role: 'dekan', canWrite: false })
})

describe('GET /api/attendance/history', () => {
  it('400s a missing studentId', async () => {
    const res = await GET(req('https://example.test/api/attendance/history'))
    expect(res.status).toBe(400)
  })

  it('400s a malformed studentId', async () => {
    const res = await GET(req('https://example.test/api/attendance/history?studentId=not-a-uuid'))
    expect(res.status).toBe(400)
    expect(mocks.resolveAttendanceActor).not.toHaveBeenCalled()
  })

  it('401s without a session', async () => {
    mocks.resolveAttendanceActor.mockRejectedValue(new ApiError(401, 'Autentifikatsiya talab qilinadi', 'UNAUTHENTICATED'))
    const res = await GET(req(`https://example.test/api/attendance/history?studentId=${VALID_STUDENT_ID}`))
    expect(res.status).toBe(401)
  })

  it('500s when the service throws unexpectedly', async () => {
    mocks.history.mockRejectedValue(new Error('db down'))
    const res = await GET(req(`https://example.test/api/attendance/history?studentId=${VALID_STUDENT_ID}`))
    expect(res.status).toBe(500)
  })

  it('returns the student’s history on success', async () => {
    mocks.history.mockResolvedValue([{ date: '2026-09-01', state: 'present' }])
    const res = await GET(req(`https://example.test/api/attendance/history?studentId=${VALID_STUDENT_ID}`))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ history: [{ date: '2026-09-01', state: 'present' }] })
  })
})
