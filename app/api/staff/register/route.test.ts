import { beforeEach, describe, expect, it, vi } from 'vitest'

const insert = vi.fn()
const emailMaybeSingle = vi.fn()
const rpc = vi.fn()
const deleteAuthUserSafely = vi.fn()
const createAuthUserSafely = vi.fn()
const checkRateLimit = vi.fn()

vi.mock('@/lib/server-supabase', () => ({
  getServiceSupabase: () => ({
    from: () => ({
      insert,
      select: () => ({ eq: () => ({ maybeSingle: emailMaybeSingle }) }),
    }),
    rpc: (...args: unknown[]) => rpc(...args),
  }),
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

function request(body: Record<string, unknown>) {
  return new Request('http://localhost/api/staff/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const DEKAN_SELF = {
  role: 'dekan',
  fullName: 'Test Dekan',
  email: 'dekan@example.com',
  phone: '+998901234567',
  password: 'SecurePass123!',
  confirmPassword: 'SecurePass123!',
  staffId: '  dean-001  ',
  registerCode: 'code',
  linkKey: 'link',
  faculty: 'amit',
}

const INVITE_REG = {
  fullName: 'Yangi Tarbiyachi',
  email: 'tarbiyachi@example.com',
  password: 'SecurePass123!',
  confirmPassword: 'SecurePass123!',
  inviteCode: 'ab7c-d2e9-xq4p',
}

describe('POST /api/staff/register', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    checkRateLimit.mockResolvedValue({ allowed: true, remaining: 4 })
    createAuthUserSafely.mockResolvedValue({ data: { user: { id: 'new-id' } }, error: null })
    insert.mockResolvedValue({ error: null })
    emailMaybeSingle.mockResolvedValue({ data: null })
    rpc.mockResolvedValue({ data: [{ faculty: 'kimyo', role: 'tarbiyachi' }], error: null })
  })

  describe('dekan self-registration (env keys)', () => {
    it('persists the validated staff id so the DB unique constraint makes it single-use', async () => {
      const response = await POST(request(DEKAN_SELF))
      expect(response.status).toBe(200)
      expect(insert).toHaveBeenCalledWith(expect.objectContaining({ staff_id: 'dean-001', role: 'dekan', faculty: 'amit' }))
    })

    it('returns a conflict and rolls back Auth when the staff id was already used', async () => {
      insert.mockResolvedValue({ error: { code: '23505', message: 'duplicate key' } })
      const response = await POST(request(DEKAN_SELF))
      expect(response.status).toBe(409)
      expect(deleteAuthUserSafely).toHaveBeenCalledWith('new-id')
    })

    it('rejects a duplicate email before touching Auth', async () => {
      emailMaybeSingle.mockResolvedValue({ data: { id: 'existing' } })
      const response = await POST(request(DEKAN_SELF))
      expect(response.status).toBe(409)
      expect(createAuthUserSafely).not.toHaveBeenCalled()
    })
  })

  describe('invite-code registration', () => {
    it('binds the account to the faculty and role from the claimed invite, no staff_id', async () => {
      const response = await POST(request(INVITE_REG))
      expect(response.status).toBe(200)
      expect(rpc).toHaveBeenCalledWith('claim_staff_invite', { p_code_hash: expect.stringMatching(/^[0-9a-f]{64}$/) })
      const inserted = insert.mock.calls[0][0]
      expect(inserted).toMatchObject({ role: 'tarbiyachi', faculty: 'kimyo', status: 'active' })
      expect(inserted).not.toHaveProperty('staff_id')
    })

    it('403s an invalid or expired invite before creating any account', async () => {
      rpc.mockResolvedValue({ data: null, error: { code: 'P0001', message: 'Invalid or expired staff invite' } })
      const response = await POST(request(INVITE_REG))
      expect(response.status).toBe(403)
      expect(createAuthUserSafely).not.toHaveBeenCalled()
    })

    it('the invite code overrides any role/faculty the client also sends', async () => {
      await POST(request({ ...INVITE_REG, role: 'dekan', faculty: 'fizika' }))
      const inserted = insert.mock.calls[0][0]
      expect(inserted.role).toBe('tarbiyachi')
      expect(inserted.faculty).toBe('kimyo')
    })
  })
})
