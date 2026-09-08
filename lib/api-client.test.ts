import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const auth = vi.hoisted(() => ({
  headers: vi.fn(),
  listeners: new Set<(event: string) => void>(),
}))
vi.mock('@/lib/auth-session', () => ({ getAuthHeaders: auth.headers }))
vi.mock('@/lib/supabase', () => ({ supabase: { auth: {
  onAuthStateChange: (listener: (event: string) => void) => {
    auth.listeners.add(listener)
    return { data: { subscription: { unsubscribe: () => auth.listeners.delete(listener) } } }
  },
} } }))
import { apiRequest } from './api-client'
beforeEach(() => {
  auth.listeners.clear()
  auth.headers.mockResolvedValue({ Authorization: 'Bearer test' })
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}')))
})
afterEach(() => vi.unstubAllGlobals())
it('does not send private requests while signed out', async () => {
  auth.headers.mockResolvedValue({})
  await expect(apiRequest('/api/student/profile')).rejects.toMatchObject({ name: 'AbortError' })
  expect(fetch).not.toHaveBeenCalled()
  expect(auth.listeners.size).toBe(0)
})
it('allows public settings without a session', async () => {
  auth.headers.mockResolvedValue({})
  await apiRequest('/api/settings')
  expect(fetch).toHaveBeenCalledOnce()
})
it('cancels a request on logout and allows a new request after login', async () => {
  let signal!: AbortSignal
  vi.mocked(fetch).mockImplementationOnce((_url, init) => {
    signal = init!.signal!
    return new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(new DOMException('logout', 'AbortError')))
    })
  })
  const pending = apiRequest('/api/student/profile')
  const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' })
  await Promise.resolve()
  auth.listeners.forEach((listener) => listener('SIGNED_OUT'))
  await rejected
  expect(signal.aborted).toBe(true)
  expect(auth.listeners.size).toBe(0)
  await expect(apiRequest('/api/student/profile')).resolves.toEqual({})
})
it('honors cancellation while waiting for session headers', async () => {
  let resolve!: (value: Record<string, string>) => void
  auth.headers.mockReturnValue(new Promise((done) => { resolve = done }))
  const pending = apiRequest('/api/student/profile')
  const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' })
  auth.listeners.forEach((listener) => listener('SIGNED_OUT'))
  resolve({ Authorization: 'Bearer old' })
  await rejected
  expect(fetch).not.toHaveBeenCalled()
})
