import type { SupabaseClient } from '@supabase/supabase-js'

export type AppRole = 'admin' | 'tarbiyachi' | 'zamdekan' | 'talaba' | null

type Identity = {
  id?: string | null
  email?: string | null
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
      .select('role')
      .eq('id', identity.id)
      .maybeSingle()

    if (staffById?.role === 'admin' || staffById?.role === 'tarbiyachi' || staffById?.role === 'zamdekan') {
      return staffById.role
    }
  }

  if (cleanEmail) {
    const { data: staffByEmail } = await supabase
      .from('staff')
      .select('role')
      .eq('email', cleanEmail)
      .maybeSingle()

    if (staffByEmail?.role === 'admin' || staffByEmail?.role === 'tarbiyachi' || staffByEmail?.role === 'zamdekan') {
      return staffByEmail.role
    }
  }

  if (identity.id) {
    const { data: userById } = await supabase
      .from('users')
      .select('role, status')
      .eq('id', identity.id)
      .maybeSingle()

    if (userById?.role === 'talaba') {
      if (userById.status === 'pending') {
        return null
      }
      return 'talaba'
    }
  }

  if (cleanEmail) {
    const { data: userByEmail } = await supabase
      .from('users')
      .select('role, status')
      .eq('email', cleanEmail)
      .maybeSingle()

    if (userByEmail?.role === 'talaba') {
      if (userByEmail.status === 'pending') {
        return null
      }
      return 'talaba'
    }
  }

  return null
}
