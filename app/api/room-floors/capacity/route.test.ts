import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { ApiError } from '@/server/http/api-error'

const mocks = vi.hoisted(() => ({
  requireActiveStaff: vi.fn(),
  requirePickedFaculty: vi.fn(),
  setCapacity: vi.fn(),
  bulkSetCapacity: vi.fn(),
}))

vi.mock('@/server/auth/guards', () => ({ requireActiveStaff: mocks.requireActiveStaff }))
vi.mock('@/server/auth/faculty', () => ({ requirePickedFaculty: mocks.requirePickedFaculty }))
vi.mock('@/features/room-layout/server/service', () => ({
  createRoomLayoutService: () => ({ setCapacity: mocks.setCapacity, bulkSetCapacity: mocks.bulkSetCapacity }),
}))

const { PATCH } = await import('./route')

function req(body: unknown) {
  return new NextRequest('https://example.test/api/room-floors/capacity', {
    method: 'PATCH', body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.requireActiveStaff.mockResolvedValue({ staff: { id: 'staff1', faculty: 'amit' } })
  mocks.requirePickedFaculty.mockReturnValue('amit')
})

describe('PATCH /api/room-floors/capacity', () => {
  it('401s without a session', async () => {
    mocks.requireActiveStaff.mockRejectedValue(new ApiError(401, 'Autentifikatsiya talab qilinadi', 'UNAUTHENTICATED'))
    const res = await PATCH(req({ roomNumber: '101', capacity: 3 }))
    expect(res.status).toBe(401)
  })

  it('403s a role outside admin/dekan', async () => {
    mocks.requireActiveStaff.mockRejectedValue(new ApiError(403, 'Bu amal uchun ruxsat yo‘q', 'FORBIDDEN'))
    const res = await PATCH(req({ roomNumber: '101', capacity: 3 }))
    expect(res.status).toBe(403)
  })

  it('400s a validation failure surfaced by the service (e.g. below current occupancy)', async () => {
    mocks.setCapacity.mockRejectedValue(new ApiError(400, 'Sig‘im joriy band sonidan kam bo‘lolmaydi'))
    const res = await PATCH(req({ roomNumber: '101', capacity: 1 }))
    expect(res.status).toBe(400)
  })

  it('500s when the service throws unexpectedly', async () => {
    mocks.setCapacity.mockRejectedValue(new Error('db down'))
    const res = await PATCH(req({ roomNumber: '101', capacity: 3 }))
    expect(res.status).toBe(500)
  })

  it('sets a single room’s capacity on success', async () => {
    mocks.setCapacity.mockResolvedValue({ ok: true })
    const res = await PATCH(req({ roomNumber: '101', capacity: 3 }))
    expect(res.status).toBe(200)
    expect(mocks.setCapacity).toHaveBeenCalledWith('amit', '101', 3, undefined)
    expect(mocks.bulkSetCapacity).not.toHaveBeenCalled()
  })

  it('bulk-sets capacity across rooms when roomNumbers is an array', async () => {
    mocks.bulkSetCapacity.mockResolvedValue({ ok: true, updated: 2 })
    const res = await PATCH(req({ roomNumbers: ['101', '102'], capacity: null }))
    expect(res.status).toBe(200)
    expect(mocks.bulkSetCapacity).toHaveBeenCalledWith('amit', ['101', '102'], null, undefined)
    expect(mocks.setCapacity).not.toHaveBeenCalled()
  })
})
