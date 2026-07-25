import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getServiceSupabase } from '@/lib/server-supabase'
import type { Database } from '@/types/database.generated'

export async function createServerSupabaseClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          } catch {
            // Called from a context that can't mutate cookies (e.g. a
            // Server Component render); safe to ignore since the auth
            // helper middleware/route handlers are what actually persist
            // refreshed cookies.
          }
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
  const { data: byId } = await supabase.from(table).select(columns).eq('id', id).eq('role', 'admin').eq('status', 'active').maybeSingle()
  if (byId) return byId as T

  const cleanEmail = email?.trim().toLowerCase()
  if (!cleanEmail) return null

  const { data: byEmail } = await supabase.from(table).select(columns).eq('email', cleanEmail).eq('role', 'admin').eq('status', 'active').maybeSingle()
  return (byEmail as T) ?? null
}

export async function getAdminSession() {
  const authSupabase = await createServerSupabaseClient()
  const serviceSupabase = getServiceSupabase()

  try {
    const { data: { user: authUser }, error: authError } = await authSupabase.auth.getUser()

    if (authError || !authUser?.id) {
      return { session: null, user: null, isAdmin: false }
    }

    // Privileged identities live only in the staff table. A users.role value
    // is never accepted as authorization evidence.
    const staffData = await findByIdOrEmail<{ id: string; email: string; full_name: string; role: string }>(
      serviceSupabase, 'staff', 'id, email, full_name, role', authUser.id, authUser.email
    )

    if (staffData) {
      return {
        session: { user: authUser },
        user: staffData,
        isAdmin: true,
      }
    }

    return { session: { user: authUser }, user: null, isAdmin: false }
  } catch {
    return { session: null, user: null, isAdmin: false }
  }
}

export async function verifyAdminAccess() {
  const { isAdmin } = await getAdminSession()
  return isAdmin
}
