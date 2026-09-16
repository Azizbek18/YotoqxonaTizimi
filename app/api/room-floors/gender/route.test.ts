import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { ApiError } from '@/server/http/api-error'

const mocks = vi.hoisted(() => ({
  requireActiveStaff: vi.fn(),
  requirePickedFaculty: vi.fn(),
  setGender: vi.fn(),
  bulkSetGender: vi.fn(),
}))

vi.mock('@/server/auth/guards', () => ({ requireActiveStaff: mocks.requireActiveStaff }))
vi.mock('@/server/auth/faculty', () => ({ requirePickedFaculty: mocks.requirePickedFaculty }))
vi.mock('@/features/room-layout/server/service', () => ({
  createRoomLayoutService: () => ({ setGender: mocks.setGender, bulkSetGender: mocks.bulkSetGender }),
}))

const { PATCH } = await import('./route')

function req(body: unknown) {
  return new NextRequest('https://example.test/api/room-floors/gender', {
    method: 'PATCH', body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.requireActiveStaff.mockResolvedValue({ staff: { id: 'staff1', faculty: 'amit' } })
  mocks.requirePickedFaculty.mockReturnValue('amit')
})

describe('PATCH /api/room-floors/gender', () => {
  it('401s without a session', async () => {
    mocks.requireActiveStaff.mockRejectedValue(new ApiError(401, 'Autentifikatsiya talab qilinadi', 'UNAUTHENTICATED'))
    const res = await PATCH(req({ roomNumber: '101', gender: 'male' }))
    expect(res.status).toBe(401)
  })

  it('403s a role outside admin/dekan', async () => {
    mocks.requireActiveStaff.mockRejectedValue(new ApiError(403, 'Bu amal uchun ruxsat yo‘q', 'FORBIDDEN'))
    const res = await PATCH(req({ roomNumber: '101', gender: 'male' }))
    expect(res.status).toBe(403)
  })

  it('400s a validation failure surfaced by the service', async () => {
    mocks.setGender.mockRejectedValue(new ApiError(400, 'Bandlangan xonaning jinsini o‘zgartirib bo‘lmaydi'))
    const res = await PATCH(req({ roomNumber: '101', gender: 'female' }))
    expect(res.status).toBe(400)
  })

  it('500s when the service throws unexpectedly', async () => {
    mocks.setGender.mockRejectedValue(new Error('db down'))
    const res = await PATCH(req({ roomNumber: '101', gender: 'male' }))
    expect(res.status).toBe(500)
  })

  it('sets a single room’s gender on success', async () => {
    mocks.setGender.mockResolvedValue({ ok: true })
    const res = await PATCH(req({ roomNumber: '101', gender: 'male' }))
    expect(res.status).toBe(200)
    expect(mocks.setGender).toHaveBeenCalledWith('amit', '101', 'male', undefined)
    expect(mocks.bulkSetGender).not.toHaveBeenCalled()
  })

  it('bulk-sets gender across rooms when roomNumbers is an array', async () => {
    mocks.bulkSetGender.mockResolvedValue({ ok: true, updated: 3 })
    const res = await PATCH(req({ roomNumbers: ['101', '102', '103'], gender: null }))
    expect(res.status).toBe(200)
    expect(mocks.bulkSetGender).toHaveBeenCalledWith('amit', ['101', '102', '103'], null, undefined)
    expect(mocks.setGender).not.toHaveBeenCalled()
  })
})
