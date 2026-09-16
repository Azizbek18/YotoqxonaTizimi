import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { ApiError } from '@/server/http/api-error'

const mocks = vi.hoisted(() => ({
  resolveAttendanceActor: vi.fn(),
  activeSessions: vi.fn(),
  openAdhoc: vi.fn(),
}))

vi.mock('@/features/attendance/server/actor', () => ({ resolveAttendanceActor: mocks.resolveAttendanceActor }))
vi.mock('@/features/attendance/server/service', () => ({
  createAttendanceService: () => ({ activeSessions: mocks.activeSessions, openAdhoc: mocks.openAdhoc }),
}))

const { GET, POST } = await import('./route')

function req(init?: ConstructorParameters<typeof NextRequest>[1]) {
  return new NextRequest('https://example.test/api/attendance/session', init)
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.resolveAttendanceActor.mockResolvedValue({ userId: 'u1', role: 'tarbiyachi', canWrite: true })
})

describe('GET /api/attendance/session', () => {
  it('401s without a session', async () => {
    mocks.resolveAttendanceActor.mockRejectedValue(new ApiError(401, 'Autentifikatsiya talab qilinadi', 'UNAUTHENTICATED'))
    const res = await GET(req())
    expect(res.status).toBe(401)
  })

  it('500s when the service throws unexpectedly', async () => {
    mocks.activeSessions.mockRejectedValue(new Error('db down'))
    const res = await GET(req())
    expect(res.status).toBe(500)
  })

  it('returns the actor’s active sessions on success', async () => {
    mocks.activeSessions.mockResolvedValue([{ id: 's1' }])
    const res = await GET(req())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ sessions: [{ id: 's1' }] })
  })
})

describe('POST /api/attendance/session (adhoc open)', () => {
  it('403s an actor without write scope', async () => {
    mocks.openAdhoc.mockRejectedValue(new ApiError(403, 'Bu amal uchun ruxsat yo‘q', 'FORBIDDEN'))
    const res = await POST(req({ method: 'POST' }))
    expect(res.status).toBe(403)
  })

  it('500s when the service throws unexpectedly', async () => {
    mocks.openAdhoc.mockRejectedValue(new Error('db down'))
    const res = await POST(req({ method: 'POST' }))
    expect(res.status).toBe(500)
  })

  it('opens an adhoc session on success', async () => {
    mocks.openAdhoc.mockResolvedValue({ id: 's-new' })
    const res = await POST(req({ method: 'POST' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ id: 's-new' })
  })
})
