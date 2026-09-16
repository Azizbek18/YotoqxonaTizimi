import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { ApiError } from '@/server/http/api-error'

const mocks = vi.hoisted(() => ({
  resolveAttendanceActor: vi.fn(),
  close: vi.fn(),
}))

vi.mock('@/features/attendance/server/actor', () => ({ resolveAttendanceActor: mocks.resolveAttendanceActor }))
vi.mock('@/features/attendance/server/service', () => ({
  createAttendanceService: () => ({ close: mocks.close }),
}))

const { POST } = await import('./route')

function req(body?: unknown) {
  return new NextRequest('https://example.test/api/attendance/close', {
    method: 'POST',
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.resolveAttendanceActor.mockResolvedValue({ userId: 'u1', role: 'tarbiyachi', canWrite: true })
})

describe('POST /api/attendance/close', () => {
  it('400s a missing sessionId', async () => {
    const res = await POST(req({}))
    expect(res.status).toBe(400)
    expect(mocks.resolveAttendanceActor).not.toHaveBeenCalled()
  })

  it('400s an unparsable JSON body', async () => {
    const res = await POST(new NextRequest('https://example.test/api/attendance/close', {
      method: 'POST', body: 'not json', headers: { 'content-type': 'application/json' },
    }))
    expect(res.status).toBe(400)
  })

  it('403s an actor without write scope', async () => {
    mocks.close.mockRejectedValue(new ApiError(403, 'Bu amal uchun ruxsat yo‘q', 'FORBIDDEN'))
    const res = await POST(req({ sessionId: 'sess1' }))
    expect(res.status).toBe(403)
  })

  it('500s when the service throws unexpectedly', async () => {
    mocks.close.mockRejectedValue(new Error('db down'))
    const res = await POST(req({ sessionId: 'sess1' }))
    expect(res.status).toBe(500)
  })

  it('closes the session on success', async () => {
    mocks.close.mockResolvedValue({ id: 'sess1', status: 'closed' })
    const res = await POST(req({ sessionId: 'sess1' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ id: 'sess1', status: 'closed' })
  })
})
