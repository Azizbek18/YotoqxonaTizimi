import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getRequestUser: vi.fn(),
  findStaffRowByIdentity: vi.fn(),
  staffDormFaculties: vi.fn(),
}))

vi.mock('@/lib/server-auth', () => ({ getRequestUser: mocks.getRequestUser }))
vi.mock('@/lib/server-supabase', () => ({ getServiceSupabase: () => ({}) }))
vi.mock('@/lib/auth-tables', () => ({ findStaffRowByIdentity: mocks.findStaffRowByIdentity }))
vi.mock('@/server/auth/faculty', () => ({ staffDormFaculties: mocks.staffDormFaculties }))

const { requireScopedTarbiyachi } = await import('./tarbiyachi')

function req() {
  return new Request('https://example.test/api/staff/x') as unknown as import('next/server').NextRequest
}

function errorOf(result: unknown): Response {
  if (!result || typeof result !== 'object' || !('error' in result)) {
    throw new Error('expected an error result')
  }
  return (result as { error: Response }).error
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('requireScopedTarbiyachi', () => {
  it('401s without a session', async () => {
    mocks.getRequestUser.mockResolvedValue(null)
    const result = await requireScopedTarbiyachi(req())
    expect(errorOf(result).status).toBe(401)
  })

  it('403s when no staff row matches', async () => {
    mocks.getRequestUser.mockResolvedValue({ id: 'u1', email: 'x@example.com' })
    mocks.findStaffRowByIdentity.mockResolvedValue(null)
    const result = await requireScopedTarbiyachi(req())
    expect(errorOf(result).status).toBe(403)
  })

  it('403s a staff row that is not an active tarbiyachi', async () => {
    mocks.getRequestUser.mockResolvedValue({ id: 'u1', email: 'x@example.com' })
    mocks.findStaffRowByIdentity.mockResolvedValue({ id: 'u1', role: 'dekan', status: 'active', faculty: 'amit' })
    const result = await requireScopedTarbiyachi(req())
    expect(errorOf(result).status).toBe(403)
  })

  it('403s an inactive tarbiyachi', async () => {
    mocks.getRequestUser.mockResolvedValue({ id: 'u1', email: 'x@example.com' })
    mocks.findStaffRowByIdentity.mockResolvedValue({ id: 'u1', role: 'tarbiyachi', status: 'suspended', faculty: 'amit' })
    const result = await requireScopedTarbiyachi(req())
    expect(errorOf(result).status).toBe(403)
  })

  it('403s and logs when an active tarbiyachi has no faculty', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.getRequestUser.mockResolvedValue({ id: 'u1', email: 'x@example.com' })
    mocks.findStaffRowByIdentity.mockResolvedValue({ id: 'u1', role: 'tarbiyachi', status: 'active', faculty: null })
    const result = await requireScopedTarbiyachi(req())
    expect(errorOf(result).status).toBe(403)
    expect(errorSpy).toHaveBeenCalled()
  })

  it('resolves faculty and dormFaculties for a valid tarbiyachi', async () => {
    mocks.getRequestUser.mockResolvedValue({ id: 'u1', email: 'x@example.com' })
    mocks.findStaffRowByIdentity.mockResolvedValue({ id: 'u1', role: 'tarbiyachi', status: 'active', faculty: 'AMIT' })
    mocks.staffDormFaculties.mockResolvedValue(['amit', 'iqtisodiyot'])
    const result = await requireScopedTarbiyachi(req())
    expect('error' in result).toBe(false)
    if (!('error' in result)) {
      expect(result.faculty).toBe('amit')
      expect(result.dormFaculties).toEqual(['amit', 'iqtisodiyot'])
    }
  })
})
