import 'server-only'
import { createClient, type User } from '@supabase/supabase-js'
import type { NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/server-admin'

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

/**
 * The `session_id` claim of the caller's access token, when it arrived as a
 * Bearer token. Used to mark "this device" in the session list — the token
 * itself is verified separately by getRequestUser(), this only reads a claim.
 */
export function getRequestSessionId(request?: Request | NextRequest): string | null {
  const authHeader = request?.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return null
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64').toString('utf8'))
    return typeof payload.session_id === 'string' ? payload.session_id : null
  } catch {
    return null
  }
}

/**
 * Verifies the caller's access token and returns the user, or null when the
 * request is unauthenticated / the token is invalid or expired.
 *
 * Uses `auth.getClaims()`, which verifies the JWT signature locally against the
 * project's JWKS when asymmetric signing keys are enabled — no round-trip to
 * Supabase Auth, no `auth.users` / `auth.sessions` reads per request. While the
 * project still signs with the legacy symmetric (HS256) secret, getClaims()
 * transparently falls back to a network `getUser()` call, so behaviour is
 * identical to before until asymmetric keys are turned on in the dashboard.
 *
 * A revoked session is not detected here until the token expires (access tokens
 * are short-lived); the privileged guards (`requireActiveStudent` /
 * `requireActiveStaff`) re-check the user's row in `public.users` / `public.staff`
 * on every call, so status and blacklist changes still take effect immediately.
 */
export async function getRequestUser(request?: Request | NextRequest): Promise<User | null> {
  const authHeader = request?.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (token) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !anonKey) return null

    const supabase = createClient(url, anonKey)
    const { data, error } = await withRetry(() => supabase.auth.getClaims(token))
    if (error || !data?.claims) return null
    return claimsToUser(data.claims as AccessTokenClaims)
  }

  // Never authorize from getSession(): it only reads the locally stored JWT
  // without revalidating it. getClaims() verifies the cookie-backed access
  // token (locally via JWKS, or via getUser() on the legacy secret) before
  // privileged service-role queries run.
  const supabase = await createServerSupabaseClient()
  const { data, error } = await withRetry(() => supabase.auth.getClaims())
  if (error || !data?.claims) return null
  return claimsToUser(data.claims as AccessTokenClaims)
}
