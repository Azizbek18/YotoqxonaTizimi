import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/server/http/api-error'

const mocks = vi.hoisted(() => ({
  getRequestUser: vi.fn(),
  maybeSingle: vi.fn(),
  readSuperadminScope: vi.fn(),
}))

vi.mock('@/lib/server-auth', () => ({ getRequestUser: mocks.getRequestUser }))
vi.mock('@/lib/server-supabase', () => ({
  getServiceSupabase: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: mocks.maybeSingle }),
      }),
    }),
  }),
}))
vi.mock('./faculty', () => ({ readSuperadminScope: mocks.readSuperadminScope }))

const {
  requireUser,
  requireActiveStudent,
  requireActiveStaff,
  requireAdmin,
  requireStaffPermission,
  requireCaptainPermission,
} = await import('./guards')

async function expectApiError(promise: Promise<unknown>, status: number, code?: string) {
  try {
    await promise
    throw new Error('should have thrown')
  } catch (error) {
    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).status).toBe(status)
    if (code) expect((error as ApiError).code).toBe(code)
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('requireUser', () => {
  it('returns the authenticated user', async () => {
    mocks.getRequestUser.mockResolvedValue({ id: 'u1' })
    await expect(requireUser()).resolves.toEqual({ id: 'u1' })
  })

  it('401s when there is no session', async () => {
    mocks.getRequestUser.mockResolvedValue(null)
    await expectApiError(requireUser(), 401, 'UNAUTHENTICATED')
  })

  it('401s when the user has no id', async () => {
    mocks.getRequestUser.mockResolvedValue({})
    await expectApiError(requireUser(), 401, 'UNAUTHENTICATED')
  })
})

describe('requireActiveStudent', () => {
  it('401s without a session', async () => {
    mocks.getRequestUser.mockResolvedValue(null)
    await expectApiError(requireActiveStudent(), 401, 'UNAUTHENTICATED')
  })

  it('500s when the profile lookup errors', async () => {
    mocks.getRequestUser.mockResolvedValue({ id: 'u1' })
    mocks.maybeSingle.mockResolvedValue({ data: null, error: new Error('db down') })
    await expectApiError(requireActiveStudent(), 500)
  })

  it('403s an inactive/wrong-role student', async () => {
    mocks.getRequestUser.mockResolvedValue({ id: 'u1' })
    mocks.maybeSingle.mockResolvedValue({ data: { role: 'talaba', status: 'pending' }, error: null })
    await expectApiError(requireActiveStudent(), 403, 'FORBIDDEN')
  })

  it('403s a blacklisted student by default', async () => {
    mocks.getRequestUser.mockResolvedValue({ id: 'u1' })
    mocks.maybeSingle.mockResolvedValue({
      data: { role: 'talaba', status: 'active', blacklisted: true },
      error: null,
    })
    await expectApiError(requireActiveStudent(), 403, 'BLACKLISTED')
  })

  it('allows a blacklisted student through when allowBlacklisted is set', async () => {
    mocks.getRequestUser.mockResolvedValue({ id: 'u1' })
    mocks.maybeSingle.mockResolvedValue({
      data: { role: 'talaba', status: 'active', blacklisted: true },
      error: null,
    })
    const result = await requireActiveStudent(undefined, { allowBlacklisted: true })
    expect(result.student.blacklisted).toBe(true)
  })

  it('returns the user + student row for an active, non-blacklisted student', async () => {
    mocks.getRequestUser.mockResolvedValue({ id: 'u1' })
    mocks.maybeSingle.mockResolvedValue({
      data: { role: 'talaba', status: 'active', blacklisted: false },
      error: null,
    })
    const result = await requireActiveStudent()
    expect(result.user).toEqual({ id: 'u1' })
    expect(result.student.status).toBe('active')
  })
})

describe('requireActiveStaff', () => {
  it('401s without a session', async () => {
    mocks.getRequestUser.mockResolvedValue(null)
    await expectApiError(requireActiveStaff(undefined, ['dekan']), 401, 'UNAUTHENTICATED')
  })

  it('500s when the staff lookup errors', async () => {
    mocks.getRequestUser.mockResolvedValue({ id: 's1' })
    mocks.maybeSingle.mockResolvedValue({ data: null, error: new Error('db down') })
    await expectApiError(requireActiveStaff(undefined, ['dekan']), 500)
  })

  it('403s a role not in the allow-list', async () => {
    mocks.getRequestUser.mockResolvedValue({ id: 's1' })
    mocks.maybeSingle.mockResolvedValue({ data: { role: 'tarbiyachi', status: 'active' }, error: null })
    await expectApiError(requireActiveStaff(undefined, ['dekan']), 403, 'FORBIDDEN')
  })

  it('403s an inactive staff member even in the allow-list', async () => {
    mocks.getRequestUser.mockResolvedValue({ id: 's1' })
    mocks.maybeSingle.mockResolvedValue({ data: { role: 'dekan', status: 'suspended' }, error: null })
    await expectApiError(requireActiveStaff(undefined, ['dekan']), 403, 'FORBIDDEN')
  })

  it('returns the staff row for an allowed active role', async () => {
    mocks.getRequestUser.mockResolvedValue({ id: 's1' })
    mocks.maybeSingle.mockResolvedValue({
      data: { id: 's1', role: 'dekan', status: 'active', faculty: 'amit' },
      error: null,
    })
    const result = await requireActiveStaff(undefined, ['dekan', 'admin'])
    expect(result.staff.faculty).toBe('amit')
  })

  it('injects the picked faculty for a scoped superadmin', async () => {
    mocks.getRequestUser.mockResolvedValue({ id: 'admin1' })
    mocks.maybeSingle.mockResolvedValue({
      data: { id: 'admin1', role: 'admin', status: 'active', faculty: null },
      error: null,
    })
    mocks.readSuperadminScope.mockResolvedValue({ faculty: 'fizika' })
    const result = await requireActiveStaff(undefined, ['admin'])
    expect(result.staff.faculty).toBe('fizika')
    expect(result.staff.superadminGlobal).toBeUndefined()
  })

  it('flags superadminGlobal and leaves faculty untouched in global scope', async () => {
    mocks.getRequestUser.mockResolvedValue({ id: 'admin1' })
    mocks.maybeSingle.mockResolvedValue({
      data: { id: 'admin1', role: 'admin', status: 'active', faculty: null },
      error: null,
    })
    mocks.readSuperadminScope.mockResolvedValue('global')
    const result = await requireActiveStaff(undefined, ['admin'])
    expect(result.staff.superadminGlobal).toBe(true)
    expect(result.staff.faculty).toBeNull()
  })
})

describe('requireAdmin', () => {
  it('delegates to requireActiveStaff with only the admin role allowed', async () => {
    mocks.getRequestUser.mockResolvedValue({ id: 's1' })
    mocks.maybeSingle.mockResolvedValue({ data: { role: 'dekan', status: 'active' }, error: null })
    await expectApiError(requireAdmin(), 403, 'FORBIDDEN')
  })
})

describe('requireStaffPermission', () => {
  it('is a no-op for non-tarbiyachi roles regardless of permissions', () => {
    expect(() => requireStaffPermission({ role: 'dekan', permissions: { 'students.view': false } }, 'students.view')).not.toThrow()
  })

  it('allows a tarbiyachi when the permission is not revoked', () => {
    expect(() => requireStaffPermission({ role: 'tarbiyachi', permissions: {} }, 'students.view')).not.toThrow()
  })

  it('403s a tarbiyachi whose permission was revoked', () => {
    expect(() => requireStaffPermission({ role: 'tarbiyachi', permissions: { 'students.view': false } }, 'students.view'))
      .toThrow(ApiError)
  })
})

describe('requireCaptainPermission', () => {
  it('allows when the permission is not revoked', () => {
    expect(() => requireCaptainPermission({}, 'attendance.mark')).not.toThrow()
  })

  it('403s when the permission was revoked', () => {
    expect(() => requireCaptainPermission({ 'attendance.mark': false }, 'attendance.mark')).toThrow(ApiError)
  })
})
