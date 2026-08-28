import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/server/http/api-error'

const requireActiveStaff = vi.fn()
const list = vi.fn()

vi.mock('@/server/auth/guards', () => ({ requireActiveStaff: (...args: unknown[]) => requireActiveStaff(...args) }))
vi.mock('@/features/staff-accounts/server/service', () => ({
  createStaffAccountService: () => ({ list }),
}))

// Imported after the mocks above so the route picks up the mocked modules.
const { GET } = await import('./route')

// faculty: null -> staffFacultyOrPrimary resolves to the primary building ('amit').
const ADMIN = { id: 'admin-1', full_name: 'Admin', email: 'admin@example.com', role: 'admin', status: 'active', faculty: null }
const AUTH = { user: { id: ADMIN.id }, staff: ADMIN }

function getRequest() {
  return new NextRequest('http://localhost/api/admin/staff-accounts')
}

describe('GET /api/admin/staff-accounts', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects non-admin callers before touching the service', async () => {
    requireActiveStaff.mockRejectedValue(new ApiError(403, "Bu amal uchun ruxsat yo'q", 'FORBIDDEN'))

    const response = await GET(getRequest())

    expect(response.status).toBe(403)
    expect(list).not.toHaveBeenCalled()
  })

  it('returns the staff list for an authenticated admin, scoped to the primary faculty', async () => {
    requireActiveStaff.mockResolvedValue(AUTH)
    list.mockResolvedValue([{ id: 'staff-1' }])

    const response = await GET(getRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ staff: [{ id: 'staff-1' }] })
    expect(list).toHaveBeenCalledWith('amit')
  })
})
