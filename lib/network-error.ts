/**
 * True for "the network itself is unreachable" (offline dev sandbox, DNS
 * blocked, connection refused/timed out) as opposed to a real data/query
 * error. Callers that already have a safe fallback for a downstream lookup
 * use this to log those at `warn` instead of `error` — visible, but not
 * alarm-worthy — while still `error`-logging anything else, including a real
 * outage in production.
 */
export function isNetworkUnreachable(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const err = error as { message?: unknown; code?: unknown; cause?: { code?: unknown } }
  const code = typeof err.code === 'string' ? err.code : err.cause?.code
  if (typeof code === 'string' && ['ENOTFOUND', 'ECONNREFUSED', 'EACCES', 'EAI_AGAIN', 'ETIMEDOUT'].includes(code)) {
    return true
  }
  return typeof err.message === 'string' && err.message.toLowerCase().includes('fetch failed')
}

const warnedScopes = new Set<string>()

function errorSummary(error: unknown): string {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object') {
    const value = error as { message?: unknown; code?: unknown; details?: unknown; hint?: unknown }
    // Supabase's `details` can contain an entire undici stack. A degraded
    // fallback only needs a concise cause, kept to a single log line.
    const parts = [value.message, value.code, value.hint]
      .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
      .map((part) => part.trim().split(/\r?\n/, 1)[0])
    if (parts.length > 0) return [...new Set(parts)].join(' | ')
    try {
      return JSON.stringify(error)
    } catch {
      return Object.prototype.toString.call(error)
    }
  }
  return String(error)
}

/**
 * Logs a downstream lookup failure that already has a safe fallback in
 * place. A network-unreachable cause (offline dev sandbox, blocked egress)
 * logs one short `warn` per `scope` for this process's lifetime — repeat
 * requests in a sandboxed/offline run would otherwise print the same
 * "can't reach Supabase" line, with a full stack trace, on every single
 * request. Anything else (a real data/query error, including a genuine
 * production outage) still `error`-logs in full, every time.
 */
export function logDegradedFallback(scope: string, error: unknown): void {
  if (isNetworkUnreachable(error)) {
    if (warnedScopes.has(scope)) return
    warnedScopes.add(scope)
    const message = errorSummary(error)
    console.warn(`${scope}: network unreachable, falling back (further occurrences this run are suppressed) — ${message}`)
    return
  }
  console.error(`${scope} failed:`, error)
}
