import { beforeEach, describe, expect, it, vi } from 'vitest'

const VALID_SESSION_ID = '11111111-2222-3333-4444-555555555555'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  tokenGetClaims: vi.fn(),
  cookieGetClaims: vi.fn(),
  createServerSupabaseClient: vi.fn(),
  rpcEqMaybeSingle: vi.fn(),
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: mocks.createClient,
}))
vi.mock('@/lib/server-admin', () => ({
  createServerSupabaseClient: mocks.createServerSupabaseClient,
}))
vi.mock('@/lib/server-supabase', () => ({
  getServiceSupabase: () => ({
    rpc: () => ({ eq: () => ({ maybeSingle: mocks.rpcEqMaybeSingle }) }),
  }),
}))

const { getRequestAuth, getRequestUser } = await import('./server-auth')

const VALID_CLAIMS = {
  sub: 'user-1',
  session_id: VALID_SESSION_ID,
  email: 'student@example.com',
  role: 'authenticated',
  aud: 'authenticated',
  iat: 1_700_000_000,
}

function bearerRequest(token = 'a-jwt-token') {
  return new Request('https://example.test/api/x', { headers: { authorization: `Bearer ${token}` } })
}

function cookieRequest() {
  return new Request('https://example.test/api/x')
}

beforeEach(() => {
  vi.resetAllMocks()
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'
  mocks.createClient.mockReturnValue({ auth: { getClaims: mocks.tokenGetClaims } })
  mocks.createServerSupabaseClient.mockResolvedValue({ auth: { getClaims: mocks.cookieGetClaims } })
  mocks.rpcEqMaybeSingle.mockResolvedValue({ data: { id: VALID_SESSION_ID }, error: null })
})

describe('getRequestAuth — Bearer token path', () => {
  it('returns null when the Supabase env vars are missing', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    await expect(getRequestAuth(bearerRequest())).resolves.toBeNull()
  })

  it('returns null when getClaims errors', async () => {
    mocks.tokenGetClaims.mockResolvedValue({ data: null, error: new Error('bad token') })
    await expect(getRequestAuth(bearerRequest())).resolves.toBeNull()
  })

  it('returns null when the session_id claim is not a valid UUID', async () => {
    mocks.tokenGetClaims.mockResolvedValue({ data: { claims: { ...VALID_CLAIMS, session_id: 'not-a-uuid' } }, error: null })
    await expect(getRequestAuth(bearerRequest())).resolves.toBeNull()
  })

  it('throws when the live-session check itself errors (fails closed, not silently)', async () => {
    mocks.tokenGetClaims.mockResolvedValue({ data: { claims: VALID_CLAIMS }, error: null })
    mocks.rpcEqMaybeSingle.mockResolvedValue({ data: null, error: new Error('db down') })
    await expect(getRequestAuth(bearerRequest())).rejects.toThrow('Auth session validation failed')
  })

  it('returns null for a revoked session (row no longer present)', async () => {
    mocks.tokenGetClaims.mockResolvedValue({ data: { claims: VALID_CLAIMS }, error: null })
    mocks.rpcEqMaybeSingle.mockResolvedValue({ data: null, error: null })
    await expect(getRequestAuth(bearerRequest())).resolves.toBeNull()
  })

  it('returns the user + sessionId for a valid, live session', async () => {
    mocks.tokenGetClaims.mockResolvedValue({ data: { claims: VALID_CLAIMS }, error: null })
    const result = await getRequestAuth(bearerRequest())
    expect(result?.sessionId).toBe(VALID_SESSION_ID)
    expect(result?.user.id).toBe('user-1')
    expect(result?.user.email).toBe('student@example.com')
  })

  it('retries once on a transient network error talking to Supabase Auth', async () => {
    mocks.tokenGetClaims
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce({ data: { claims: VALID_CLAIMS }, error: null })
    const result = await getRequestAuth(bearerRequest())
    expect(result?.sessionId).toBe(VALID_SESSION_ID)
    expect(mocks.tokenGetClaims).toHaveBeenCalledTimes(2)
  })

  it('does not retry and propagates a non-network error', async () => {
    mocks.tokenGetClaims.mockRejectedValue(new Error('boom'))
    await expect(getRequestAuth(bearerRequest())).rejects.toThrow('boom')
    expect(mocks.tokenGetClaims).toHaveBeenCalledTimes(1)
  })
})

describe('getRequestAuth — cookie session path', () => {
  it('returns null when getClaims errors', async () => {
    mocks.cookieGetClaims.mockResolvedValue({ data: null, error: new Error('no cookie') })
    await expect(getRequestAuth(cookieRequest())).resolves.toBeNull()
  })

  it('returns the user + sessionId for a valid cookie session', async () => {
    mocks.cookieGetClaims.mockResolvedValue({ data: { claims: VALID_CLAIMS }, error: null })
    const result = await getRequestAuth(cookieRequest())
    expect(result?.sessionId).toBe(VALID_SESSION_ID)
    expect(result?.user.id).toBe('user-1')
  })
})

describe('getRequestUser', () => {
  it('returns null when there is no live session', async () => {
    mocks.cookieGetClaims.mockResolvedValue({ data: null, error: new Error('none') })
    await expect(getRequestUser(cookieRequest())).resolves.toBeNull()
  })

  it('returns just the user when the session is live', async () => {
    mocks.cookieGetClaims.mockResolvedValue({ data: { claims: VALID_CLAIMS }, error: null })
    const user = await getRequestUser(cookieRequest())
    expect(user?.id).toBe('user-1')
  })
})
