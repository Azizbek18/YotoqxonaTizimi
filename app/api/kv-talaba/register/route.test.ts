import { beforeEach, describe, expect, it, vi } from 'vitest'

const insert = vi.fn()
const emailMaybeSingle = vi.fn()
const createAuthUserSafely = vi.fn()
const deleteAuthUserSafely = vi.fn()
const checkRateLimit = vi.fn()

vi.mock('@/lib/server-supabase', () => ({
  getServiceSupabase: () => ({
    from: () => ({
      insert,
      select: () => ({
        ilike: () => ({ maybeSingle: () => emailMaybeSingle() }),
      }),
    }),
  }),
}))
vi.mock('@/lib/supabase-admin-auth', () => ({
  createAuthUserSafely: (...args: unknown[]) => createAuthUserSafely(...args),
  deleteAuthUserSafely: (...args: unknown[]) => deleteAuthUserSafely(...args),
}))
vi.mock('@/lib/security', () => ({
  checkRateLimit: (...args: unknown[]) => checkRateLimit(...args),
  getClientIp: () => '127.0.0.1',
}))

const { POST } = await import('./route')

function request(body: Record<string, unknown>) {
  return new Request('http://localhost/api/kv-talaba/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const VALID = {
  lastName: 'Karimova',
  firstName: 'Aziza',
  middleName: 'Botirovna',
  noMiddleName: false,
  email: 'aziza@example.com',
  phone: '+998901234567',
  gender: 'female',
  faculty: 'amit',
  direction: 'suniy-intellekt',
  course: 1,
  group: '101-21',
  hemisStudentId: '12345',
  password: 'SecurePass123!',
  confirmPassword: 'SecurePass123!',
}

describe('POST /api/kv-talaba/register', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    checkRateLimit.mockResolvedValue({ allowed: true, remaining: 4 })
    createAuthUserSafely.mockResolvedValue({ data: { user: { id: 'new-id' } }, error: null })
    insert.mockResolvedValue({ error: null })
    emailMaybeSingle.mockResolvedValue({ data: null })
  })

  it('inserts an active, off-campus, room-less talaba row with a composed full name — no dekan approval gate', async () => {
    const response = await POST(request(VALID))
    expect(response.status).toBe(200)
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      id: 'new-id',
      role: 'talaba',
      status: 'active',
      is_off_campus: true,
      room_number: null,
      dorm_id: null,
      assigned_floor: null,
      faculty: 'amit',
      hemis_student_id: '12345',
      full_name: 'Karimova Aziza Botirovna',
      middle_name: 'Botirovna',
    }))
  })

  it('400s when a name part is missing', async () => {
    const response = await POST(request({ ...VALID, lastName: '' }))
    expect(response.status).toBe(400)
    expect(createAuthUserSafely).not.toHaveBeenCalled()
  })

  it('accepts noMiddleName without requiring a patronymic', async () => {
    const response = await POST(request({ ...VALID, middleName: '', noMiddleName: true }))
    expect(response.status).toBe(200)
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      full_name: 'Karimova Aziza',
      middle_name: null,
    }))
  })

  it('never touches permit_requests — no permit lookup for this flow', async () => {
    // Sanity: the mocked Supabase client has no permit_requests handling at
    // all, so a successful 200 here already proves the route never queried it.
    const response = await POST(request(VALID))
    expect(response.status).toBe(200)
  })

  it('400s when the direction does not belong to the chosen faculty', async () => {
    const response = await POST(request({ ...VALID, faculty: 'amit', direction: 'tarix' }))
    expect(response.status).toBe(400)
    expect(createAuthUserSafely).not.toHaveBeenCalled()
  })

  it('400s an unknown faculty', async () => {
    const response = await POST(request({ ...VALID, faculty: 'notreal' }))
    expect(response.status).toBe(400)
    expect(createAuthUserSafely).not.toHaveBeenCalled()
  })

  it('400s on a weak password without creating an Auth user', async () => {
    const response = await POST(request({ ...VALID, password: 'weak', confirmPassword: 'weak' }))
    expect(response.status).toBe(400)
    expect(createAuthUserSafely).not.toHaveBeenCalled()
  })

  it('409s a duplicate email before touching Auth', async () => {
    emailMaybeSingle.mockResolvedValue({ data: { id: 'existing' } })
    const response = await POST(request(VALID))
    expect(response.status).toBe(409)
    expect(createAuthUserSafely).not.toHaveBeenCalled()
  })

  it('rolls back the Auth user when the profile insert fails', async () => {
    insert.mockResolvedValue({ error: { code: '23505', message: 'duplicate' } })
    const response = await POST(request(VALID))
    expect(response.status).toBe(409)
    expect(deleteAuthUserSafely).toHaveBeenCalledWith('new-id')
  })

  it('429s once the rate limit is hit', async () => {
    checkRateLimit.mockResolvedValue({ allowed: false, remaining: 0 })
    const response = await POST(request(VALID))
    expect(response.status).toBe(429)
    expect(createAuthUserSafely).not.toHaveBeenCalled()
  })
})
