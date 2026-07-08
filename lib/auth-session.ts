'use client'

import { supabase } from '@/lib/supabase'

function isInvalidRefreshTokenError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? '')
  return message.toLowerCase().includes('invalid refresh token')
}

export async function clearStaleAuthSession() {
  try {
    await supabase.auth.signOut({ scope: 'local' })
  } catch {
    // The session is already unusable; local cleanup is best-effort.
  }
}

export async function getSafeUser() {
  try {
    const { data, error } = await supabase.auth.getUser()

    if (error && isInvalidRefreshTokenError(error)) {
      await clearStaleAuthSession()
      return null
    }

    return data.user ?? null
  } catch (error) {
    if (isInvalidRefreshTokenError(error)) {
      await clearStaleAuthSession()
    }
    return null
  }
}

export async function getSafeSession() {
  try {
    const { data, error } = await supabase.auth.getSession()

    if (error && isInvalidRefreshTokenError(error)) {
      await clearStaleAuthSession()
      return null
    }

    return data.session ?? null
  } catch (error) {
    if (isInvalidRefreshTokenError(error)) {
      await clearStaleAuthSession()
    }
    return null
  }
}

/**
 * Builds an `Authorization: Bearer <token>` header from the current session
 * for authenticated fetch() calls to our own API routes. Returns an empty
 * object when there's no active session.
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const session = await getSafeSession()
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
}
