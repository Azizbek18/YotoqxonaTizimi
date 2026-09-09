import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const getClaims = vi.fn()
const cookieGetClaims = vi.fn()
const sessionId = '11111111-1111-4111-8111-111111111111'
const rpc = vi.fn()
const eq = vi.fn()
const maybeSingle = vi.fn()

vi.mock('@/lib/server-supabase', () => ({ getServiceSupabase: () => ({ rpc }) }))

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ auth: { getClaims } }),
}))
vi.mock('@/lib/server-admin', () => ({
  createServerSupabaseClient: async () => ({ auth: { getClaims: cookieGetClaims } }),
}))

const { getRequestUser, getRequestAuth } = await import('./server-auth')

const b64url = (obj: unknown) =>
  Buffer.from(JSON.stringify(obj)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const makeToken = (payload: Record<string, unknown>) => `h.${b64url(payload)}.sig`

const bearer = (token: string) => new Request('https://x', { headers: { authorization: `Bearer ${token}` } })

beforeEach(() => {
  vi.resetAllMocks()
  rpc.mockReturnValue({ eq })
  eq.mockReturnValue({ maybeSingle })
  maybeSingle.mockResolvedValue({ data: { id: sessionId }, error: null })
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://project.supabase.co')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key')
})

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllEnvs()
})

describe('getRequestUser (Bearer token)', () => {
  it('returns the user built from verified claims', async () => {
    getClaims.mockResolvedValue({
      data: { claims: { sub: 'user-1', session_id: sessionId, email: 'A@Example.com', iat: 1_700_000_000 } },
      error: null,
    })

    const user = await getRequestUser(bearer(makeToken({ sub: 'user-1' })))

    expect(getClaims).toHaveBeenCalledWith(expect.stringContaining('.'))
    expect(user?.id).toBe('user-1')
    expect(user?.email).toBe('A@Example.com')
    expect(rpc).toHaveBeenCalledWith('list_user_sessions', { p_user_id: 'user-1' })
    expect(eq).toHaveBeenCalledWith('id', sessionId)
  })

  it('returns null when the token is invalid or expired', async () => {
    getClaims.mockResolvedValue({ data: null, error: { message: 'invalid JWT' } })
    expect(await getRequestUser(bearer(makeToken({ sub: 'user-1' })))).toBeNull()
  })

  it('returns null when claims carry no subject', async () => {
    getClaims.mockResolvedValue({ data: { claims: { email: 'x@y.z' } }, error: null })
    expect(await getRequestUser(bearer(makeToken({})))).toBeNull()
  })

  it('retries once on a transient network error, then succeeds', async () => {
    getClaims
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce({ data: { claims: { sub: 'user-2', session_id: sessionId } }, error: null })

    const user = await getRequestUser(bearer(makeToken({ sub: 'user-2' })))
    expect(user?.id).toBe('user-2')
    expect(getClaims).toHaveBeenCalledTimes(2)
  })

  it('rethrows a non-network error', async () => {
    getClaims.mockRejectedValue(new Error('boom'))
    await expect(getRequestUser(bearer(makeToken({ sub: 'user-3' })))).rejects.toThrow('boom')
  })
})

describe('getRequestUser (cookie session)', () => {
  it('verifies the cookie-backed token via the SSR client', async () => {
    cookieGetClaims.mockResolvedValue({ data: { claims: { sub: 'user-9', session_id: sessionId } }, error: null })

    const user = await getRequestUser(new Request('https://x'))

    expect(cookieGetClaims).toHaveBeenCalledTimes(1)
    expect(getClaims).not.toHaveBeenCalled()
    expect(user?.id).toBe('user-9')
  })

  it('returns null when there is no valid session', async () => {
    cookieGetClaims.mockResolvedValue({ data: null, error: null })
    expect(await getRequestUser(new Request('https://x'))).toBeNull()
  })
})

describe.each(['bearer', 'cookie'] as const)('%s session security', (mode) => {
  const request = () => mode === 'bearer' ? bearer('signed-token') : new Request('https://x')
  const verifier = () => mode === 'bearer' ? getClaims : cookieGetClaims
  beforeEach(() => {
    verifier().mockResolvedValue({ data: { claims: { sub: 'user-1', session_id: sessionId } }, error: null })
  })

  it('returns the verified current session for device management', async () => {
    expect(await getRequestAuth(request())).toMatchObject({ user: { id: 'user-1' }, sessionId })
  })

  it('rejects a revoked session while its signed token remains valid, without caching', async () => {
    expect(await getRequestUser(request())).not.toBeNull()
    maybeSingle.mockResolvedValue({ data: null, error: null })
    expect(await getRequestUser(request())).toBeNull()
    expect(rpc).toHaveBeenCalledTimes(2)
  })

  it('does not accept another session in place of the token session', async () => {
    maybeSingle.mockResolvedValue({ data: { id: '22222222-2222-4222-8222-222222222222' }, error: null })
    expect(await getRequestUser(request())).toBeNull()
  })

  it.each([undefined, '', 'invalid-session-id'])('rejects a missing or malformed session_id: %s', async (id) => {
    verifier().mockResolvedValue({ data: { claims: { sub: 'user-1', session_id: id } }, error: null })
    expect(await getRequestUser(request())).toBeNull()
    expect(rpc).not.toHaveBeenCalled()
  })

  it('rejects invalid signatures before querying privileged session data', async () => {
    verifier().mockResolvedValue({ data: null, error: { message: 'invalid JWT' } })
    expect(await getRequestUser(request())).toBeNull()
    expect(rpc).not.toHaveBeenCalled()
  })

  it('fails closed when the database lookup fails', async () => {
    maybeSingle.mockResolvedValue({ data: null, error: { message: 'database unavailable' } })
    await expect(getRequestUser(request())).rejects.toThrow('Auth session validation failed')
  })
})
