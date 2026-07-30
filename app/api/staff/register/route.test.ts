import { beforeEach, describe, expect, it, vi } from 'vitest'

const insert = vi.fn()
const deleteAuthUserSafely = vi.fn()
const createAuthUserSafely = vi.fn()
const checkRateLimit = vi.fn()

vi.mock('@/lib/server-supabase', () => ({
  getServiceSupabase: () => ({ from: () => ({ insert }) }),
}))
vi.mock('@/lib/supabase-admin-auth', () => ({
  createAuthUserSafely: (...args: unknown[]) => createAuthUserSafely(...args),
  deleteAuthUserSafely: (...args: unknown[]) => deleteAuthUserSafely(...args),
}))
vi.mock('@/lib/staff-access', () => ({
  validateRegisterCode: () => true,
  validateStaffId: () => true,
  validateStaffLink: () => true,
}))
vi.mock('@/lib/security', () => ({
  checkRateLimit: (...args: unknown[]) => checkRateLimit(...args),
  getClientIp: () => '127.0.0.1',
}))

const { POST } = await import('./route')

function registrationRequest() {
  return new Request('http://localhost/api/staff/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      role: 'zamdekan',
      fullName: 'Test Zamdekan',
      email: 'zamdekan@example.com',
      phone: '+998901234567',
      password: 'SecurePass123!',
      confirmPassword: 'SecurePass123!',
      staffId: '  dean-001  ',
      registerCode: 'code',
      linkKey: 'link',
      faculty: 'amit',
    }),
  })
}

describe('POST /api/staff/register', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    checkRateLimit.mockResolvedValue({ allowed: true, remaining: 4 })
    createAuthUserSafely.mockResolvedValue({ data: { user: { id: 'new-id' } }, error: null })
    insert.mockResolvedValue({ error: null })
  })

  it('persists the validated staff id so the database unique constraint makes it single-use', async () => {
    const response = await POST(registrationRequest())

    expect(response.status).toBe(200)
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ staff_id: 'dean-001' }))
  })

  it('returns a conflict and rolls back Auth when the staff id was already used', async () => {
    insert.mockResolvedValue({ error: { code: '23505', message: 'duplicate key' } })

    const response = await POST(registrationRequest())

    expect(response.status).toBe(409)
    expect(deleteAuthUserSafely).toHaveBeenCalledWith('new-id')
  })
})
