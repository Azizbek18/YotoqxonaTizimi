import 'server-only'
import { createClient, type User } from '@supabase/supabase-js'
import type { NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/server-admin'
import { getServiceSupabase } from '@/lib/server-supabase'

function isNetworkError(error: unknown) {
  return error instanceof TypeError && error.message.toLowerCase().includes('fetch failed')
}

// A transient network blip talking to Supabase Auth (e.g. `TypeError: fetch
// failed`) is not the same thing as "not logged in", but supabase-js surfaces
// both the same way. Retry once so a momentary hiccup doesn't get misreported
// to the caller as an authentication failure.
async function withRetry<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call()
  } catch (error) {
    if (!isNetworkError(error)) throw error
    return call()
  }
}

type AccessTokenClaims = {
  sub?: string
  session_id?: string
  email?: string
  phone?: string
  role?: string
  aud?: string | string[]
  iat?: number
  app_metadata?: Record<string, unknown>
  user_metadata?: Record<string, unknown>
}

// Downstream code only reads `.id` and `.email`; the rest is filled in from the
// verified claims so the shape still satisfies `User` for the type checker.
function claimsToUser(claims: AccessTokenClaims): User | null {
  if (!claims.sub) return null
  const createdAt = claims.iat ? new Date(claims.iat * 1000).toISOString() : ''
  return {
    id: claims.sub,
    aud: (Array.isArray(claims.aud) ? claims.aud[0] : claims.aud) ?? 'authenticated',
    role: claims.role ?? 'authenticated',
    email: claims.email,
    phone: claims.phone,
    app_metadata: (claims.app_metadata ?? {}) as User['app_metadata'],
    user_metadata: (claims.user_metadata ?? {}) as User['user_metadata'],
    created_at: createdAt,
  } as User
}

function decodeVerifiedTokenClaims(token: string): AccessTokenClaims | null {
  try {
    const payload = token.split('.')[1]
    if (!payload) return null
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as AccessTokenClaims
    return claims && typeof claims === 'object' ? claims : null
  } catch {
    return null
  }
}

export type RequestAuth = { user: User; sessionId: string }

// Immediately after signInWithPassword, GoTrue can return the token a few
// milliseconds before the new auth.sessions row becomes visible through
// PostgREST. Only the login role-resolution call (right after sign-in) needs
// to ride out that lag — every other caller (i.e. almost every API route, via
// requireUser()/requireActiveStudent()/requireActiveStaff()) must keep
// failing closed on the first check, or a routinely revoked/expired session
// would add up to 350ms and 3x the DB load to every single request site-wide.
export type RequestAuthOptions = { retryOnMissingSession?: boolean }

const wait = (milliseconds: number) => new Promise<void>((resolve) => {
  setTimeout(resolve, milliseconds)
})

async function activeAuth(claims: AccessTokenClaims, options: RequestAuthOptions = {}): Promise<RequestAuth | null> {
  const user = claimsToUser(claims)
  const sessionId = claims.session_id
  if (!user || typeof sessionId !== 'string'
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sessionId)) return null

  // This existing service-role-only RPC reads auth.sessions, scopes by user,
  // and excludes expired sessions. Filter at the DB to avoid pagination and
  // never cache the result: a revoked JWT must fail on the next API request.
  const retryDelays = options.retryOnMissingSession ? [0, 100, 250] : [0]
  for (const retryDelay of retryDelays) {
    if (retryDelay) await wait(retryDelay)
    const sessionResult: { data: { id: string } | null; error: unknown } = await getServiceSupabase()
      .rpc('list_user_sessions', { p_user_id: user.id })
      .eq('id', sessionId)
      .maybeSingle()
    if (sessionResult.error) throw new Error('Auth session validation failed', { cause: sessionResult.error })
    if (sessionResult.data?.id === sessionId) return { user, sessionId }
  }

  if (process.env.NODE_ENV === 'development') {
    console.warn('[auth] Verified token has no visible live session after retries')
  }
  return null
}

/**
 * Returns the user and verified session ID, or null when the request is
 * unauthenticated or the token/session is invalid, expired, or revoked.
 *
 * Verify the JWT first, then check the live session. Both Bearer and cookie
 * requests use the verified session_id, including device-management requests.
 * Database failures fail closed; no identity is returned without a live session.
 */
export async function getRequestAuth(
  request?: Request | NextRequest,
  options: RequestAuthOptions = {},
): Promise<RequestAuth | null> {
  const authHeader = request?.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (token) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !anonKey) return null

    const supabase = createClient(url, anonKey)
    const { data, error } = await withRetry(() => supabase.auth.getClaims(token))
    if (!error && data?.claims) {
      return activeAuth(data.claims as AccessTokenClaims, options)
    }

    // Local/dev environments can occasionally fail the JWKS-backed getClaims()
    // path even though GoTrue accepts the freshly-issued token. getUser(token)
    // performs an authoritative server-side verification, but it's a live
    // network call — only worth it for a token that is at least shaped like
    // one we issued. A structurally invalid/garbage bearer value (the common
    // case for scanners and broken clients hitting unauthenticated-tolerant
    // routes) fails locally here instead of costing a Supabase Auth round trip
    // on every request.
    const fallbackClaims = decodeVerifiedTokenClaims(token)
    if (!fallbackClaims?.sub) return null

    const { data: userData, error: userError } = await withRetry(() => supabase.auth.getUser(token))
    if (userError || !userData.user || userData.user.id !== fallbackClaims.sub) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[auth] Bearer token verification failed in both getClaims and getUser')
      }
      return null
    }
    return activeAuth({
      ...fallbackClaims,
      email: userData.user.email,
      phone: userData.user.phone,
      app_metadata: userData.user.app_metadata,
      user_metadata: userData.user.user_metadata,
    }, options)
  }

  // Never authorize from getSession(): it only reads the locally stored JWT
  // without revalidating it. getClaims() verifies the cookie-backed access
  // token (locally via JWKS, or via getUser() on the legacy secret) before
  // privileged service-role queries run.
  const supabase = await createServerSupabaseClient()
  const { data, error } = await withRetry(() => supabase.auth.getClaims())
  if (error || !data?.claims) return null
  return activeAuth(data.claims as AccessTokenClaims, options)
}

export async function getRequestUser(
  request?: Request | NextRequest,
  options: RequestAuthOptions = {},
): Promise<User | null> {
  return (await getRequestAuth(request, options))?.user ?? null
}
