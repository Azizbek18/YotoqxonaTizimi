'use client'

import { getAuthHeaders } from '@/lib/auth-session'

export async function apiRequest<T>(
  url: string,
  init?: RequestInit,
  fallbackMessage = "So'rovni bajarib bo'lmadi",
): Promise<T> {
  const authHeaders = await getAuthHeaders()
  const response = await fetch(url, {
    ...init,
    headers: { ...authHeaders, ...init?.headers },
    cache: 'no-store',
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error || fallbackMessage)
  return body as T
}
