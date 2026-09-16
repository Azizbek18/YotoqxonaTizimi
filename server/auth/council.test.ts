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

const { requireCouncilChair } = await import('./council')

function req() {
  return new Request('https://example.test/api/kengash/x') as unknown as import('next/server').NextRequest
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

describe('requireCouncilChair', () => {
  it('401s without a session', async () => {
    mocks.getRequestUser.mockResolvedValue(null)
    const result = await requireCouncilChair(req())
    expect(errorOf(result).status).toBe(401)
  })

  it('403s when the lookup errors', async () => {
    mocks.getRequestUser.mockResolvedValue({ id: 'u1' })
    mocks.maybeSingle.mockResolvedValue({ data: null, error: new Error('db down') })
    const result = await requireCouncilChair(req())
    expect(errorOf(result).status).toBe(403)
  })

  it('403s a student who is not the council chair', async () => {
    mocks.getRequestUser.mockResolvedValue({ id: 'u1' })
    mocks.maybeSingle.mockResolvedValue({
      data: { role: 'talaba', status: 'active', is_council_chair: false },
      error: null,
    })
    const result = await requireCouncilChair(req())
    expect(errorOf(result).status).toBe(403)
  })

  it('403s an inactive chair', async () => {
    mocks.getRequestUser.mockResolvedValue({ id: 'u1' })
    mocks.maybeSingle.mockResolvedValue({
      data: { role: 'talaba', status: 'pending', is_council_chair: true, faculty: 'amit', gender: 'male' },
      error: null,
    })
    const result = await requireCouncilChair(req())
    expect(errorOf(result).status).toBe(403)
  })

  it('403s with PERMISSION_REVOKED when the specific permission was revoked', async () => {
    mocks.getRequestUser.mockResolvedValue({ id: 'u1' })
    mocks.maybeSingle.mockResolvedValue({
      data: {
        role: 'talaba', status: 'active', is_council_chair: true,
        faculty: 'amit', gender: 'male',
        council_chair_permissions: { 'council.announcements': false },
      },
      error: null,
    })
    const result = await requireCouncilChair(req(), 'council.announcements')
    const error = errorOf(result)
    expect(error.status).toBe(403)
    const body = await error.json()
    expect(body.code).toBe('PERMISSION_REVOKED')
  })

  it('403s a chair with no faculty (fails closed)', async () => {
    mocks.getRequestUser.mockResolvedValue({ id: 'u1' })
    mocks.maybeSingle.mockResolvedValue({
      data: { role: 'talaba', status: 'active', is_council_chair: true, faculty: null, gender: 'male' },
      error: null,
    })
    const result = await requireCouncilChair(req())
    expect(errorOf(result).status).toBe(403)
  })

  it('403s a chair with no gender set', async () => {
    mocks.getRequestUser.mockResolvedValue({ id: 'u1' })
    mocks.maybeSingle.mockResolvedValue({
      data: { role: 'talaba', status: 'active', is_council_chair: true, faculty: 'amit', gender: null },
      error: null,
    })
    const result = await requireCouncilChair(req())
    expect(errorOf(result).status).toBe(403)
  })

  it('resolves the chair, faculty and gender for a valid caller', async () => {
    mocks.getRequestUser.mockResolvedValue({ id: 'u1' })
    mocks.maybeSingle.mockResolvedValue({
      data: {
        id: 'u1', role: 'talaba', status: 'active', is_council_chair: true,
        faculty: 'AMIT', gender: 'female', council_chair_permissions: {},
      },
      error: null,
    })
    const result = await requireCouncilChair(req())
    expect('error' in result).toBe(false)
    if (!('error' in result)) {
      expect(result.faculty).toBe('amit')
      expect(result.gender).toBe('female')
    }
  })
})
