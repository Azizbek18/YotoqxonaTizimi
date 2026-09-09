import { useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

/**
 * Interval polling that only runs **while the tab is visible**.
 *
 * Hidden/offline tabs do not start requests. The next poll is scheduled
 * after the previous request settles, so slow requests cannot pile up.
 *
 * `fn` receives `silent`: `false` for the initial run and each on-focus
 * refresh, `true` for background ticks — same contract as the older
 * `usePollingEffect`, so callers can keep skipping spinners on silent ticks.
 *
 * Restarts whenever `intervalMs`, `enabled` or `restartKey` change.
 */
export function useVisiblePoll(
  fn: (silent: boolean) => void | Promise<void>,
  intervalMs: number,
  opts: { enabled?: boolean; restartKey?: unknown; runOnMount?: boolean } = {},
) {
  const { enabled = true, restartKey, runOnMount = true } = opts
  const fnRef = useRef(fn)
  useEffect(() => {
    fnRef.current = fn
  }, [fn])

  useEffect(() => {
    if (!enabled || typeof document === 'undefined') return
    let timer: ReturnType<typeof setTimeout> | null = null
    let disposed = false
    let running = false
    let sessionUserId: string | null = null
    const canRun = () => !disposed && !!sessionUserId && !document.hidden && navigator.onLine !== false

    const start = () => {
      if (timer === null && canRun() && !running) {
        timer = setTimeout(() => {
          timer = null
          void run(true)
        }, intervalMs)
      }
    }
    const stop = () => {
      if (timer !== null) {
        clearTimeout(timer)
        timer = null
      }
    }
    const run = async (silent: boolean) => {
      if (!canRun() || running) return
      running = true
      try {
        await fnRef.current(silent)
      } catch {
        // Callers display their own errors; a failed poll must not stop retries.
      } finally {
        running = false
        start()
      }
    }
    const onVisibility = () => {
      stop()
      if (canRun()) void run(false)
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const nextUserId = session?.user.id ?? null
      if (sessionUserId === nextUserId) return
      sessionUserId = nextUserId
      stop()
      // Leave the auth callback before invoking callers that may use getSession.
      if (canRun()) {
        timer = setTimeout(() => {
          timer = null
          if (event === 'INITIAL_SESSION' && !runOnMount) start()
          else void run(false)
        }, 0)
      }
    })
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('online', onVisibility)
    window.addEventListener('offline', onVisibility)
    return () => {
      disposed = true
      subscription.unsubscribe()
      stop()
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('online', onVisibility)
      window.removeEventListener('offline', onVisibility)
    }
  }, [enabled, intervalMs, restartKey, runOnMount])
}
