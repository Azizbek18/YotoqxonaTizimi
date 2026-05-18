import type { SupabaseClient } from '@supabase/supabase-js'

export type AppRole = 'admin' | 'tarbiyachi' | 'talaba' | null

type Identity = {
  id?: string | null
  email?: string | null
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

    if (staffById?.role === 'admin' || staffById?.role === 'tarbiyachi') {
      return staffById.role
    }
  }

  if (cleanEmail) {
    const { data: staffByEmail } = await supabase
      .from('staff')
      .select('role')
      .eq('email', cleanEmail)
      .maybeSingle()

    if (staffByEmail?.role === 'admin' || staffByEmail?.role === 'tarbiyachi') {
      return staffByEmail.role
    }
  }

  if (identity.id) {
    const { data: userById } = await supabase
      .from('users')
      .select('role')
      .eq('id', identity.id)
      .maybeSingle()

    if (userById?.role === 'talaba') {
      return 'talaba'
    }
  }

  if (cleanEmail) {
    const { data: userByEmail } = await supabase
      .from('users')
      .select('role')
      .eq('email', cleanEmail)
      .maybeSingle()

    if (userByEmail?.role === 'talaba') {
      return 'talaba'
    }
  }

  return null
}
