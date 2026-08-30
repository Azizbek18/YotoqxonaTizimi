import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/server/http/api-error'

const requireAdmin = vi.fn()
const getOverview = vi.fn()

vi.mock('@/server/auth/guards', () => ({
  requireAdmin: (...args: unknown[]) => requireAdmin(...args),
}))
vi.mock('@/features/superadmin-dekans/server/service', () => ({
  createSuperadminDekanService: () => ({ getOverview }),
}))

const { GET } = await import('./route')

function request() {
  return new NextRequest('http://localhost/api/admin/dekans')
}

describe('GET /api/admin/dekans', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects a non-superadmin before reading global data', async () => {
    requireAdmin.mockRejectedValue(new ApiError(403, "Bu amal uchun ruxsat yo'q", 'FORBIDDEN'))

    const response = await GET(request())

    expect(response.status).toBe(403)
    expect(getOverview).not.toHaveBeenCalled()
  })

  it('returns the global overview for an active admin regardless of faculty', async () => {
    requireAdmin.mockResolvedValue({
      user: { id: 'superadmin-1' },
      staff: { id: 'superadmin-1', role: 'admin', status: 'active', faculty: 'amit' },
    })
    const payload = { summary: { activeDekans: 3 }, faculties: [], unassignedDekans: [] }
    getOverview.mockResolvedValue(payload)

    const response = await GET(request())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual(payload)
    expect(requireAdmin).toHaveBeenCalledOnce()
    expect(getOverview).toHaveBeenCalledOnce()
  })
})
