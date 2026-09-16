import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { ApiError } from '@/server/http/api-error'

const mocks = vi.hoisted(() => ({
  requireActiveStaff: vi.fn(),
  requireStaffPermission: vi.fn(),
  staffDormFaculties: vi.fn(),
  getSummary: vi.fn(),
  listAll: vi.fn(),
  review: vi.fn(),
}))

vi.mock('@/server/auth/guards', () => ({
  requireActiveStaff: mocks.requireActiveStaff,
  requireStaffPermission: mocks.requireStaffPermission,
}))
vi.mock('@/server/auth/faculty', () => ({ staffDormFaculties: mocks.staffDormFaculties }))
vi.mock('@/features/payments/server/service', () => ({
  createPaymentService: () => ({ getSummary: mocks.getSummary, listAll: mocks.listAll, review: mocks.review }),
}))

const { GET, PATCH } = await import('./route')

function req(url: string, init?: ConstructorParameters<typeof NextRequest>[1]) {
  return new NextRequest(url, init)
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.requireActiveStaff.mockResolvedValue({ staff: { id: 'staff1', faculty: 'amit' } })
  mocks.requireStaffPermission.mockImplementation(() => {})
  mocks.staffDormFaculties.mockResolvedValue(['amit'])
})

describe('GET /api/tarbiyachi/payments', () => {
  it('401s without a session', async () => {
    mocks.requireActiveStaff.mockRejectedValue(new ApiError(401, 'Autentifikatsiya talab qilinadi', 'UNAUTHENTICATED'))
    const res = await GET(req('https://example.test/api/tarbiyachi/payments'))
    expect(res.status).toBe(401)
  })

  it('403s a role other than tarbiyachi', async () => {
    mocks.requireActiveStaff.mockRejectedValue(new ApiError(403, 'Bu amal uchun ruxsat yo‘q', 'FORBIDDEN'))
    const res = await GET(req('https://example.test/api/tarbiyachi/payments'))
    expect(res.status).toBe(403)
  })

  it('403s when the payments.review permission is revoked', async () => {
    mocks.requireStaffPermission.mockImplementation(() => {
      throw new ApiError(403, 'Bu bo‘lim uchun dekan ruxsat bermagan', 'PERMISSION_REVOKED')
    })
    const res = await GET(req('https://example.test/api/tarbiyachi/payments'))
    expect(res.status).toBe(403)
  })

  it('400s an invalid studentId filter', async () => {
    const res = await GET(req('https://example.test/api/tarbiyachi/payments?studentId=not-a-uuid'))
    expect(res.status).toBe(400)
  })

  it('500s when the service throws unexpectedly', async () => {
    mocks.listAll.mockRejectedValue(new Error('db down'))
    const res = await GET(req('https://example.test/api/tarbiyachi/payments'))
    expect(res.status).toBe(500)
  })

  it('returns the summary count when ?summary=1', async () => {
    mocks.getSummary.mockResolvedValue({ waitingCount: 3 })
    const res = await GET(req('https://example.test/api/tarbiyachi/payments?summary=1'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ waitingCount: 3 })
    expect(mocks.getSummary).toHaveBeenCalledWith(['amit'])
  })

  it('returns the payment list scoped to the dorm faculties', async () => {
    mocks.listAll.mockResolvedValue([{ id: 'p1' }])
    const res = await GET(req('https://example.test/api/tarbiyachi/payments'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ payments: [{ id: 'p1' }] })
    expect(mocks.listAll).toHaveBeenCalledWith(['amit'], undefined)
  })
})

describe('PATCH /api/tarbiyachi/payments', () => {
  it('401s without a session', async () => {
    mocks.requireActiveStaff.mockRejectedValue(new ApiError(401, 'Autentifikatsiya talab qilinadi', 'UNAUTHENTICATED'))
    const res = await PATCH(req('https://example.test/api/tarbiyachi/payments', { method: 'PATCH' }))
    expect(res.status).toBe(401)
  })

  it('403s when the payments.review permission is revoked', async () => {
    mocks.requireStaffPermission.mockImplementation(() => {
      throw new ApiError(403, 'Bu bo‘lim uchun dekan ruxsat bermagan', 'PERMISSION_REVOKED')
    })
    const res = await PATCH(req('https://example.test/api/tarbiyachi/payments', { method: 'PATCH' }))
    expect(res.status).toBe(403)
  })

  it('400s an unparsable JSON body', async () => {
    const res = await PATCH(req('https://example.test/api/tarbiyachi/payments', {
      method: 'PATCH',
      body: 'not json',
      headers: { 'content-type': 'application/json' },
    }))
    expect(res.status).toBe(400)
  })

  it('400s a validation failure surfaced by the service', async () => {
    mocks.review.mockRejectedValue(new ApiError(400, 'ids talab qilinadi', 'INVALID_IDS'))
    const res = await PATCH(req('https://example.test/api/tarbiyachi/payments', {
      method: 'PATCH',
      body: JSON.stringify({ ids: [], status: 'approved' }),
    }))
    expect(res.status).toBe(400)
  })

  it('500s when the service throws unexpectedly', async () => {
    mocks.review.mockRejectedValue(new Error('db down'))
    const res = await PATCH(req('https://example.test/api/tarbiyachi/payments', {
      method: 'PATCH',
      body: JSON.stringify({ ids: ['p1'], status: 'approved' }),
    }))
    expect(res.status).toBe(500)
  })

  it('reviews the payment on success', async () => {
    mocks.review.mockResolvedValue({ ok: true, updated: 1 })
    const res = await PATCH(req('https://example.test/api/tarbiyachi/payments', {
      method: 'PATCH',
      body: JSON.stringify({ ids: ['p1'], status: 'approved' }),
    }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, updated: 1 })
    expect(mocks.review).toHaveBeenCalledWith(['amit'], { ids: ['p1'], status: 'approved' })
  })
})
