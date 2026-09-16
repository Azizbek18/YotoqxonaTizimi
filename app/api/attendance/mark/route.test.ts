import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { ApiError } from '@/server/http/api-error'

const mocks = vi.hoisted(() => ({
  resolveAttendanceActor: vi.fn(),
  mark: vi.fn(),
}))

vi.mock('@/features/attendance/server/actor', () => ({ resolveAttendanceActor: mocks.resolveAttendanceActor }))
vi.mock('@/features/attendance/server/service', () => ({
  createAttendanceService: () => ({ mark: mocks.mark }),
}))

const { PATCH } = await import('./route')

function req(body?: unknown) {
  return new NextRequest('https://example.test/api/attendance/mark', {
    method: 'PATCH',
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.resolveAttendanceActor.mockResolvedValue({ userId: 'u1', role: 'sardor', canWrite: true })
})

describe('PATCH /api/attendance/mark', () => {
  it('400s a body missing required fields', async () => {
    const res = await PATCH(req({ sessionId: 'sess1' }))
    expect(res.status).toBe(400)
    expect(mocks.mark).not.toHaveBeenCalled()
  })

  it('400s an unrecognised state value', async () => {
    const res = await PATCH(req({ sessionId: 'sess1', studentId: 'stu1', state: 'late' }))
    expect(res.status).toBe(400)
  })

  it('400s an unparsable JSON body', async () => {
    const res = await PATCH(new NextRequest('https://example.test/api/attendance/mark', {
      method: 'PATCH',
      body: 'not json',
      headers: { 'content-type': 'application/json' },
    }))
    expect(res.status).toBe(400)
  })

  it('401s without a session', async () => {
    mocks.resolveAttendanceActor.mockRejectedValue(new ApiError(401, 'Autentifikatsiya talab qilinadi', 'UNAUTHENTICATED'))
    const res = await PATCH(req({ sessionId: 'sess1', studentId: 'stu1', state: 'present' }))
    expect(res.status).toBe(401)
  })

  it('403s an actor without write scope (service enforces it)', async () => {
    mocks.mark.mockRejectedValue(new ApiError(403, 'Bu amal uchun ruxsat yo‘q', 'FORBIDDEN'))
    const res = await PATCH(req({ sessionId: 'sess1', studentId: 'stu1', state: 'present' }))
    expect(res.status).toBe(403)
  })

  it('500s when the service throws unexpectedly', async () => {
    mocks.mark.mockRejectedValue(new Error('db down'))
    const res = await PATCH(req({ sessionId: 'sess1', studentId: 'stu1', state: 'present' }))
    expect(res.status).toBe(500)
  })

  it('marks the student on success', async () => {
    mocks.mark.mockResolvedValue({ id: 'rec1', state: 'present' })
    const res = await PATCH(req({ sessionId: 'sess1', studentId: 'stu1', state: 'present' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ record: { id: 'rec1', state: 'present' } })
  })
})
