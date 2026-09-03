import type { SupabaseClient } from '@supabase/supabase-js'

export type AppRole = 'admin' | 'tarbiyachi' | 'dekan' | 'talaba' | null

type Identity = {
  id?: string | null
  email?: string | null
}

/**
 * The caller's identity taken from their verified access-token claims.
 *
 * `auth.getClaims()` verifies the JWT signature locally against the project's
 * cached JWKS when asymmetric signing keys are enabled (the default for new
 * projects, and the case here) — no GoTrue round-trip per request — and
 * refreshes a near-expiry session first, which is why it is a safe drop-in
 * for `getUser()` in the Proxy. It transparently falls back to a network
 * `getUser()` call only while a project still signs with the legacy symmetric
 * secret.
 *
 * Identity only. A server-side logout / ban is not seen here until the access
 * token expires, so callers that gate access must still re-check the live
 * `staff` / `users` row (which `findRoleByIdentity` and the `requireActive*`
 * guards already do).
 */
export async function getClaimsIdentity(
  supabase: SupabaseClient
): Promise<{ id: string; email: string | null } | null> {
  const { data, error } = await supabase.auth.getClaims()
  const claims = !error && data?.claims ? data.claims : null
  if (!claims?.sub) return null
  return { id: claims.sub, email: typeof claims.email === 'string' ? claims.email : null }
}

// Finds a `staff` row matching either `id` or `email` using two safe,
// parameterized lookups instead of interpolating user-controlled values into
// a single `.or()` filter string (PostgREST's or() mini-language treats
// commas/dots as syntax, so raw interpolation there is an injection vector).
export async function findStaffRowByIdentity<T = Record<string, unknown>>(
  supabase: SupabaseClient,
  columns: string,
  identity: Identity
): Promise<T | null> {
  if (identity.id) {
    const { data } = await supabase.from('staff').select(columns).eq('id', identity.id).maybeSingle()
    if (data) return data as T
  }

  const cleanEmail = identity.email?.trim().toLowerCase()
  if (cleanEmail) {
    const { data } = await supabase.from('staff').select(columns).eq('email', cleanEmail).maybeSingle()
    if (data) return data as T
  }

  return null
}

export async function findRoleByUserId(supabase: SupabaseClient, userId: string, email?: string | null): Promise<AppRole> {
  return findRoleByIdentity(supabase, { id: userId, email })
}

export async function findRoleByIdentity(supabase: SupabaseClient, identity: Identity): Promise<AppRole> {
  const cleanEmail = identity.email?.trim().toLowerCase()

  if (identity.id) {
    const { data: staffById } = await supabase
      .from('staff')
      .select('role, status')
      .eq('id', identity.id)
      .maybeSingle()

    if (staffById?.status === 'active' && (staffById.role === 'admin' || staffById.role === 'tarbiyachi' || staffById.role === 'dekan')) {
      return staffById.role
    }
  }

  if (cleanEmail) {
    const { data: staffByEmail } = await supabase
      .from('staff')
      .select('role, status')
      .eq('email', cleanEmail)
      .maybeSingle()

    if (staffByEmail?.status === 'active' && (staffByEmail.role === 'admin' || staffByEmail.role === 'tarbiyachi' || staffByEmail.role === 'dekan')) {
      return staffByEmail.role
    }
  }

  if (identity.id) {
    const { data: userById } = await supabase
      .from('users')
      .select('role, status')
      .eq('id', identity.id)
      .maybeSingle()

    if (userById?.role === 'talaba' && userById.status === 'active') {
      return 'talaba'
    }
  }

  if (cleanEmail) {
    const { data: userByEmail } = await supabase
      .from('users')
      .select('role, status')
      .eq('email', cleanEmail)
      .maybeSingle()

    if (userByEmail?.role === 'talaba' && userByEmail.status === 'active') {
      return 'talaba'
    }
  }

  return null
}
