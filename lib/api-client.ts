'use client'

import { getAuthHeaders } from '@/lib/auth-session'
import { supabase } from '@/lib/supabase'

export async function apiRequest<T>(
  url: string,
  init?: RequestInit,
  fallbackMessage = "So'rovni bajarib bo'lmadi",
): Promise<T> {
  const controller = new AbortController()
  const cancel = () => controller.abort()
  init?.signal?.addEventListener('abort', cancel, { once: true })
  if (init?.signal?.aborted) cancel()
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') cancel()
  })
  try {
    const authHeaders = await getAuthHeaders()
    controller.signal.throwIfAborted()
    if (/^\/api\/(student|admin|dekan|tarbiyachi|staff|account|payments)(\/|\?|$)/.test(url)
      && !authHeaders.Authorization) {
      throw new DOMException('Sessiya tugagan', 'AbortError')
    }
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: { ...authHeaders, ...init?.headers },
      cache: 'no-store',
    })
    const body = await response.json().catch(() => ({}))
    controller.signal.throwIfAborted()
    if (!response.ok) throw new Error(body.error || fallbackMessage)
    return body as T
  } finally {
    subscription.unsubscribe()
    init?.signal?.removeEventListener('abort', cancel)
  }
}
