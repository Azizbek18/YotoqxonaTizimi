import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { ApiError } from '@/server/http/api-error'

const mocks = vi.hoisted(() => ({
  requireActiveStaff: vi.fn(),
  requireStaffPermission: vi.fn(),
  requirePickedFaculty: vi.fn(),
  checkRateLimit: vi.fn(),
  listStudents: vi.fn(),
  assignRoom: vi.fn(),
}))

vi.mock('@/server/auth/guards', () => ({
  requireActiveStaff: mocks.requireActiveStaff,
  requireStaffPermission: mocks.requireStaffPermission,
}))
vi.mock('@/server/auth/faculty', () => ({ requirePickedFaculty: mocks.requirePickedFaculty }))
vi.mock('@/lib/security', () => ({ checkRateLimit: mocks.checkRateLimit }))
vi.mock('@/features/room-assignment/server/service', () => ({
  createRoomAssignmentService: () => ({ listStudents: mocks.listStudents, assignRoom: mocks.assignRoom }),
}))

const { GET, PATCH } = await import('./route')

function req(url: string, init?: ConstructorParameters<typeof NextRequest>[1]) {
  return new NextRequest(url, init)
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.requireActiveStaff.mockResolvedValue({ staff: { id: 'staff1', full_name: 'Dekan', faculty: 'amit' } })
  mocks.requireStaffPermission.mockImplementation(() => {})
  mocks.requirePickedFaculty.mockReturnValue('amit')
  mocks.checkRateLimit.mockResolvedValue({ allowed: true })
})

describe('GET /api/dekan/students', () => {
  it('401s without a session', async () => {
    mocks.requireActiveStaff.mockRejectedValue(new ApiError(401, 'Autentifikatsiya talab qilinadi', 'UNAUTHENTICATED'))
    const res = await GET(req('https://example.test/api/dekan/students'))
    expect(res.status).toBe(401)
  })

  it('403s a role outside dekan/admin/tarbiyachi', async () => {
    mocks.requireActiveStaff.mockRejectedValue(new ApiError(403, 'Bu amal uchun ruxsat yo‘q', 'FORBIDDEN'))
    const res = await GET(req('https://example.test/api/dekan/students'))
    expect(res.status).toBe(403)
  })

  it('403s when students.view was revoked', async () => {
    mocks.requireStaffPermission.mockImplementation(() => {
      throw new ApiError(403, 'Bu bo‘lim uchun dekan ruxsat bermagan', 'PERMISSION_REVOKED')
    })
    const res = await GET(req('https://example.test/api/dekan/students'))
    expect(res.status).toBe(403)
  })

  it('500s when the service throws unexpectedly', async () => {
    mocks.listStudents.mockRejectedValue(new Error('db down'))
    const res = await GET(req('https://example.test/api/dekan/students'))
    expect(res.status).toBe(500)
  })

  it('returns the faculty-scoped student list on success', async () => {
    mocks.listStudents.mockResolvedValue([{ id: 's1' }])
    const res = await GET(req('https://example.test/api/dekan/students'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ students: [{ id: 's1' }] })
    expect(mocks.listStudents).toHaveBeenCalledWith('amit')
  })
})

describe('PATCH /api/dekan/students (room assignment)', () => {
  it('401s without a session', async () => {
    mocks.requireActiveStaff.mockRejectedValue(new ApiError(401, 'Autentifikatsiya talab qilinadi', 'UNAUTHENTICATED'))
    const res = await PATCH(req('https://example.test/api/dekan/students', { method: 'PATCH', body: '{}' }))
    expect(res.status).toBe(401)
  })

  it('403s a tarbiyachi (read-only role, cannot assign rooms)', async () => {
    mocks.requireActiveStaff.mockRejectedValue(new ApiError(403, 'Bu amal uchun ruxsat yo‘q', 'FORBIDDEN'))
    const res = await PATCH(req('https://example.test/api/dekan/students', { method: 'PATCH', body: '{}' }))
    expect(res.status).toBe(403)
  })

  it('429s when the assignment rate limit is exceeded', async () => {
    mocks.checkRateLimit.mockResolvedValue({ allowed: false })
    const res = await PATCH(req('https://example.test/api/dekan/students', { method: 'PATCH', body: '{}' }))
    expect(res.status).toBe(429)
    expect(mocks.assignRoom).not.toHaveBeenCalled()
  })

  it('400s a validation failure surfaced by the service (e.g. room already full)', async () => {
    mocks.assignRoom.mockRejectedValue(new ApiError(400, 'Xona to‘lgan', 'ROOM_FULL'))
    const res = await PATCH(req('https://example.test/api/dekan/students', {
      method: 'PATCH',
      body: JSON.stringify({ studentId: 's1', roomNumber: '101' }),
    }))
    expect(res.status).toBe(400)
  })

  it('500s when the service throws unexpectedly', async () => {
    mocks.assignRoom.mockRejectedValue(new Error('db down'))
    const res = await PATCH(req('https://example.test/api/dekan/students', {
      method: 'PATCH',
      body: JSON.stringify({ studentId: 's1', roomNumber: '101' }),
    }))
    expect(res.status).toBe(500)
  })

  it('assigns the room on success, scoped to the dekan’s faculty', async () => {
    mocks.assignRoom.mockResolvedValue({ ok: true })
    const res = await PATCH(req('https://example.test/api/dekan/students', {
      method: 'PATCH',
      body: JSON.stringify({ studentId: 's1', roomNumber: '101' }),
    }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(mocks.assignRoom).toHaveBeenCalledWith(
      'amit',
      { studentId: 's1', roomNumber: '101' },
      { id: 'staff1', fullName: 'Dekan' },
    )
  })
})
