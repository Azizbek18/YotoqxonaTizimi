import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/server/http/api-error'

const requireActiveStaff = vi.fn()
const checkRateLimit = vi.fn()
const list = vi.fn()
const create = vi.fn()

vi.mock('@/server/auth/guards', () => ({ requireActiveStaff: (...args: unknown[]) => requireActiveStaff(...args) }))
vi.mock('@/lib/security', () => ({ checkRateLimit: (...args: unknown[]) => checkRateLimit(...args) }))
vi.mock('@/features/staff-accounts/server/service', () => ({
  createStaffAccountService: () => ({ list, create }),
}))

// Imported after the mocks above so the route picks up the mocked modules.
const { GET, POST } = await import('./route')

// faculty: null -> staffFacultyOrPrimary resolves to the primary building ('amit').
const ADMIN = { id: 'admin-1', full_name: 'Admin', email: 'admin@example.com', role: 'admin', status: 'active', faculty: null }
const AUTH = { user: { id: ADMIN.id }, staff: ADMIN }

function postRequest(body: unknown) {
  return new NextRequest('http://localhost/api/admin/staff-accounts', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

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

  it('returns the staff list for an authenticated admin', async () => {
    requireActiveStaff.mockResolvedValue(AUTH)
    list.mockResolvedValue([{ id: 'staff-1' }])

    const response = await GET(getRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ staff: [{ id: 'staff-1' }] })
    expect(list).toHaveBeenCalledWith('amit')
  })
})

describe('POST /api/admin/staff-accounts', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects non-admin callers before checking the rate limit or creating an account', async () => {
    requireActiveStaff.mockRejectedValue(new ApiError(401, 'Autentifikatsiya talab qilinadi', 'UNAUTHENTICATED'))

    const response = await POST(postRequest({ role: 'tarbiyachi' }))

    expect(response.status).toBe(401)
    expect(checkRateLimit).not.toHaveBeenCalled()
    expect(create).not.toHaveBeenCalled()
  })

  it('throttles repeated attempts from the same admin without creating an account', async () => {
    requireActiveStaff.mockResolvedValue(AUTH)
    checkRateLimit.mockResolvedValue({ allowed: false, remaining: 0 })

    const response = await POST(postRequest({ role: 'tarbiyachi' }))
    const body = await response.json()

    expect(response.status).toBe(429)
    expect(body.error).toBeTruthy()
    expect(create).not.toHaveBeenCalled()
    expect(checkRateLimit).toHaveBeenCalledWith(`admin-staff-create:${ADMIN.id}`, 10, 60_000)
  })

  it('creates the account for an authorized, unthrottled admin', async () => {
    requireActiveStaff.mockResolvedValue(AUTH)
    checkRateLimit.mockResolvedValue({ allowed: true, remaining: 9 })
    create.mockResolvedValue({ success: true })

    const payload = { role: 'tarbiyachi', assignedFloor: 2 }
    const response = await POST(postRequest(payload))
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(body).toEqual({ success: true })
    expect(create).toHaveBeenCalledWith(ADMIN.id, 'amit', payload)
  })

  it('surfaces a service-level ApiError with its own status code', async () => {
    requireActiveStaff.mockResolvedValue(AUTH)
    checkRateLimit.mockResolvedValue({ allowed: true, remaining: 9 })
    create.mockRejectedValue(new ApiError(409, "Bu email allaqachon ro'yxatdan o'tgan"))

    const response = await POST(postRequest({ role: 'tarbiyachi' }))

    expect(response.status).toBe(409)
  })
})
