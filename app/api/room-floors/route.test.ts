import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { ApiError } from '@/server/http/api-error'

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  resolveCallerFaculty: vi.fn(),
  listRoomFloors: vi.fn(),
}))

vi.mock('@/server/auth/guards', () => ({ requireUser: mocks.requireUser }))
vi.mock('@/server/auth/faculty', () => ({ resolveCallerFaculty: mocks.resolveCallerFaculty }))
vi.mock('@/features/room-layout/server/service', () => ({
  createRoomLayoutService: () => ({ listRoomFloors: mocks.listRoomFloors }),
}))

const { GET } = await import('./route')

function req(url: string) {
  return new NextRequest(url)
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.requireUser.mockResolvedValue({ id: 'u1' })
  mocks.resolveCallerFaculty.mockResolvedValue('amit')
})

describe('GET /api/room-floors', () => {
  it('401s without a session', async () => {
    mocks.requireUser.mockRejectedValue(new ApiError(401, 'Autentifikatsiya talab qilinadi', 'UNAUTHENTICATED'))
    const res = await GET(req('https://example.test/api/room-floors'))
    expect(res.status).toBe(401)
  })

  it('403s a caller with no resolvable faculty', async () => {
    mocks.resolveCallerFaculty.mockRejectedValue(new ApiError(403, 'Fakultet biriktirilmagan'))
    const res = await GET(req('https://example.test/api/room-floors'))
    expect(res.status).toBe(403)
  })

  it('500s when the service throws unexpectedly', async () => {
    mocks.listRoomFloors.mockRejectedValue(new Error('db down'))
    const res = await GET(req('https://example.test/api/room-floors'))
    expect(res.status).toBe(500)
  })

  it('returns the caller’s faculty room-floor map on success, with no explicit dormId', async () => {
    mocks.listRoomFloors.mockResolvedValue([{ floor: 1, rooms: [] }])
    const res = await GET(req('https://example.test/api/room-floors'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ rooms: [{ floor: 1, rooms: [] }] })
    expect(mocks.listRoomFloors).toHaveBeenCalledWith('amit', undefined)
  })

  it('passes an explicit dormId through when given', async () => {
    mocks.listRoomFloors.mockResolvedValue([])
    await GET(req('https://example.test/api/room-floors?dormId=d1'))
    expect(mocks.listRoomFloors).toHaveBeenCalledWith('amit', 'd1')
  })
})
