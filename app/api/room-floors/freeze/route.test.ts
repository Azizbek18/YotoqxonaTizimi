import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { ApiError } from '@/server/http/api-error'

const mocks = vi.hoisted(() => ({
  requireActiveStaff: vi.fn(),
  requirePickedFaculty: vi.fn(),
  setFrozen: vi.fn(),
}))

vi.mock('@/server/auth/guards', () => ({ requireActiveStaff: mocks.requireActiveStaff }))
vi.mock('@/server/auth/faculty', () => ({ requirePickedFaculty: mocks.requirePickedFaculty }))
vi.mock('@/features/room-layout/server/service', () => ({
  createRoomLayoutService: () => ({ setFrozen: mocks.setFrozen }),
}))

const { PATCH } = await import('./route')

function req(body: unknown) {
  return new NextRequest('https://example.test/api/room-floors/freeze', {
    method: 'PATCH', body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.requireActiveStaff.mockResolvedValue({ staff: { id: 'staff1', faculty: 'amit' } })
  mocks.requirePickedFaculty.mockReturnValue('amit')
})

describe('PATCH /api/room-floors/freeze', () => {
  it('401s without a session', async () => {
    mocks.requireActiveStaff.mockRejectedValue(new ApiError(401, 'Autentifikatsiya talab qilinadi', 'UNAUTHENTICATED'))
    const res = await PATCH(req({ roomNumber: '101', frozen: true }))
    expect(res.status).toBe(401)
  })

  it('403s a role outside admin/dekan', async () => {
    mocks.requireActiveStaff.mockRejectedValue(new ApiError(403, 'Bu amal uchun ruxsat yo‘q', 'FORBIDDEN'))
    const res = await PATCH(req({ roomNumber: '101', frozen: true }))
    expect(res.status).toBe(403)
  })

  it('400s a superadmin with no faculty picked', async () => {
    mocks.requirePickedFaculty.mockImplementation(() => {
      throw new ApiError(400, 'Avval fakultetni tanlang', 'SCOPE_REQUIRED')
    })
    const res = await PATCH(req({ roomNumber: '101', frozen: true }))
    expect(res.status).toBe(400)
  })

  it('500s when the service throws unexpectedly', async () => {
    mocks.setFrozen.mockRejectedValue(new Error('db down'))
    const res = await PATCH(req({ roomNumber: '101', frozen: true, reason: 'ta’mirlash' }))
    expect(res.status).toBe(500)
  })

  it('freezes the room on success', async () => {
    mocks.setFrozen.mockResolvedValue({ ok: true })
    const res = await PATCH(req({ roomNumber: '101', frozen: true, reason: 'ta’mirlash' }))
    expect(res.status).toBe(200)
    expect(mocks.setFrozen).toHaveBeenCalledWith('amit', '101', true, 'ta’mirlash', undefined)
  })
})
