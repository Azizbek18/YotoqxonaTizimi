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

export async function getAdminSession() {
  const authSupabase = await createServerSupabaseClient()
  const serviceSupabase = getServiceSupabase()

  try {
    const { data: { session } } = await authSupabase.auth.getSession()

    if (!session?.user?.id) {
      return { session: null, user: null, isAdmin: false }
    }

    // Check both staff and users tables
    const { data: staffData } = await serviceSupabase
      .from('staff')
      .select('id, email, full_name, role')
      .eq('role', 'admin')
      .or(`id.eq.${session.user.id},email.eq.${session.user.email?.trim().toLowerCase() ?? ''}`)
      .maybeSingle()

    if (staffData) {
      return {
        session,
        user: staffData,
        isAdmin: true,
      }
    }

    const { data: userData } = await serviceSupabase
      .from('users')
      .select('id, email, full_name, role')
      .eq('role', 'admin')
      .or(`id.eq.${session.user.id},email.eq.${session.user.email?.trim().toLowerCase() ?? ''}`)
      .maybeSingle()

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
