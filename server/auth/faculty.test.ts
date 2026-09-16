import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/server/http/api-error'

const cookieStore = { value: undefined as string | undefined }
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (name === 'sa_scope' && cookieStore.value ? { value: cookieStore.value } : undefined),
  }),
}))

type Result = { data: unknown; error: unknown }
const { tableState } = vi.hoisted(() => ({
  tableState: {} as Record<string, { single: Result; list: Result }>,
}))

function freshTableState() {
  return {
    staff: { single: { data: null, error: null }, list: { data: null, error: null } },
    users: { single: { data: null, error: null }, list: { data: null, error: null } },
    faculty_dorm: { single: { data: null, error: null }, list: { data: null, error: null } },
  }
}
Object.assign(tableState, freshTableState())

function chain(table: string) {
  const builder: PromiseLike<Result> & Record<string, unknown> = {
    select: () => builder,
    eq: () => builder,
    maybeSingle: async () => tableState[table].single,
    then: (resolve: (value: Result) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(tableState[table].list).then(resolve, reject),
  } as unknown as PromiseLike<Result> & Record<string, unknown>
  return builder
}

vi.mock('@/lib/server-supabase', () => ({
  getServiceSupabase: () => ({ from: (table: string) => chain(table) }),
}))

const {
  readSuperadminScope,
  requirePickedFaculty,
  requireStaffFaculty,
  staffFacultyOrPrimary,
  resolveCallerFaculty,
  staffDormFaculties,
} = await import('./faculty')

beforeEach(() => {
  Object.assign(tableState, freshTableState())
})

afterEach(() => {
  cookieStore.value = undefined
})

describe('readSuperadminScope', () => {
  it('is global when the cookie is unset', async () => {
    expect(await readSuperadminScope()).toBe('global')
  })
  it('is global for the * sentinel', async () => {
    cookieStore.value = '*'
    expect(await readSuperadminScope()).toBe('global')
  })
  it('resolves a real faculty code (canonicalised)', async () => {
    cookieStore.value = 'FIZIKA'
    expect(await readSuperadminScope()).toEqual({ faculty: 'fizika' })
  })
  it('falls back to global for an unknown code', async () => {
    cookieStore.value = 'not-a-faculty'
    expect(await readSuperadminScope()).toBe('global')
  })
})

describe('requirePickedFaculty', () => {
  it('throws SCOPE_REQUIRED for a superadmin acting globally', () => {
    try {
      requirePickedFaculty({ faculty: 'amit', superadminGlobal: true })
      throw new Error('should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError)
      expect((error as ApiError).code).toBe('SCOPE_REQUIRED')
    }
  })
  it('returns the picked faculty otherwise', () => {
    expect(requirePickedFaculty({ faculty: 'fizika' })).toBe('fizika')
    expect(requirePickedFaculty({ faculty: 'amit', superadminGlobal: false })).toBe('amit')
  })
  it('still 403s a real staffer with no faculty', () => {
    expect(() => requirePickedFaculty({ faculty: null })).toThrow()
  })
})

describe('requireStaffFaculty / staffFacultyOrPrimary', () => {
  it('canonicalises a known faculty', () => {
    expect(requireStaffFaculty('AMIT')).toBe('amit')
  })
  it('throws 403 for a missing faculty', () => {
    expect(() => requireStaffFaculty(null)).toThrow(ApiError)
  })
  it('throws 403 for an unrecognised faculty code (fails closed, no primary fallback)', () => {
    expect(() => requireStaffFaculty('not-a-real-faculty')).toThrow(ApiError)
  })
  it('staffFacultyOrPrimary behaves exactly like requireStaffFaculty', () => {
    expect(staffFacultyOrPrimary('fizika')).toBe('fizika')
    expect(() => staffFacultyOrPrimary(undefined)).toThrow(ApiError)
  })
})

describe('resolveCallerFaculty', () => {
  it('propagates a staff lookup error', async () => {
    tableState.staff.single = { data: null, error: new Error('boom') }
    await expect(resolveCallerFaculty('u1')).rejects.toThrow('boom')
  })

  it('resolves a superadmin to their picked faculty', async () => {
    tableState.staff.single = { data: { role: 'admin', faculty: null }, error: null }
    cookieStore.value = 'FIZIKA'
    await expect(resolveCallerFaculty('u1')).resolves.toBe('fizika')
  })

  it('SCOPE_REQUIREDs a superadmin acting globally', async () => {
    tableState.staff.single = { data: { role: 'admin', faculty: null }, error: null }
    await expect(resolveCallerFaculty('u1')).rejects.toMatchObject({ code: 'SCOPE_REQUIRED' })
  })

  it('resolves a regular staff member to their own faculty', async () => {
    tableState.staff.single = { data: { role: 'dekan', faculty: 'AMIT' }, error: null }
    await expect(resolveCallerFaculty('u1')).resolves.toBe('amit')
  })

  it('falls back to the users table for a student', async () => {
    tableState.staff.single = { data: null, error: null }
    tableState.users.single = { data: { faculty: 'fizika' }, error: null }
    await expect(resolveCallerFaculty('u1')).resolves.toBe('fizika')
  })

  it('fails closed when neither staff nor student has a resolvable faculty', async () => {
    tableState.staff.single = { data: null, error: null }
    tableState.users.single = { data: null, error: null }
    await expect(resolveCallerFaculty('u1')).rejects.toThrow(ApiError)
  })
})

describe('staffDormFaculties', () => {
  it('throws immediately when the fallback faculty itself is invalid', async () => {
    await expect(staffDormFaculties('s1', null)).rejects.toThrow(ApiError)
  })

  it('uses the staff row’s own dorm to list every faculty sharing it', async () => {
    tableState.staff.single = { data: { dorm_id: 'd1' }, error: null }
    tableState.faculty_dorm.list = { data: [{ faculty: 'AMIT' }, { faculty: 'iqtisodiyot' }], error: null }
    await expect(staffDormFaculties('s1', 'amit')).resolves.toEqual(['amit', 'iqtisodiyot'])
  })

  it('resolves the dorm from the faculty mapping when the staff has none yet', async () => {
    tableState.staff.single = { data: { dorm_id: null }, error: null }
    tableState.faculty_dorm.single = { data: { dorm_id: 'd2' }, error: null }
    tableState.faculty_dorm.list = { data: [{ faculty: 'amit' }], error: null }
    await expect(staffDormFaculties('s1', 'amit')).resolves.toEqual(['amit'])
  })

  it('falls back to just the staff’s own faculty when no dorm link exists at all', async () => {
    tableState.staff.single = { data: { dorm_id: null }, error: null }
    tableState.faculty_dorm.single = { data: null, error: null }
    await expect(staffDormFaculties('s1', 'amit')).resolves.toEqual(['amit'])
  })

  it('falls back to just the staff’s own faculty when the dorm has no linked faculties', async () => {
    tableState.staff.single = { data: { dorm_id: 'd1' }, error: null }
    tableState.faculty_dorm.list = { data: [], error: null }
    await expect(staffDormFaculties('s1', 'amit')).resolves.toEqual(['amit'])
  })
})
