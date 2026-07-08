import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getServiceSupabase } from '@/lib/server-supabase'

export async function createServerSupabaseClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set({ name, value, ...options })
        },
        remove(name: string) {
          cookieStore.delete(name)
        },
      },
    }
  )
}

// Finds a row matching either `id` or `email` using two safe, parameterized
// lookups instead of interpolating user-controlled values into a single
// `.or()` filter string (PostgREST's or() mini-language treats commas/dots
// as syntax, so raw interpolation there is an injection vector).
async function findByIdOrEmail<T>(
  supabase: ReturnType<typeof getServiceSupabase>,
  table: 'staff' | 'users',
  columns: string,
  id: string,
  email: string | null | undefined
): Promise<T | null> {
  const { data: byId } = await supabase.from(table).select(columns).eq('id', id).eq('role', 'admin').maybeSingle()
  if (byId) return byId as T

  const cleanEmail = email?.trim().toLowerCase()
  if (!cleanEmail) return null

  const { data: byEmail } = await supabase.from(table).select(columns).eq('email', cleanEmail).eq('role', 'admin').maybeSingle()
  return (byEmail as T) ?? null
}

export async function getAdminSession() {
  const authSupabase = await createServerSupabaseClient()
  const serviceSupabase = getServiceSupabase()

  try {
    const { data: { session } } = await authSupabase.auth.getSession()

    if (!session?.user?.id) {
      return { session: null, user: null, isAdmin: false }
    }

    // Check both staff and users tables
    const staffData = await findByIdOrEmail<{ id: string; email: string; full_name: string; role: string }>(
      serviceSupabase, 'staff', 'id, email, full_name, role', session.user.id, session.user.email
    )

    if (staffData) {
      return {
        session,
        user: staffData,
        isAdmin: true,
      }
    }

    const userData = await findByIdOrEmail<{ id: string; email: string; full_name: string; role: string }>(
      serviceSupabase, 'users', 'id, email, full_name, role', session.user.id, session.user.email
    )

    if (userData?.role === 'admin') {
      return {
        session,
        user: userData,
        isAdmin: true,
      }
    }

    return { session, user: userData || staffData || null, isAdmin: false }
  } catch {
    return { session: null, user: null, isAdmin: false }
  }
}

export async function verifyAdminAccess() {
  const { isAdmin } = await getAdminSession()
  return isAdmin
}
