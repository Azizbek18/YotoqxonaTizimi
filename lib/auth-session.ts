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

// Coalesces concurrent refresh attempts (e.g. chat polling + payment polling
// firing within the same tick) into a single in-flight request instead of
// each caller independently hitting Supabase's rotating-refresh-token
// endpoint — doing that concurrently can invalidate the token out from
// under a sibling call ("refresh token already used").
let inFlightRefresh: ReturnType<typeof supabase.auth.refreshSession> | null = null

async function refreshSessionOnce() {
  if (!inFlightRefresh) {
    inFlightRefresh = supabase.auth.refreshSession().finally(() => {
      inFlightRefresh = null
    })
  }
  return inFlightRefresh
}

/**
 * Builds an `Authorization: Bearer <token>` header from the current session
 * for authenticated fetch() calls to our own API routes. Returns an empty
 * object when there's no active session.
 *
 * Only force a refresh once the cached session has actually expired, not
 * merely "close to" expiry — Supabase's own background auto-refresh timer
 * already handles the pre-emptive case, and refreshing pre-emptively here
 * too easily overlaps with it (and with other tabs sharing the same
 * cookie-backed session), racing to rotate the same refresh token and
 * breaking the session instead of extending it.
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  let session = await getSafeSession()

  const expiresInMs = session?.expires_at ? session.expires_at * 1000 - Date.now() : null
  if (session && expiresInMs !== null && expiresInMs <= 0) {
    try {
      const { data, error } = await refreshSessionOnce()
      if (!error && data.session) {
        session = data.session
      } else if (error && isInvalidRefreshTokenError(error)) {
        await clearStaleAuthSession()
        session = null
      }
    } catch (error) {
      if (isInvalidRefreshTokenError(error)) {
        await clearStaleAuthSession()
        session = null
      }
      // Otherwise fall back to the possibly-stale session below; the server
      // will 401 and the caller surfaces that instead of silently hanging.
    }
  }

  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
}
