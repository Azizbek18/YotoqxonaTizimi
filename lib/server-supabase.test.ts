import { afterEach, describe, expect, it } from 'vitest'

const ORIGINAL_ENV = { ...process.env }

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
})

describe('getServiceSupabase', () => {
  it('throws when NEXT_PUBLIC_SUPABASE_URL is missing', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key'
    const { getServiceSupabase } = await import('./server-supabase')
    expect(() => getServiceSupabase()).toThrow(/NEXT_PUBLIC_SUPABASE_URL/)
  })

  it('throws when SUPABASE_SERVICE_ROLE_KEY is missing', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    const { getServiceSupabase } = await import('./server-supabase')
    expect(() => getServiceSupabase()).toThrow(/SUPABASE_SERVICE_ROLE_KEY/)
  })

  it('builds a client when both are configured', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key'
    const { getServiceSupabase } = await import('./server-supabase')
    const client = getServiceSupabase()
    expect(client).toBeTruthy()
    expect(typeof client.from).toBe('function')
  })
})
