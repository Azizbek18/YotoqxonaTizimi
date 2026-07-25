import 'server-only'
import { createClient, type User } from '@supabase/supabase-js'
import type { NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/server-admin'

function isNetworkError(error: unknown) {
  return error instanceof TypeError && error.message.toLowerCase().includes('fetch failed')
}

// A transient network blip talking to Supabase Auth (e.g. `TypeError: fetch
// failed`) is not the same thing as "not logged in", but supabase-js's
// getUser() surfaces both the same way. Retry once so a momentary hiccup
// doesn't get misreported to the caller as an authentication failure.
async function getUserWithRetry(
  call: () => ReturnType<ReturnType<typeof createClient>['auth']['getUser']>,
) {
  try {
    return await call()
  } catch (error) {
    if (!isNetworkError(error)) throw error
    return call()
  }
}

export async function getRequestUser(request?: Request | NextRequest): Promise<User | null> {
  const authHeader = request?.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (token) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !anonKey) return null

    const supabase = createClient(url, anonKey)
    const {
      data: { user },
      error,
    } = await getUserWithRetry(() => supabase.auth.getUser(token))

    return error ? null : user
  }

  // Never authorize from getSession(): it only reads the locally stored JWT
  // and does not revalidate it with Supabase Auth. getUser() verifies the
  // cookie-backed access token before privileged service-role queries run.
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error,
  } = await getUserWithRetry(() => supabase.auth.getUser())

  if (error) return null
  return user ?? null
}
