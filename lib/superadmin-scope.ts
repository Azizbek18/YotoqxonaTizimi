'use client'

/**
 * Client side of the superadmin "acting faculty" model. Mirrors
 * server/auth/faculty.ts — the sa_scope cookie is a faculty code or `*`
 * (global). The server always re-validates the caller is `admin` before
 * honouring it, so this is a UX toggle, not a security boundary.
 */
export const SUPERADMIN_SCOPE_COOKIE = 'sa_scope'
export const GLOBAL_SCOPE = '*'

export function readSuperadminScope(): string {
  if (typeof document === 'undefined') return GLOBAL_SCOPE
  const match = document.cookie.match(/(?:^|;\s*)sa_scope=([^;]+)/)
  return match ? decodeURIComponent(match[1]) : GLOBAL_SCOPE
}

/** Persists the scope (1 year) and reloads so server components re-read it. */
export function setSuperadminScope(value: string) {
  if (typeof document === 'undefined') return
  const maxAge = 60 * 60 * 24 * 365
  document.cookie = `${SUPERADMIN_SCOPE_COOKIE}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; samesite=lax`
}

export const isGlobalScope = (value: string) => !value || value === GLOBAL_SCOPE
