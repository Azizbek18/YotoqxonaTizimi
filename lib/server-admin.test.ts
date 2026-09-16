import { beforeEach, describe, expect, it, vi } from 'vitest'

type CookieAdapter = {
  getAll: () => unknown[]
  setAll: (cookies: { name: string; value: string; options?: Record<string, unknown> }[]) => void
}

const mocks = vi.hoisted(() => ({
  cookieStoreGetAll: vi.fn(),
  cookieStoreSet: vi.fn(),
  createServerClient: vi.fn(),
}))

vi.mock('next/headers', () => ({
  cookies: async () => ({ getAll: mocks.cookieStoreGetAll, set: mocks.cookieStoreSet }),
}))
vi.mock('@supabase/ssr', () => ({ createServerClient: mocks.createServerClient }))

const { createServerSupabaseClient } = await import('./server-admin')

let capturedAdapter: CookieAdapter | null = null

beforeEach(() => {
  vi.resetAllMocks()
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'
  mocks.cookieStoreGetAll.mockReturnValue([{ name: 'sb-token', value: 'abc' }])
  mocks.createServerClient.mockImplementation((_url: string, _key: string, options: { cookies: CookieAdapter }) => {
    capturedAdapter = options.cookies
    return { fakeClient: true }
  })
})

describe('createServerSupabaseClient', () => {
  it('wires the anon URL/key and returns the built client', async () => {
    const client = await createServerSupabaseClient()
    expect(client).toEqual({ fakeClient: true })
    expect(mocks.createServerClient).toHaveBeenCalledWith(
      'https://example.supabase.co',
      'anon-key',
      expect.anything(),
    )
  })

  it('getAll() delegates straight to the request cookie store', async () => {
    await createServerSupabaseClient()
    expect(capturedAdapter?.getAll()).toEqual([{ name: 'sb-token', value: 'abc' }])
    expect(mocks.cookieStoreGetAll).toHaveBeenCalled()
  })

  it('setAll() writes each refreshed cookie back through cookieStore.set', async () => {
    await createServerSupabaseClient()
    capturedAdapter?.setAll([
      { name: 'sb-access-token', value: 'new-token', options: { httpOnly: true } },
      { name: 'sb-refresh-token', value: 'new-refresh' },
    ])
    expect(mocks.cookieStoreSet).toHaveBeenCalledTimes(2)
    expect(mocks.cookieStoreSet).toHaveBeenCalledWith('sb-access-token', 'new-token', { httpOnly: true })
  })

  it('setAll() swallows a write failure from a context that cannot mutate cookies (Server Component render)', async () => {
    mocks.cookieStoreSet.mockImplementation(() => {
      throw new Error('Cookies can only be modified in a Server Action or Route Handler')
    })
    await createServerSupabaseClient()
    expect(() => capturedAdapter?.setAll([{ name: 'sb-access-token', value: 'x' }])).not.toThrow()
  })
})
