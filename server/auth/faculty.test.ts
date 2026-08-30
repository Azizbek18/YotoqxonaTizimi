import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/server/http/api-error'

const cookieStore = { value: undefined as string | undefined }
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (name === 'sa_scope' && cookieStore.value ? { value: cookieStore.value } : undefined),
  }),
}))
vi.mock('@/lib/server-supabase', () => ({ getServiceSupabase: () => ({}) }))

const { readSuperadminScope, requirePickedFaculty } = await import('./faculty')

afterEach(() => { cookieStore.value = undefined })

describe('readSuperadminScope', () => {
  it('is global when the cookie is unset', async () => {
    expect(await readSuperadminScope()).toBe('global')
  })
  it('is global for the * sentinel', async () => {
    cookieStore.value = '*'
    expect(await readSuperadminScope()).toBe('global')
  })
  it('resolves a real faculty code (canonicalised)', async () => {
    cookieStore.value = 'FIZIKA'
    expect(await readSuperadminScope()).toEqual({ faculty: 'fizika' })
  })
  it('falls back to global for an unknown code', async () => {
    cookieStore.value = 'not-a-faculty'
    expect(await readSuperadminScope()).toBe('global')
  })
})

describe('requirePickedFaculty', () => {
  it('throws SCOPE_REQUIRED for a superadmin acting globally', () => {
    try {
      requirePickedFaculty({ faculty: 'amit', superadminGlobal: true })
      throw new Error('should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError)
      expect((error as ApiError).code).toBe('SCOPE_REQUIRED')
    }
  })
  it('returns the picked faculty otherwise', () => {
    expect(requirePickedFaculty({ faculty: 'fizika' })).toBe('fizika')
    expect(requirePickedFaculty({ faculty: 'amit', superadminGlobal: false })).toBe('amit')
  })
  it('still 403s a real staffer with no faculty', () => {
    expect(() => requirePickedFaculty({ faculty: null })).toThrow()
  })
})
