import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { ApiError } from '@/server/http/api-error'

const mocks = vi.hoisted(() => ({
  requireActiveStaff: vi.fn(),
  requirePickedFaculty: vi.fn(),
  generateFloors: vi.fn(),
}))

vi.mock('@/server/auth/guards', () => ({ requireActiveStaff: mocks.requireActiveStaff }))
vi.mock('@/server/auth/faculty', () => ({ requirePickedFaculty: mocks.requirePickedFaculty }))
vi.mock('@/features/room-layout/server/service', () => ({
  createRoomLayoutService: () => ({ generateFloors: mocks.generateFloors }),
}))

const { POST } = await import('./route')

function req(body: unknown) {
  return new NextRequest('https://example.test/api/room-floors/generate', {
    method: 'POST', body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.requireActiveStaff.mockResolvedValue({ staff: { id: 'staff1', faculty: 'amit' } })
  mocks.requirePickedFaculty.mockReturnValue('amit')
})

describe('POST /api/room-floors/generate', () => {
  it('401s without a session', async () => {
    mocks.requireActiveStaff.mockRejectedValue(new ApiError(401, 'Autentifikatsiya talab qilinadi', 'UNAUTHENTICATED'))
    const res = await POST(req({ floors: [] }))
    expect(res.status).toBe(401)
  })

  it('403s a role outside admin/dekan', async () => {
    mocks.requireActiveStaff.mockRejectedValue(new ApiError(403, 'Bu amal uchun ruxsat yo‘q', 'FORBIDDEN'))
    const res = await POST(req({ floors: [] }))
    expect(res.status).toBe(403)
  })

  it('400s a superadmin with no faculty picked', async () => {
    mocks.requirePickedFaculty.mockImplementation(() => {
      throw new ApiError(400, 'Avval fakultetni tanlang', 'SCOPE_REQUIRED')
    })
    const res = await POST(req({ floors: [] }))
    expect(res.status).toBe(400)
  })

  it('400s a validation failure surfaced by the service', async () => {
    mocks.generateFloors.mockRejectedValue(new ApiError(400, 'Qavat soni noto‘g‘ri'))
    const res = await POST(req({ floors: [10, 10] }))
    expect(res.status).toBe(400)
  })

  it('500s when the service throws unexpectedly', async () => {
    mocks.generateFloors.mockRejectedValue(new Error('db down'))
    const res = await POST(req({ floors: [10, 10] }))
    expect(res.status).toBe(500)
  })

  it('generates the floor layout on success', async () => {
    mocks.generateFloors.mockResolvedValue({ created: 20 })
    const res = await POST(req({ floors: [10, 10], numbering: 'sequential', dormId: 'd1' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ created: 20 })
    expect(mocks.generateFloors).toHaveBeenCalledWith('amit', [10, 10], 'sequential', 'd1')
  })
})
