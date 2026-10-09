'use client'

import { supabase } from '@/lib/supabase'

/**
 * Tiny per-tab read cache for the student panel's GET requests.
 *
 * Why: the student layout AND the page inside it fetch the same profile /
 * announcements / applications on mount, and every tab switch re-fetches them —
 * each one a serverless invocation on a tight compute budget. This collapses
 * identical requests made within a short window into one.
 *
 * Safety rules baked in:
 *  - short TTL, so data is never stale for long (a page reload always starts
 *    empty: this lives in module memory, not storage);
 *  - concurrent callers share one in-flight request;
 *  - every caller gets its own structured clone, so one component mutating the
 *    result can never leak into another;
 *  - failures are never cached;
 *  - everything is dropped when the signed-in user changes or signs out, so one
 *    account's data can't be served to the next;
 *  - mutating endpoints call `clear()` so the very next read is fresh.
 */

type Entry = { at: number; value?: unknown; promise?: Promise<unknown> }

const caches = new Set<ClientCache<unknown>>()
let watching = false
let lastUserId: string | null | undefined

function watchAuth() {
  if (watching || typeof window === 'undefined') return
  watching = true
  supabase.auth.onAuthStateChange((event, session) => {
    const userId = session?.user?.id ?? null
    if (event === 'SIGNED_OUT' || (lastUserId !== undefined && userId !== lastUserId)) clearAllClientCaches()
    lastUserId = userId
  })
}

export function clearAllClientCaches() {
  caches.forEach((cache) => cache.clear())
}

function clone<T>(value: T): T {
  return typeof structuredClone === 'function' ? structuredClone(value) : (JSON.parse(JSON.stringify(value)) as T)
}

export class ClientCache<T> {
  private entries = new Map<string, Entry>()

  constructor(private readonly ttlMs: number, private readonly now: () => number = Date.now) {
    caches.add(this as ClientCache<unknown>)
  }

  /** Cached read; `force` skips a fresh entry (but still shares an in-flight request). */
  get(key: string, loader: () => Promise<T>, opts: { force?: boolean } = {}): Promise<T> {
    watchAuth()
    const entry = this.entries.get(key)
    if (entry) {
      if (entry.promise) return entry.promise.then((value) => clone(value as T))
      if (!opts.force && this.now() - entry.at < this.ttlMs) return Promise.resolve(clone(entry.value as T))
    }

    const promise = loader().then(
      (value) => {
        // clear() during the request means the data may already be stale.
        if (this.entries.get(key)?.promise === promise) this.entries.set(key, { at: this.now(), value })
        return value
      },
      (error) => {
        if (this.entries.get(key)?.promise === promise) this.entries.delete(key)
        throw error
      },
    )
    this.entries.set(key, { at: 0, promise })
    return promise.then((value) => clone(value))
  }

  /**
   * Wrap a write: drops the cache now and again once the write settles (success
   * or failure), so neither a read racing the write nor the write's own effect
   * is ever served from before it.
   */
  invalidateAround<R>(mutation: Promise<R>): Promise<R> {
    this.clear()
    return mutation.finally(() => this.clear())
  }

  clear(key?: string) {
    if (key === undefined) this.entries.clear()
    else this.entries.delete(key)
  }
}
