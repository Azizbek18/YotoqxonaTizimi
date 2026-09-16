import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { ApiError } from '@/server/http/api-error'

const mocks = vi.hoisted(() => ({
  requireActiveStaff: vi.fn(),
  requireStaffPermission: vi.fn(),
  requirePickedFaculty: vi.fn(),
  listPayments: vi.fn(),
}))

vi.mock('@/server/auth/guards', () => ({
  requireActiveStaff: mocks.requireActiveStaff,
  requireStaffPermission: mocks.requireStaffPermission,
}))
vi.mock('@/server/auth/faculty', () => ({ requirePickedFaculty: mocks.requirePickedFaculty }))
vi.mock('@/features/faculty-students/server/service', () => ({
  createFacultyStudentsService: () => ({ listPayments: mocks.listPayments }),
}))

const { GET } = await import('./route')

function req() {
  return new NextRequest('https://example.test/api/dekan/students/payments')
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.requireActiveStaff.mockResolvedValue({ staff: { id: 'staff1', faculty: 'amit' } })
  mocks.requireStaffPermission.mockImplementation(() => {})
  mocks.requirePickedFaculty.mockReturnValue('amit')
})

describe('GET /api/dekan/students/payments', () => {
  it('401s without a session', async () => {
    mocks.requireActiveStaff.mockRejectedValue(new ApiError(401, 'Autentifikatsiya talab qilinadi', 'UNAUTHENTICATED'))
    const res = await GET(req())
    expect(res.status).toBe(401)
  })

  it('403s a role outside dekan/admin/tarbiyachi', async () => {
    mocks.requireActiveStaff.mockRejectedValue(new ApiError(403, 'Bu amal uchun ruxsat yo‘q', 'FORBIDDEN'))
    const res = await GET(req())
    expect(res.status).toBe(403)
  })

  it('403s when the payments.review permission is revoked', async () => {
    mocks.requireStaffPermission.mockImplementation(() => {
      throw new ApiError(403, 'Bu bo‘lim uchun dekan ruxsat bermagan', 'PERMISSION_REVOKED')
    })
    const res = await GET(req())
    expect(res.status).toBe(403)
  })

  it('400s a superadmin acting globally with no faculty picked', async () => {
    mocks.requirePickedFaculty.mockImplementation(() => {
      throw new ApiError(400, 'Avval fakultetni tanlang', 'SCOPE_REQUIRED')
    })
    const res = await GET(req())
    expect(res.status).toBe(400)
  })

  it('500s when the service throws unexpectedly', async () => {
    mocks.listPayments.mockRejectedValue(new Error('db down'))
    const res = await GET(req())
    expect(res.status).toBe(500)
  })

  it('returns the faculty-scoped payment list on success', async () => {
    mocks.listPayments.mockResolvedValue([{ id: 'p1' }])
    const res = await GET(req())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ payments: [{ id: 'p1' }] })
    expect(mocks.listPayments).toHaveBeenCalledWith('amit')
  })
})
