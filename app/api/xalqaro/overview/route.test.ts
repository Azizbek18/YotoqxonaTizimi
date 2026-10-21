import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/server/http/api-error'

const requireActiveStaff = vi.fn()
const checkRateLimit = vi.fn()
const listInternationalOverview = vi.fn()

vi.mock('@/server/auth/guards', () => ({ requireActiveStaff: (...a: unknown[]) => requireActiveStaff(...a) }))
vi.mock('@/lib/security', () => ({ checkRateLimit: (...a: unknown[]) => checkRateLimit(...a) }))
vi.mock('@/features/foreign-docs/server/service', () => ({
  createForeignDocsService: () => ({ listInternationalOverview }),
}))

const route = await import('./route')

const req = () => new NextRequest('http://localhost/api/xalqaro/overview')

beforeEach(() => {
  vi.clearAllMocks()
  checkRateLimit.mockResolvedValue({ allowed: true })
  listInternationalOverview.mockResolvedValue([{ studentId: 's1' }])
})

describe('GET /api/xalqaro/overview', () => {
  it('admits only the international-office role and the superadmin', async () => {
    requireActiveStaff.mockResolvedValue({ staff: { id: 'x-1', role: 'xalqaro' } })
    const res = await route.GET(req())
    expect(res.status).toBe(200)
    expect(requireActiveStaff).toHaveBeenCalledWith(expect.anything(), ['xalqaro', 'admin'])
    expect(await res.json()).toEqual({ students: [{ studentId: 's1' }] })
  })

  it('does not touch the data when the role guard rejects (e.g. a dekan or tarbiyachi)', async () => {
    requireActiveStaff.mockRejectedValue(new ApiError(403, 'Bu amal uchun ruxsat yo‘q', 'FORBIDDEN'))
    const res = await route.GET(req())
    expect(res.status).toBe(403)
    expect(listInternationalOverview).not.toHaveBeenCalled()
  })

  it('401s an unauthenticated caller', async () => {
    requireActiveStaff.mockRejectedValue(new ApiError(401, 'Autentifikatsiya talab qilinadi', 'UNAUTHENTICATED'))
    const res = await route.GET(req())
    expect(res.status).toBe(401)
    expect(listInternationalOverview).not.toHaveBeenCalled()
  })

  it('throttles repeated requests', async () => {
    requireActiveStaff.mockResolvedValue({ staff: { id: 'x-1', role: 'xalqaro' } })
    checkRateLimit.mockResolvedValue({ allowed: false })
    const res = await route.GET(req())
    expect(res.status).toBe(429)
    expect(listInternationalOverview).not.toHaveBeenCalled()
  })

  it('is read-only: no write handlers are exported', () => {
    expect(Object.keys(route).sort()).toEqual(['GET'])
  })
})
