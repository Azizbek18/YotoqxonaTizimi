import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getRequestUser: vi.fn(),
  usersMaybeSingle: vi.fn(),
  staffMaybeSingle: vi.fn(),
  dormIdForFaculty: vi.fn(),
  facultiesForDorm: vi.fn(),
  resolveCallerFaculty: vi.fn(),
}))

vi.mock('@/lib/server-auth', () => ({ getRequestUser: mocks.getRequestUser }))
vi.mock('@/lib/server-supabase', () => ({
  getServiceSupabase: () => ({
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: table === 'users' ? mocks.usersMaybeSingle : mocks.staffMaybeSingle,
        }),
      }),
    }),
  }),
}))
vi.mock('./repository', () => ({
  createAttendanceRepository: () => ({
    dormIdForFaculty: mocks.dormIdForFaculty,
    facultiesForDorm: mocks.facultiesForDorm,
  }),
}))
vi.mock('@/server/auth/faculty', () => ({ resolveCallerFaculty: mocks.resolveCallerFaculty }))

const { resolveAttendanceActor } = await import('./actor')

function req() {
  return new Request('https://example.test/api/attendance/mark')
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.usersMaybeSingle.mockResolvedValue({ data: null, error: null })
  mocks.staffMaybeSingle.mockResolvedValue({ data: null, error: null })
})

describe('resolveAttendanceActor', () => {
  it('401s without a session', async () => {
    mocks.getRequestUser.mockResolvedValue(null)
    await expect(resolveAttendanceActor(req())).rejects.toMatchObject({ status: 401 })
  })

  it('resolves an active floor captain with attendance.mark as a write-scoped sardor', async () => {
    mocks.getRequestUser.mockResolvedValue({ id: 'u1' })
    mocks.usersMaybeSingle.mockResolvedValue({
      data: {
        role: 'talaba', status: 'active', is_floor_captain: true,
        assigned_floor: 3, gender: 'male', faculty: 'AMIT', captain_permissions: {},
      },
      error: null,
    })
    mocks.dormIdForFaculty.mockResolvedValue('dorm1')
    const actor = await resolveAttendanceActor(req())
    expect(actor).toEqual({
      userId: 'u1', role: 'sardor', dormId: 'dorm1', faculties: ['amit'],
      floor: 3, gender: 'male', canWrite: true,
    })
  })

  it('400s a captain with no floor/gender set', async () => {
    mocks.getRequestUser.mockResolvedValue({ id: 'u1' })
    mocks.usersMaybeSingle.mockResolvedValue({
      data: { role: 'talaba', status: 'active', is_floor_captain: true, assigned_floor: null, gender: null, captain_permissions: {} },
      error: null,
    })
    await expect(resolveAttendanceActor(req())).rejects.toMatchObject({ status: 400 })
  })

  it('409s a captain whose faculty has no dorm set up yet', async () => {
    mocks.getRequestUser.mockResolvedValue({ id: 'u1' })
    mocks.usersMaybeSingle.mockResolvedValue({
      data: { role: 'talaba', status: 'active', is_floor_captain: true, assigned_floor: 2, gender: 'female', faculty: 'amit', captain_permissions: {} },
      error: null,
    })
    mocks.dormIdForFaculty.mockResolvedValue(null)
    await expect(resolveAttendanceActor(req())).rejects.toMatchObject({ status: 409, code: 'DORM_NOT_SET' })
  })

  it('falls through to read-only resident when the captain’s attendance.mark permission was revoked', async () => {
    mocks.getRequestUser.mockResolvedValue({ id: 'u1' })
    mocks.usersMaybeSingle.mockResolvedValue({
      data: {
        role: 'talaba', status: 'active', is_floor_captain: true,
        assigned_floor: 3, gender: 'male', faculty: 'amit',
        captain_permissions: { 'attendance.mark': false },
      },
      error: null,
    })
    mocks.dormIdForFaculty.mockResolvedValue('dorm1')
    const actor = await resolveAttendanceActor(req())
    expect(actor.role).toBe('talaba')
    expect(actor.canWrite).toBe(false)
  })

  it('resolves an ordinary active student as read-only', async () => {
    mocks.getRequestUser.mockResolvedValue({ id: 'u1' })
    mocks.usersMaybeSingle.mockResolvedValue({
      data: { role: 'talaba', status: 'active', is_floor_captain: false, faculty: 'amit' },
      error: null,
    })
    mocks.dormIdForFaculty.mockResolvedValue('dorm1')
    const actor = await resolveAttendanceActor(req())
    expect(actor).toEqual({
      userId: 'u1', role: 'talaba', dormId: 'dorm1', faculties: ['amit'],
      floor: null, gender: null, canWrite: false,
    })
  })

  it('403s a resident student with no resolvable faculty', async () => {
    mocks.getRequestUser.mockResolvedValue({ id: 'u1' })
    mocks.usersMaybeSingle.mockResolvedValue({
      data: { role: 'talaba', status: 'active', is_floor_captain: false, faculty: null },
      error: null,
    })
    await expect(resolveAttendanceActor(req())).rejects.toMatchObject({ status: 403 })
  })

  it('403s a caller who is neither an active student nor active staff', async () => {
    mocks.getRequestUser.mockResolvedValue({ id: 'u1' })
    mocks.staffMaybeSingle.mockResolvedValue({ data: { role: 'tarbiyachi', status: 'suspended' }, error: null })
    await expect(resolveAttendanceActor(req())).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' })
  })

  it('403s with PERMISSION_REVOKED for a tarbiyachi missing attendance.manage', async () => {
    mocks.getRequestUser.mockResolvedValue({ id: 'u1' })
    mocks.staffMaybeSingle.mockResolvedValue({
      data: { role: 'tarbiyachi', status: 'active', faculty: 'amit', permissions: { 'attendance.manage': false } },
      error: null,
    })
    await expect(resolveAttendanceActor(req())).rejects.toMatchObject({ status: 403, code: 'PERMISSION_REVOKED' })
  })

  it('resolves a tarbiyachi as write-scoped across every faculty sharing their dorm', async () => {
    mocks.getRequestUser.mockResolvedValue({ id: 'u1' })
    mocks.staffMaybeSingle.mockResolvedValue({
      data: { role: 'tarbiyachi', status: 'active', faculty: 'amit', dorm_id: 'dorm1', assigned_gender: 'male', permissions: {} },
      error: null,
    })
    mocks.facultiesForDorm.mockResolvedValue(['amit', 'iqtisodiyot'])
    const actor = await resolveAttendanceActor(req())
    expect(actor).toEqual({
      userId: 'u1', role: 'tarbiyachi', dormId: 'dorm1', faculties: ['amit', 'iqtisodiyot'],
      floor: null, gender: 'male', canWrite: true,
    })
  })

  it('409s a tarbiyachi with no dorm resolvable at all', async () => {
    mocks.getRequestUser.mockResolvedValue({ id: 'u1' })
    mocks.staffMaybeSingle.mockResolvedValue({
      data: { role: 'tarbiyachi', status: 'active', faculty: null, dorm_id: null, permissions: {} },
      error: null,
    })
    await expect(resolveAttendanceActor(req())).rejects.toMatchObject({ status: 409, code: 'DORM_NOT_SET' })
  })

  it('resolves a dekan as read-only oversight of their own faculty', async () => {
    mocks.getRequestUser.mockResolvedValue({ id: 'u1' })
    mocks.staffMaybeSingle.mockResolvedValue({ data: { role: 'dekan', status: 'active' }, error: null })
    mocks.resolveCallerFaculty.mockResolvedValue('amit')
    mocks.dormIdForFaculty.mockResolvedValue('dorm1')
    const actor = await resolveAttendanceActor(req())
    expect(actor).toEqual({
      userId: 'u1', role: 'dekan', dormId: 'dorm1', faculties: ['amit'],
      floor: null, gender: null, canWrite: false,
    })
  })
})
