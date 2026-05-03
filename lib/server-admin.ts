import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { findRoleByUserId } from '@/lib/auth-tables'

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
  const supabase = await createServerSupabaseClient()

  try {
    const { data: { session } } = await supabase.auth.getSession()

    if (!session?.user?.id) {
      return { session: null, user: null, isAdmin: false }
    }

    const { data: userData } = await supabase
      .from('staff')
      .select('id, email, full_name, role')
      .eq('id', session.user.id)
      .maybeSingle()

    const isAdmin = (await findRoleByUserId(supabase, session.user.id)) === 'admin'

    return {
      session,
      user: userData,
      isAdmin,
    }
  } catch {
    return { session: null, user: null, isAdmin: false }
  }
}

export async function verifyAdminAccess() {
  const { isAdmin } = await getAdminSession()
  return isAdmin
}
