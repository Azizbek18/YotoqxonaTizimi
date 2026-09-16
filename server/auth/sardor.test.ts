import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getRequestUser: vi.fn(),
  maybeSingle: vi.fn(),
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

const { requireFloorCaptain } = await import('./sardor')

function req() {
  return new Request('https://example.test/api/sardor/x') as unknown as import('next/server').NextRequest
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

describe('requireFloorCaptain', () => {
  it('401s without a session', async () => {
    mocks.getRequestUser.mockResolvedValue(null)
    const result = await requireFloorCaptain(req())
    expect(errorOf(result).status).toBe(401)
  })

  it('403s when the lookup errors', async () => {
    mocks.getRequestUser.mockResolvedValue({ id: 'u1' })
    mocks.maybeSingle.mockResolvedValue({ data: null, error: new Error('db down') })
    const result = await requireFloorCaptain(req())
    expect(errorOf(result).status).toBe(403)
  })

  it('403s a student who is not the floor captain', async () => {
    mocks.getRequestUser.mockResolvedValue({ id: 'u1' })
    mocks.maybeSingle.mockResolvedValue({
      data: { role: 'talaba', status: 'active', is_floor_captain: false },
      error: null,
    })
    const result = await requireFloorCaptain(req())
    expect(errorOf(result).status).toBe(403)
  })

  it('403s an inactive captain', async () => {
    mocks.getRequestUser.mockResolvedValue({ id: 'u1' })
    mocks.maybeSingle.mockResolvedValue({
      data: { role: 'talaba', status: 'pending', is_floor_captain: true, faculty: 'amit' },
      error: null,
    })
    const result = await requireFloorCaptain(req())
    expect(errorOf(result).status).toBe(403)
  })

  it('403s with PERMISSION_REVOKED when the specific permission was revoked', async () => {
    mocks.getRequestUser.mockResolvedValue({ id: 'u1' })
    mocks.maybeSingle.mockResolvedValue({
      data: {
        role: 'talaba', status: 'active', is_floor_captain: true, faculty: 'amit',
        captain_permissions: { 'attendance.mark': false },
      },
      error: null,
    })
    const result = await requireFloorCaptain(req(), 'attendance.mark')
    const error = errorOf(result)
    expect(error.status).toBe(403)
    const body = await error.json()
    expect(body.code).toBe('PERMISSION_REVOKED')
  })

  it('403s a captain with no faculty (fails closed)', async () => {
    mocks.getRequestUser.mockResolvedValue({ id: 'u1' })
    mocks.maybeSingle.mockResolvedValue({
      data: { role: 'talaba', status: 'active', is_floor_captain: true, faculty: null },
      error: null,
    })
    const result = await requireFloorCaptain(req())
    expect(errorOf(result).status).toBe(403)
  })

  it('resolves the caller and faculty for a valid captain', async () => {
    mocks.getRequestUser.mockResolvedValue({ id: 'u1' })
    mocks.maybeSingle.mockResolvedValue({
      data: {
        id: 'u1', role: 'talaba', status: 'active', is_floor_captain: true,
        assigned_floor: 3, faculty: 'FIZIKA', captain_permissions: {},
      },
      error: null,
    })
    const result = await requireFloorCaptain(req())
    expect('error' in result).toBe(false)
    if (!('error' in result)) {
      expect(result.faculty).toBe('fizika')
      expect(result.caller.assigned_floor).toBe(3)
    }
  })
})
