import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const getClaims = vi.fn()
const cookieGetClaims = vi.fn()

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ auth: { getClaims } }),
}))
vi.mock('@/lib/server-admin', () => ({
  createServerSupabaseClient: async () => ({ auth: { getClaims: cookieGetClaims } }),
}))

const { getRequestUser, getRequestSessionId } = await import('./server-auth')

const b64url = (obj: unknown) =>
  Buffer.from(JSON.stringify(obj)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const makeToken = (payload: Record<string, unknown>) => `h.${b64url(payload)}.sig`

const bearer = (token: string) => new Request('https://x', { headers: { authorization: `Bearer ${token}` } })

beforeEach(() => {
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
      data: { claims: { sub: 'user-1', email: 'A@Example.com', iat: 1_700_000_000 } },
      error: null,
    })

    const user = await getRequestUser(bearer(makeToken({ sub: 'user-1' })))

    expect(getClaims).toHaveBeenCalledWith(expect.stringContaining('.'))
    expect(user?.id).toBe('user-1')
    expect(user?.email).toBe('A@Example.com')
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
      .mockResolvedValueOnce({ data: { claims: { sub: 'user-2' } }, error: null })

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
    cookieGetClaims.mockResolvedValue({ data: { claims: { sub: 'user-9' } }, error: null })

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

describe('getRequestSessionId', () => {
  it('reads the session_id claim from a Bearer token', () => {
    const token = makeToken({ sub: 'u', session_id: 'sess-123' })
    expect(getRequestSessionId(bearer(token))).toBe('sess-123')
  })

  it('returns null without a Bearer token', () => {
    expect(getRequestSessionId(new Request('https://x'))).toBeNull()
  })
})
