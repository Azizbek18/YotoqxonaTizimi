import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/database.generated'

// The cookie-bound Supabase client for server code (route handlers, server
// components). `getRequestUser` in lib/server-auth builds on this. The old
// `getAdminSession` / `verifyAdminAccess` helpers were removed once the
// standalone /admin panel was retired — they were the last `auth.getUser()`
// callers here and had no remaining callers.
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
