import 'server-only'
import { createClient, type User } from '@supabase/supabase-js'
import type { NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/server-admin'

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
    } = await supabase.auth.getUser(token)

    return error ? null : user
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession()

  if (error) return null
  return session?.user ?? null
}
