import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { ApiError } from '@/server/http/api-error'

const mocks = vi.hoisted(() => ({
  resolveAttendanceActor: vi.fn(),
  flags: vi.fn(),
  promoteFlag: vi.fn(),
  dismissFlag: vi.fn(),
}))

vi.mock('@/features/attendance/server/actor', () => ({ resolveAttendanceActor: mocks.resolveAttendanceActor }))
vi.mock('@/features/attendance/server/service', () => ({
  createAttendanceService: () => ({ flags: mocks.flags, promoteFlag: mocks.promoteFlag, dismissFlag: mocks.dismissFlag }),
}))

const { GET, POST } = await import('./route')

function req(init?: ConstructorParameters<typeof NextRequest>[1]) {
  return new NextRequest('https://example.test/api/attendance/flags', init)
}

function postReq(body: unknown) {
  return req({ method: 'POST', body: JSON.stringify(body) })
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.resolveAttendanceActor.mockResolvedValue({ userId: 'u1', role: 'tarbiyachi', canWrite: true })
})

describe('GET /api/attendance/flags', () => {
  it('401s without a session', async () => {
    mocks.resolveAttendanceActor.mockRejectedValue(new ApiError(401, 'Autentifikatsiya talab qilinadi', 'UNAUTHENTICATED'))
    const res = await GET(req())
    expect(res.status).toBe(401)
  })

  it('500s when the service throws unexpectedly', async () => {
    mocks.flags.mockRejectedValue(new Error('db down'))
    const res = await GET(req())
    expect(res.status).toBe(500)
  })

  it('returns pending flags on success', async () => {
    mocks.flags.mockResolvedValue([{ id: 'f1' }])
    const res = await GET(req())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ flags: [{ id: 'f1' }] })
  })
})

describe('POST /api/attendance/flags', () => {
  it('400s a missing recordId', async () => {
    const res = await POST(postReq({ action: 'warn' }))
    expect(res.status).toBe(400)
  })

  it('400s an unrecognised action', async () => {
    const res = await POST(postReq({ recordId: 'r1', action: 'ignore' }))
    expect(res.status).toBe(400)
  })

  it('403s an actor without write scope', async () => {
    mocks.promoteFlag.mockRejectedValue(new ApiError(403, 'Bu amal uchun ruxsat yo‘q', 'FORBIDDEN'))
    const res = await POST(postReq({ recordId: 'r1', action: 'warn' }))
    expect(res.status).toBe(403)
  })

  it('500s when the service throws unexpectedly', async () => {
    mocks.dismissFlag.mockRejectedValue(new Error('db down'))
    const res = await POST(postReq({ recordId: 'r1', action: 'dismiss' }))
    expect(res.status).toBe(500)
  })

  it('promotes the flag to a warning on "warn"', async () => {
    mocks.promoteFlag.mockResolvedValue({ ok: true })
    const res = await POST(postReq({ recordId: 'r1', action: 'warn' }))
    expect(res.status).toBe(200)
    expect(mocks.promoteFlag).toHaveBeenCalledWith(expect.objectContaining({ role: 'tarbiyachi' }), 'r1')
    expect(mocks.dismissFlag).not.toHaveBeenCalled()
  })

  it('dismisses the flag on "dismiss"', async () => {
    mocks.dismissFlag.mockResolvedValue({ ok: true })
    const res = await POST(postReq({ recordId: 'r1', action: 'dismiss' }))
    expect(res.status).toBe(200)
    expect(mocks.dismissFlag).toHaveBeenCalledWith(expect.objectContaining({ role: 'tarbiyachi' }), 'r1')
    expect(mocks.promoteFlag).not.toHaveBeenCalled()
  })
})
